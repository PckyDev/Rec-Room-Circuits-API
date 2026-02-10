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
					},
					dragSelectionBox: {
						id: 'dragSelectionBox',
						element: null,
						isDragging: false,
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
				validateNode: (node) => {
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
					return nodeElement;
				},
				selectNode: (node) => {
					const nodeElement = _.graph.functions.validateNode(node);
					if (nodeElement) {
						// Toggle selected class on the node
						nodeElement.addClass('selected');
						// Set selected state in data
						const nodeData = _.graph.data.nodes.find(n => n.element && n.element.is(nodeElement));
						if (nodeData) {
							nodeData.selected = true;
						}
					} else {
						console.warn('Node element not found for:', node);
					}
				},
				deselectNode: (node) => {
					const nodeElement = _.graph.functions.validateNode(node);
					if (nodeElement) {
						// Toggle selected class on the node
						nodeElement.removeClass('selected');
						// Set selected state in data
						const nodeData = _.graph.data.nodes.find(n => n.element && n.element.is(nodeElement));
						if (nodeData) {
							nodeData.selected = false;
						}
					} else {
						console.warn('Node element not found for:', node);
					}
				},
				getSelectedNodes: () => {
					return _.graph.data.nodes.filter(n => n.selected);
				}
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
					},
					canvasClickDeselectNodes: async () => {
						const vpEl = _.graph.data.elements.graphCanvasViewport.element;
						if (!vpEl) return;

						vpEl.addEventListener('click', (e) => {
							const selectedNodes = _.graph.functions.getSelectedNodes();
							if (selectedNodes.length === 0) return;
							// Deselect all nodes if click on empty canvas (not on a node)
							if (e.target === vpEl) {
								selectedNodes.forEach(n => _.graph.functions.deselectNode(n.element));
							}
						});
					},
					dragSelectionBox: async () => {
						const vpEl = _.graph.data.elements.graphCanvasViewport.element;
						if (!vpEl) return;

						const boxEl = _.graph.data.elements.dragSelectionBox.element;
						if (!boxEl) return;

						let startX = 0;
						let startY = 0;
						let didDrag = false;
						let suppressNextClick = false;

						const DRAG_THRESHOLD = 3;

						// Prevent the "click on empty canvas" handler from deselecting after a drag-select.
						// Use capture so we run before other click listeners.
						vpEl.addEventListener(
							'click',
							(e) => {
								if (!suppressNextClick) return;
								suppressNextClick = false;
								e.preventDefault();
								e.stopImmediatePropagation();
							},
							true
						);

						vpEl.addEventListener('mousedown', (e) => {
							if (e.button !== 0) return; // left button only
							if (e.target !== vpEl) return; // only start if clicking on empty canvas

							e.preventDefault();

							_.graph.data.elements.dragSelectionBox.isDragging = true;
							didDrag = false;

							startX = e.clientX;
							startY = e.clientY;

							boxEl.style.left = startX + 'px';
							boxEl.style.top = startY + 'px';
							boxEl.style.width = '0px';
							boxEl.style.height = '0px';
							boxEl.classList.add('dragging');
						});

						window.addEventListener('mousemove', (e) => {
							if (!_.graph.data.elements.dragSelectionBox.isDragging) return;

							const currentX = e.clientX;
							const currentY = e.clientY;

							if (!didDrag) {
								if (
									Math.abs(currentX - startX) > DRAG_THRESHOLD ||
									Math.abs(currentY - startY) > DRAG_THRESHOLD
								) {
									didDrag = true;
								}
							}

							const x = Math.min(currentX, startX);
							const y = Math.min(currentY, startY);
							const width = Math.abs(currentX - startX);
							const height = Math.abs(currentY - startY);

							boxEl.style.left = x + 'px';
							boxEl.style.top = y + 'px';
							boxEl.style.width = width + 'px';
							boxEl.style.height = height + 'px';

							// Select nodes that intersect with the selection box
							const boxRect = boxEl.getBoundingClientRect();
							_.graph.data.nodes.forEach((n) => {
								const nodeRect = n.element[0].getBoundingClientRect();
								const intersects = !(
									nodeRect.right < boxRect.left ||
									nodeRect.left > boxRect.right ||
									nodeRect.bottom < boxRect.top ||
									nodeRect.top > boxRect.bottom
								);

								if (intersects) _.graph.functions.selectNode(n.element);
								else _.graph.functions.deselectNode(n.element);
							});
						});

						window.addEventListener('mouseup', (e) => {
							if (e.button !== 0) return; // left button only
							if (!_.graph.data.elements.dragSelectionBox.isDragging) return;

							_.graph.data.elements.dragSelectionBox.isDragging = false;

							// If we actually dragged, suppress the following click event so selection persists.
							if (didDrag) suppressNextClick = true;

							boxEl.classList.remove('dragging');
							boxEl.style.width = '0px';
							boxEl.style.height = '0px';
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
							selected: false,
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

						// Set up node selection handler
						_.graph.node.setSelectHandler(nodeElement);

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
					let nodeElement = await _.graph.functions.validateNode(node);
					if (!nodeElement) return;

					const vpEl = _.graph.data.elements.graphCanvasViewport.element;
					if (!vpEl) return;

					let isDragging = false;

					// Nodes we are dragging in this gesture (supports multi-select)
					let dragNodes = [];

					// For each node: offset from mouse(world) to node position(world) at grab time
					// DOMElement -> { dx, dy }
					let grabOffsets = new Map();

					const getMouseWorld = (clientX, clientY) => {
						const rect = vpEl.getBoundingClientRect();
						const sx = clientX - rect.left;
						const sy = clientY - rect.top;
						return _.graph.functions.screenToWorld(sx, sy);
					};

					nodeElement.on('mousedown', function (e) {
						if (e.which !== 1) return; // Only left mouse button
						e.preventDefault();

						isDragging = true;

						// If the grabbed node is selected, drag all selected nodes. Otherwise drag only this node.
						const grabbedIsSelected = nodeElement.hasClass('selected');

						if (grabbedIsSelected) {
							dragNodes = _.graph.functions
								.getSelectedNodes()
								.map(n => n.element)
								.filter(el => el && el.length > 0);

							// Ensure the grabbed node is included (defensive)
							if (!dragNodes.some(el => el.is(nodeElement))) dragNodes.push(nodeElement);
						} else {
							dragNodes = [nodeElement];
						}

						// Cache grab offsets in WORLD space so zooming mid-drag doesn't cause cursor drift.
						const mouseWorld0 = getMouseWorld(e.clientX, e.clientY);

						grabOffsets = new Map();
						dragNodes.forEach(el => {
							const left = parseFloat(el.css('left')) || 0;
							const top = parseFloat(el.css('top')) || 0;

							grabOffsets.set(el[0], {
								dx: mouseWorld0.x - left,
								dy: mouseWorld0.y - top
							});

							el.addClass('grabbing');
						});

						// Bring dragged nodes to the front
						const parent = nodeElement.parent();
						dragNodes.forEach(el => el.appendTo(parent));

						// Avoid stacking multiple window handlers
						$(window).off('mousemove.nodeDrag mouseup.nodeDrag');

						$(window).on('mousemove.nodeDrag', function (ev) {
							if (!isDragging) return;

							const mouseWorld = getMouseWorld(ev.clientX, ev.clientY);

							dragNodes.forEach(el => {
								const off = grabOffsets.get(el[0]);
								if (!off) return;

								_.graph.node.setPosition(el, mouseWorld.x - off.dx, mouseWorld.y - off.dy);
							});
						});

						$(window).on('mouseup.nodeDrag', function () {
							if (!isDragging) return;

							isDragging = false;
							dragNodes.forEach(el => el.removeClass('grabbing'));

							dragNodes = [];
							grabOffsets.clear();

							$(window).off('mousemove.nodeDrag mouseup.nodeDrag');
						});
					});
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
				},
				setSelectHandler: async (node) => {
					let nodeElement = await _.graph.functions.validateNode(node);
					if (!nodeElement) return;

					// Run before jQuery bubble handlers (and before the drag handler),
					// so dragging an unselected chip will select it first.
					let preselectedOnDown = false;
					const domEl = nodeElement[0];

					domEl.addEventListener(
						'mousedown',
						(e) => {
							if (e.button !== 0) return; // left button only

							const isMultiSelect = e.ctrlKey || e.metaKey;
							const nodeData = _.graph.data.nodes.find(n => n.element && n.element.is(nodeElement));

							// If not selected, select immediately so dragging starts with it selected.
							if (!nodeData?.selected) {
								preselectedOnDown = true;

								if (!isMultiSelect) {
									_.graph.data.nodes.forEach(n => {
										if (n.element && !n.element.is(nodeElement)) _.graph.functions.deselectNode(n.element);
									});
								}

								_.graph.functions.selectNode(nodeElement);
							} else {
								preselectedOnDown = false;
							}
						},
						true // capture
					);

					nodeElement.on('mousedown', function (e) {
						if (e.which !== 1) return; // left mouse button only
						e.stopPropagation();

						const isMultiSelect = e.ctrlKey || e.metaKey;

						const startX = e.clientX;
						const startY = e.clientY;
						let moved = false;

						$(window).off('mousemove.nodeSelect mouseup.nodeSelect');

						$(window).on('mousemove.nodeSelect', function (ev) {
							if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) {
								moved = true;
							}
						});

						$(window).on('mouseup.nodeSelect', function () {
							$(window).off('mousemove.nodeSelect mouseup.nodeSelect');

							// If it turned into a drag, selection was already handled on mousedown.
							if (moved) {
								preselectedOnDown = false;
								return;
							}

							const nodeData = _.graph.data.nodes.find(n => n.element && n.element.is(nodeElement));

							if (!isMultiSelect) {
								// single select
								_.graph.data.nodes.forEach(n => {
									if (n.element && !n.element.is(nodeElement)) _.graph.functions.deselectNode(n.element);
								});
								_.graph.functions.selectNode(nodeElement);
							} else {
								// multi-select: ctrl/cmd-click toggles, but don't immediately toggle off
								// if we only just preselected on mousedown.
								if (!preselectedOnDown) {
									if (nodeData?.selected) _.graph.functions.deselectNode(nodeElement);
									else _.graph.functions.selectNode(nodeElement);
								}
							}

							preselectedOnDown = false;
						});
					});
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