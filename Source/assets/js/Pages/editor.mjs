import { ui } from '../Modules/RecRoom/ui.mjs';
import { chip } from '../Modules/chip.mjs';


$(function () {
	const _ = {
		data: {
			renderElement: null,
			selectedChipData: null,
			chipsJSON: {}
		},
		init: async () => {
			await ui.init.inputs();
			await chip.init();
			await chip.getAll({ combineResults: true }).then(data => {
				_.data.chipsJSON = data;
			});
			await _.palette.init();
			await _.graph.init();
		},
		palette: {
			data: {
				templates: {
					paletteChipTemplate: {
						id: 'paletteChipTemplate',
						html: null,
						placeholders: {
							chipPaletteName: '{{paletteName}}'
						}
					}
				},
				resizeCols: [
					{
						min: 0,
						max: 350,
						chipsPerRow: 1
					},
					{
						min: 351,
						max: 600,
						chipsPerRow: 2
					},
					{
						min: 601,
						max: 800,
						chipsPerRow: 3
					},
					{
						min: 801,
						max: 1000,
						chipsPerRow: 4
					},
					{
						min: 1001,
						max: 1200,
						chipsPerRow: 5
					}
				],
				paletteChipsContainerId: 'paletteChipsContainer',
				chipPaletteRenderId: 'chipPaletteRender',
				searchInputId: 'paletteSearchInput',
				paletteWindowId: 'paletteWindow',
				paletteResizeBarId: 'paletteResizeBar',
			},
			init: async () => {
				await _.palette.load.templates();
				await _.palette.load.chips();
				await _.palette.load.searchInput();
				await _.palette.load.resizeBar();
			},
			functions: {
				resize: async (newWidth) => {
					const paletteWindow = $('#' + _.palette.data.paletteWindowId);
					const minWidth = 240;
					const maxWidth = $(window).width() - 2;

					if (newWidth < minWidth) newWidth = minWidth;
					if (newWidth > maxWidth) newWidth = maxWidth;
					paletteWindow.css('width', newWidth + 'px');

					const chipsContainer = $('#' + _.palette.data.paletteChipsContainerId);
					const classTemplate = 'row row-cols-{{chipsPerRow}}';
					$.each(_.palette.data.resizeCols, function (index, colData) {
						if (newWidth >= colData.min && newWidth <= colData.max) {
							chipsContainer.attr('class', classTemplate.replace('{{chipsPerRow}}', colData.chipsPerRow));
							return false; // break loop
						}
					});
					$('body').trigger('resize-chips');
				}
			},
			load: {
				templates: async () => {
					$.each(_.palette.data.templates, function (templateName, templateData) {
						const templateElement = $('#' + templateData.id);
						if (templateElement.length > 0) {
							templateData.html = templateElement[0].outerHTML.replace('id="' + templateData.id + '"', '').trim();
							const children = templateElement.parent().children();
							children.each(function () {
								if (this.id === templateData.id) {
									$(this).remove();
								}
							});
						} else {
							console.warn('Template element with id "' + templateData.id + '" not found.');
						}
					});
				},
				chips: async (query) => {
					if (!_.data.chipsJSON || Object.keys(_.data.chipsJSON).length === 0) {
						_.data.chipsJSON = await chip.getAll();
					}

					let chipsJSON = _.data.chipsJSON;
					
					if (query) {
						chipsJSON = await chip.search(query, { chipsJSON: _.data.chipsJSON, combineResults: true });
					}
					// console.log('Chips to display:', chipsJSON);

					const chipsContainer = $('#' + _.palette.data.paletteChipsContainerId);
					chipsContainer.html('');

					// Lazy-render chips as they enter (or get near) the viewport.
					// Clean up any previous observer before rebuilding the list.
					if (_.palette.data._chipObserver) {
						_.palette.data._chipObserver.disconnect();
						_.palette.data._chipObserver = null;
					}

					const canObserve = typeof IntersectionObserver !== 'undefined';

					const observer = canObserve
						? new IntersectionObserver(
								async (entries, obs) => {
									for (const entry of entries) {
										if (!entry.isIntersecting) continue;

										const target = entry.target;
										obs.unobserve(target);

										if (target.dataset.rendered === 'true') continue;
										target.dataset.rendered = 'true';

										const chipName = target.dataset.chipName;
										const chipData = chipsJSON[chipName];
										await chip.render($(target), chipData, { size: 1, log: false });
									}
								},
								{
									root: null,
									// Start rendering a bit before it becomes visible
									rootMargin: '250px 0px',
									threshold: 0.01
								}
						  )
						: null;

					_.palette.data._chipObserver = observer;

					for (const [chipName, chipData] of Object.entries(chipsJSON)) {
						const chipElementHTML = _.palette.data.templates.paletteChipTemplate.html
							.replace(_.palette.data.templates.paletteChipTemplate.placeholders.chipPaletteName, chipData.paletteName);

						const chipElement = $(chipElementHTML);
						chipsContainer.append(chipElement);

						const chipPaletteRender = chipsContainer
							.children()
							.last()
							.find('#' + _.palette.data.chipPaletteRenderId);

						// Make the render target unique and track its render state
						chipPaletteRender.removeAttr('id');
						chipPaletteRender[0].dataset.chipName = chipName;
						chipPaletteRender[0].dataset.rendered = 'false';

						if (observer) {
							observer.observe(chipPaletteRender[0]);
						} else {
							// Fallback: no IntersectionObserver support -> render immediately
							await chip.render(chipPaletteRender, chipData, { size: 1, log: false });
							chipPaletteRender[0].dataset.rendered = 'true';
						}

						// Load click event for chips
						chipElement.on('click', async function () {
							// await chip.render($('#render'), chipData, { size: 1, log: true });
							await _.graph.node.add(chipData);
						});
					}
				},
				searchInput: async () => {
					const searchInput = $('#' + _.palette.data.searchInputId);
					searchInput.on('input', function () {
						const query = $(this).val().trim();
						_.palette.load.chips(query);
					});
				},
				resizeBar: async () => {
					const resizeBar = $('#' + _.palette.data.paletteResizeBarId);
					let isResizing = false;

					resizeBar.on('mousedown', function (e) {
						e.preventDefault();
						isResizing = true;
					});

					$(document).on('mousemove', function (e) {
						if (!isResizing) return;
						const newWidth = e.clientX;
						_.palette.functions.resize(newWidth);
					});

					$(document).on('mouseup', function () {
						if (isResizing) {
							isResizing = false;
						}
					});
				}
			},
		},
		graph: {
			data: {
				elements: {
					graphCanvasViewport: {
						id: 'graphCanvasViewport',
						element: null
					},
					graphCanvas: {
						id: 'graphCanvas',
						element: null,
					}
				},
				cameraState: {
					tx: 0,
					ty: 0,
					scale: 1,
					minScale: 0.15,
					maxScale: 6,
					dragging: false,
					lastX: 0,
					lastY: 0
				},
				BASE_MAJOR: 100,
				BASE_MINOR: 25,
				rafPending: false,
				nodes: [],
			},
			init: async () => {
				// Load element references
				await _.graph.load.elements();

				// Initialize interaction handlers
				$.each(_.graph.load.interaction, function (interactionName, interactionFunction) {
					interactionFunction();
				});

				// Start centered
				const vpEl = _.graph.data.elements.graphCanvasViewport.element;
				if (vpEl) {
					_.graph.data.cameraState.tx = vpEl.clientWidth * 0.5;
					_.graph.data.cameraState.ty = vpEl.clientHeight * 0.5;
				}
				_.graph.functions.requestRender();

				// For testing: add a node to the center of the graph
				// await _.graph.node.add('Add Tag');
			},
			functions: {
				clamp: (v, a, b) => {
					return Math.max(a, Math.min(b, v));
				},
				requestRender: () => {
					if (_.graph.data.rafPending) return;
					_.graph.data.rafPending = true;
					requestAnimationFrame(() => _.graph.functions.render());
				},
				screenToWorld: (sx, sy) => {
					return {
						x: (sx - _.graph.data.cameraState.tx) / _.graph.data.cameraState.scale,
						y: (sy - _.graph.data.cameraState.ty) / _.graph.data.cameraState.scale
					};
				},
				render: () => {
					_.graph.data.rafPending = false;

					const canvasEl = _.graph.data.elements.graphCanvas.element;
					const vpEl = _.graph.data.elements.graphCanvasViewport.element;

					if (canvasEl) {
						// Apply world transform (everything inside pans/zooms together)
						canvasEl.style.transform = `translate(${_.graph.data.cameraState.tx}px, ${_.graph.data.cameraState.ty}px) scale(${_.graph.data.cameraState.scale})`;
					}

					if (!vpEl) return;

					// Update grid to match camera (in screen px)
					const majorPx = _.graph.data.BASE_MAJOR * _.graph.data.cameraState.scale;
					const minorPx = _.graph.data.BASE_MINOR * _.graph.data.cameraState.scale;

					// Keep grid stable with positive modulo (avoid jitter when panning negative)
					const mod = (n, m) => ((n % m) + m) % m;

					vpEl.style.setProperty('--major', `${majorPx}px`);
					vpEl.style.setProperty('--minor', `${minorPx}px`);
					vpEl.style.setProperty('--grid-x', `${mod(_.graph.data.cameraState.tx, majorPx)}px`);
					vpEl.style.setProperty('--grid-y', `${mod(_.graph.data.cameraState.ty, majorPx)}px`);
				},
			},
			load: {
				elements: async () => {
					$.each(_.graph.data.elements, function (elementName, elementData) {
						const element = document.getElementById(elementData.id);
						if (element) {
							elementData.element = element;
						} else {
							console.warn('Graph element with id "' + elementData.id + '" not found.');
						}
					});
				},
				interaction: {
					middleMousePan: async () => {
						const vpEl = _.graph.data.elements.graphCanvasViewport.element;
						if (!vpEl) return;

						$(vpEl).on('mousedown', function (e) {
							if (e.which !== 2) return; // Only middle mouse button
							e.preventDefault();
							_.graph.data.cameraState.dragging = true;
							_.graph.data.cameraState.lastX = e.clientX;
							_.graph.data.cameraState.lastY = e.clientY;
							vpEl.classList.add('grabbing');
						});

						$(window).on('mousemove', function (e) {
							if (!_.graph.data.cameraState.dragging) return;
							const dx = e.clientX - _.graph.data.cameraState.lastX;
							const dy = e.clientY - _.graph.data.cameraState.lastY;
							_.graph.data.cameraState.lastX = e.clientX;
							_.graph.data.cameraState.lastY = e.clientY;
							_.graph.data.cameraState.tx += dx;
							_.graph.data.cameraState.ty += dy;
							_.graph.functions.requestRender();
						});

						$(window).on('mouseup', function (e) {
							if (!_.graph.data.cameraState.dragging) return;
							_.graph.data.cameraState.dragging = false;
							vpEl.classList.remove('grabbing');
						});
					},
					preventBrowserMiddleClick: async () => {
						const vpEl = _.graph.data.elements.graphCanvasViewport.element;
						if (!vpEl) return;

						$(vpEl).on('click', function (e) {
							if (e.which === 2) {
								e.preventDefault();
							}
						});
					},
					wheelZoomAroundCursor: async () => {
						const vpEl = _.graph.data.elements.graphCanvasViewport.element;
						if (!vpEl) return;

						vpEl.addEventListener('wheel', (e) => {
							e.preventDefault();

							const rect = vpEl.getBoundingClientRect();
							const mx = e.clientX - rect.left;
							const my = e.clientY - rect.top;

							// World point under cursor before zoom
							const before = _.graph.functions.screenToWorld(mx, my);

							// Exponential zoom feels right
							const zoomSpeed = 0.0015;
							const zoomFactor = Math.exp(-e.deltaY * zoomSpeed);

							_.graph.data.cameraState.scale = _.graph.functions.clamp(
								_.graph.data.cameraState.scale * zoomFactor,
								_.graph.data.cameraState.minScale,
								_.graph.data.cameraState.maxScale
							);

							// Recompute translation so 'before' stays under the cursor
							_.graph.data.cameraState.tx = mx - before.x * _.graph.data.cameraState.scale;
							_.graph.data.cameraState.ty = my - before.y * _.graph.data.cameraState.scale;

							_.graph.functions.requestRender();
						}, { passive: false });
					},
					disableContextMenu: async () => {
						const vpEl = _.graph.data.elements.graphCanvasViewport.element;
						if (!vpEl) return;

						vpEl.addEventListener('contextmenu', (e) => {
							e.preventDefault();
						});
					}
				}
			},
			node: {
				add: async (node) => {
					let nodeHTML = await chip.render(null, node, { log: false, autoFit: false });
					if (nodeHTML) {

						nodeHTML = nodeHTML.replace('class="chip', 'id="node-' + _.graph.data.nodes.length + '" class="chip');
						$(_.graph.data.elements.graphCanvas.element).append(nodeHTML);
						const nodeElement = $(_.graph.data.elements.graphCanvas.element).find('#node-' + _.graph.data.nodes.length);
						const nodeObject = {
							id: 'node-' + _.graph.data.nodes.length,
							element: nodeElement,
						}
						_.graph.data.nodes.push(nodeObject);

						// Set position of new node to center of viewport
						const vpEl = _.graph.data.elements.graphCanvasViewport.element;
						if (vpEl) {
							const centerX = (vpEl.clientWidth * 0.5 - _.graph.data.cameraState.tx) / _.graph.data.cameraState.scale;
							const centerY = (vpEl.clientHeight * 0.5 - _.graph.data.cameraState.ty) / _.graph.data.cameraState.scale;
							nodeElement.css('left', centerX + 'px');
							nodeElement.css('top', centerY + 'px');
						}

						// Make the node draggable
						_.graph.node.setDragHandler(nodeElement);

						// Set up port hover handlers
						_.graph.node.setPortsHoverHandler(nodeElement);

					} else {
						console.warn('Failed to render chip for node:', node);
					}
				},
				setPosition: async (node, x, y) => {
					let nodeElement = null;
					if (typeof node === 'string' && node.startsWith('node-')) {
						nodeElement = _.graph.data.nodes.find(n => n.id === node)?.element;
					} else if (node instanceof Element) {
						nodeElement = $(node);
					} else if (node instanceof jQuery && node.length > 0) {
						nodeElement = node;
					} else {
						console.warn('Invalid node identifier:', node);
						return;
					}

					if (nodeElement) {
						// Node CSS left/top are in world coordinates (the graphCanvas is transformed),
						// so set them directly to avoid drift/jumps across zoom levels.
						nodeElement.css('left', x + 'px');
						nodeElement.css('top', y + 'px');
					} else {
						console.warn('Node element not found for:', node);
					}
				},
				setDragHandler: async (node) => {
					let nodeElement = null;
					if (typeof node === 'string' && node.startsWith('node-')) {
						nodeElement = _.graph.data.nodes.find(n => n.id === node)?.element;
					} else if (node instanceof Element) {
						nodeElement = $(node);
					} else if (node instanceof jQuery && node.length > 0) {
						nodeElement = node;
					} else {
						console.warn('Invalid node identifier:', node);
						return;
					}

					if (nodeElement) {
						let isDragging = false;
						let lastX = 0;
						let lastY = 0;

						nodeElement.on('mousedown', function (e) {
							if (e.which !== 1) return; // Only left mouse button
							e.preventDefault();
							isDragging = true;
							lastX = e.clientX;
							lastY = e.clientY;
							nodeElement.addClass('grabbing');

							// Bring the dragged node to the front by moving it to the end of the container
							nodeElement.appendTo(nodeElement.parent());
						});

						$(window).on('mousemove', function (e) {
							if (!isDragging) return;
							const dx = e.clientX - lastX;
							const dy = e.clientY - lastY;
							lastX = e.clientX;
							lastY = e.clientY;

							// Convert screen-space mouse movement to world-space movement.
							const scale = _.graph.data.cameraState.scale || 1;
							const worldDx = dx / scale;
							const worldDy = dy / scale;

							const currentLeft = parseFloat(nodeElement.css('left')) || 0;
							const currentTop = parseFloat(nodeElement.css('top')) || 0;
							_.graph.node.setPosition(nodeElement, currentLeft + worldDx, currentTop + worldDy);
						});

						$(window).on('mouseup', function (e) {
							if (!isDragging) return;
							isDragging = false;
							nodeElement.removeClass('grabbing');
						});
					}
				},
				setPortsHoverHandler: async (node) => {
					let nodeElement = null;
					if (typeof node === 'string' && node.startsWith('node-')) {
						nodeElement = _.graph.data.nodes.find(n => n.id === node)?.element;
					} else if (node instanceof Element) {
						nodeElement = $(node);
					} else if (node instanceof jQuery && node.length > 0) {
						nodeElement = node;
					} else {
						console.warn('Invalid node identifier:', node);
						return;
					}

					if (nodeElement) {
						chip.initPortsHover(nodeElement);
					}
				}
			}
		},
		load: {
			renderElement: async () => {
				_.data.renderElement = $('#render');
			},
			selectMenu: async () => {
				_.data.selectMenuElement = $('#select-menu');
				$.each(_.data.Circuits, function (chipName, chipData) {
					let option = $('<option></option>')
						.attr('value', chipName)
						.text(chipData.paletteName);
					_.data.selectMenuElement.append(option);
				});
				_.data.selectedChipData = _.data.Circuits[_.data.selectMenuElement.val()];
				_.data.selectMenuElement.on('change', function () {
					let selectedChipName = $(this).val();
					let selectedChipData = _.data.Circuits[selectedChipName];
					_.data.selectedChipData = selectedChipData;
					$('#render').empty();
					_.render.chip();
				});
			}
		},
		render: {
			chip: async () => {
				const options = {
					log: true,
					size: 1
				}
				// chip.render(_.data.renderElement, _.data.selectedChipData, options);
				// await chip.render(_.data.renderElement, 'List Create With', options);
				await chip.render(_.data.renderElement, $('#select-menu').val(), options);
			}
		}
	}

	_.init();
});