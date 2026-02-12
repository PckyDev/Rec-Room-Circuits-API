import { ui } from '../Modules/RecRoom/ui.mjs';
import { chip } from '../Modules/chip.mjs';


$(function () {
	const _ = {
		data: {
			mobile: {
				breakpoint: 576,
				isMobile: $(window).width() < 576,
				nav: {
					paletteOpenMobileBtn: {
						id: 'paletteOpenMobile',
						element: null,
						clickTrigger: 'openPalette'
					}
				}
			},
			renderElement: null,
			selectedChipData: null,
			chipsJSON: {}
		},
		init: async () => {
			await ui.init.inputs();
			await _.load.mobile();
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
				paletteInfoModalId: 'paletteInfoModal',
				chipOpenInfoModalBtnClass: 'openInfoModal'
			},
			init: async () => {
				await _.palette.load.templates();
				await _.palette.load.chips();
				await _.palette.load.searchInput();
				await _.palette.load.resizeBar();
				await _.palette.load.openEvent();
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
				},
				openInfoModal: async (chipData) => {
					const modal = $('#' + _.palette.data.paletteInfoModalId);

					if (modal.length === 0) {
						console.warn('Modal element with id "' + _.palette.data.paletteInfoModalId + '" not found.');
						return;
					}

					// Set model content based on chipData
					modal.find('.chip-name').text(chipData.paletteName || chipData.chipName || 'Unknown Chip');
					modal.find('.chip-description').text(chipData.description || 'No description available.');

					// Show/hide badges based on chipData properties
					const deprecated = false;
					if (chipData.deprecationStage.name && chipData.deprecationStage.name !== 'Active') {
						deprecated = true;
					}

					const badges = {
						'r1': chipData.isValidInRoom1 || false,
						'r2': chipData.isValidInRoom2 || false,
						'dev': chipData.isDevChip || false,
						'studio': chipData.isStudioChip || false,
						'troll': chipData.isTrollingRisk || false,
						'role': chipData.isRoleAssignmentRisk || false,
						'beta': chipData.isBetaChip || false,
						'deprecated': deprecated
					}
					$.each(badges, function (badgeClass, isVisible) {
						const badgeElement = modal.find('.badges .' + badgeClass);
						if (isVisible) {
							badgeElement.show();
						} else {
							badgeElement.hide();
						}
					});

					// Render chip preview in the modal
					const previewContainer = modal.find('.chip-preview-viewport');
					// Clear previous preview
					previewContainer.empty();
					// Render new preview
					await chip.render(previewContainer, chipData, { size: 1, log: false, autoFit: true, enablePortHover: true });

					// Open the modal using jQuery Bootstrap's modal method
					modal.modal('show');
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
						chipElement.on('click', async function (e) {
							// Prevent clicks on buttons inside the chip from triggering the node add.
							if ($(e.target).closest('button').length > 0) {
								// If the click was on the info button, open the info modal.
								if ($(e.target).closest('button').hasClass(_.palette.data.chipOpenInfoModalBtnClass)) {
									_.palette.functions.openInfoModal(chipData);
								}
								return;
							}

							// await chip.render($('#render'), chipData, { size: 1, log: true });
							await _.graph.node.add(chipData);

							if (_.data.mobile.isMobile) {
								$('body').trigger('openPalette');
							}
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
						if (_.data.mobile.isMobile) return; // Disable resizing on mobile for now
						const newWidth = e.clientX;
						_.palette.functions.resize(newWidth);
					});

					$(document).on('mouseup', function () {
						if (isResizing) {
							isResizing = false;
						}
					});
				},
				openEvent: async () => {
					$('body').on('openPalette', function () {
						const paletteWindow = $('#' + _.palette.data.paletteWindowId);
						if (paletteWindow.hasClass('open')) {
							paletteWindow.removeClass('open');
						} else {
							paletteWindow.addClass('open');
						}
						_.palette.functions.resize(paletteWindow.width());
					});
				},
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
				_nextNodeId: 0,
				_nodeClipboard: null,
				_pasteSerial: 0,
				_history: {
					undo: [],
					redo: [],
					max: 50,
					inBatch: false,
					batchRecorded: false,
					restoring: false
				},
				nodes: [],
				// Example node object structure:
				// {
				//     id: 'node-0',
				//     element: jQueryElement,
				//     selected: false,
				//     object: {
				// 	       chipName: 'Absolute Value',
				//         paletteName: 'Absolute Value',
				//         nodeDescs: [
				//             {
				//                 name: 'Absolute Value',
				//                 typeParams: [ { name: 'T', type: '(float, int)'} ],
				//				   inputs: [
				//                     { name: 'Value', type: 'T', description: '' }
				//				   ],
				//				   outputs: [
				//                     { name: 'Result', type: 'T', description: '' }
				//				   ]
				//             }
				//         ]
				//     }
				// }
				connections: []
				// Example connection object structure:
				// {
				//     id: 'connection-0',
				//     from: { nodeId: 'node-1', portId: 'port-1' },
				//     to: { nodeId: 'node-2', portId: 'port-2' },
				//     element: jQueryElement
				// }
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

				// Initialize node id counter from any existing nodes.
				_.graph.data._nextNodeId = Math.max(
					Number(_.graph.data._nextNodeId || 0),
					...(_.graph.data.nodes || []).map(n => {
						const m = String(n?.id || '').match(/^node-(\d+)$/);
						return m ? Number(m[1]) + 1 : 0;
					})
				);

				// Enable Backspace/Delete to remove selected nodes.
				_.graph.node.setNodeDeletionHandler();
				// Enable Ctrl/Cmd+C/V/X for selected nodes.
				_.graph.node.setCopyPasteHandler();
				// Enable Ctrl/Cmd+Z and Ctrl/Cmd+Y (or Shift+Cmd+Z) for undo/redo.
				_.graph.node.setUndoRedoHandler();

				// For testing: add a node to the center of the graph
				// await _.graph.node.add('Add Tag');
			},
			functions: {
				_captureGraphSnapshot: () => {
					const camera = _.graph.data.cameraState || {};
					const nodes = (_.graph.data.nodes || []).map((n) => {
						const leftRaw = n?.element?.css?.('left');
						const topRaw = n?.element?.css?.('top');
						const x = Number.parseFloat(String(leftRaw || '0')) || 0;
						const y = Number.parseFloat(String(topRaw || '0')) || 0;
						return {
							id: n.id,
							payload: n.object ?? null,
							x,
							y,
							selected: !!n.selected
						};
					});

					const connections = (_.graph.data.connections || []).map(c => ({
						from: { nodeId: c?.from?.nodeId, portId: c?.from?.portId },
						to: { nodeId: c?.to?.nodeId, portId: c?.to?.portId }
					})).filter(c => c.from.nodeId && c.from.portId && c.to.nodeId && c.to.portId);

					return {
						camera: {
							tx: Number(camera.tx ?? 0),
							ty: Number(camera.ty ?? 0),
							scale: Number(camera.scale ?? 1)
						},
						nodes,
						connections
					};
				},
				_recordHistory: () => {
					const h = _.graph.data._history;
					if (!h || h.restoring) return;
					if (h.inBatch && h.batchRecorded) return;

					const snap = _.graph.functions._captureGraphSnapshot();
					h.undo.push(snap);
					if (h.undo.length > (h.max || 50)) h.undo.shift();
					h.redo.length = 0;
					if (h.inBatch) h.batchRecorded = true;
				},
				_historyBeginBatch: () => {
					const h = _.graph.data._history;
					if (!h) return;
					h.inBatch = true;
					h.batchRecorded = false;
				},
				_historyEndBatch: () => {
					const h = _.graph.data._history;
					if (!h) return;
					h.inBatch = false;
					h.batchRecorded = false;
				},
				_restoreGraphSnapshot: async (snap) => {
					if (!snap) return;
					const h = _.graph.data._history;
					if (!h) return;
					h.restoring = true;
					try {
						// Stop any in-progress gestures.
						if (_.graph.data._connectionDrag?.active) _.graph.functions.cancelConnection();

						// Remove existing connections (DOM + data).
						for (const conn of (_.graph.data.connections || [])) {
							try { conn.element?.remove?.(); } catch { /* ignore */ }
						}
						_.graph.data.connections = [];

						// Remove existing nodes (DOM + data).
						for (const n of (_.graph.data.nodes || [])) {
							try { n.element?.remove?.(); } catch { /* ignore */ }
						}
						_.graph.data.nodes = [];

						// Restore camera.
						if (snap.camera) {
							_.graph.data.cameraState.tx = Number(snap.camera.tx ?? 0);
							_.graph.data.cameraState.ty = Number(snap.camera.ty ?? 0);
							_.graph.data.cameraState.scale = Number(snap.camera.scale ?? 1);
						}

						// Restore nodes with stable ids.
						let nextId = 0;
						const nodes = Array.isArray(snap.nodes) ? snap.nodes : [];
						for (const n of nodes) {
							const id = String(n.id || '');
							const m = id.match(/^node-(\d+)$/);
							if (m) nextId = Math.max(nextId, Number(m[1]) + 1);

							const payload = n.payload ?? null;
							const addArg = payload?.chipName ? payload.chipName : payload;
							const created = await _.graph.node.add(addArg, { id, skipHistory: true });
							if (!created?.id) continue;
							await _.graph.node.setPosition(created.id, Number(n.x ?? 0), Number(n.y ?? 0));
							if (n.selected) _.graph.functions.selectNode(created.id);
						}
						_.graph.data._nextNodeId = Math.max(Number(_.graph.data._nextNodeId || 0), nextId);

						// Restore connections.
						const conns = Array.isArray(snap.connections) ? snap.connections : [];
						for (const c of conns) {
							_.graph.functions.addConnection?.(c?.from?.nodeId, c?.from?.portId, c?.to?.nodeId, c?.to?.portId, { skipHistory: true });
						}

						_.graph.functions.requestRender?.();
						_.graph.functions.updateConnections?.();
					} finally {
						h.restoring = false;
					}
				},
				undo: async () => {
					const h = _.graph.data._history;
					if (!h || h.restoring) return;
					if ((h.undo || []).length === 0) return;

					const current = _.graph.functions._captureGraphSnapshot();
					h.redo.push(current);
					const prev = h.undo.pop();
					await _.graph.functions._restoreGraphSnapshot(prev);
				},
				redo: async () => {
					const h = _.graph.data._history;
					if (!h || h.restoring) return;
					if ((h.redo || []).length === 0) return;

					const current = _.graph.functions._captureGraphSnapshot();
					h.undo.push(current);
					const next = h.redo.pop();
					await _.graph.functions._restoreGraphSnapshot(next);
				},
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
				},
				deleteNode: (node) => {
					_.graph.functions._recordHistory?.();
					const nodeElement = _.graph.functions.validateNode(node);
					if (!nodeElement || nodeElement.length === 0) return;

					const nodeData = _.graph.data.nodes.find(n => n.element && n.element.is(nodeElement));
					const nodeId = nodeData?.id || nodeElement.attr('id');
					if (!nodeId) return;

					// If we're mid-wire drag from/to this node, cancel first.
					const drag = _.graph.data._connectionDrag;
					if (drag?.active && (drag.from?.nodeId === nodeId)) {
						_.graph.functions.cancelConnection();
					}

					// Remove any connections involving this node.
					const connections = _.graph.data.connections || [];
					if (connections.length > 0) {
						const kept = [];
						for (const conn of connections) {
							const matches = conn?.from?.nodeId === nodeId || conn?.to?.nodeId === nodeId;
							if (matches) {
								try { conn.element?.remove?.(); } catch { /* ignore */ }
							} else {
								kept.push(conn);
							}
						}
						_.graph.data.connections = kept;
					}

					// Remove node DOM.
					try {
						nodeElement.remove();
					} catch {
						// ignore
					}

					// Remove node from data.
					_.graph.data.nodes = (_.graph.data.nodes || []).filter(n => n.id !== nodeId);

					// Update wires/port state.
					_.graph.functions.updateConnections?.();
				},

				// --- Port connections (cubic bezier wires) ------------------------------
				_ensureWireLayer: () => {
					const vpEl = _.graph.data.elements.graphCanvasViewport.element;
					if (!vpEl) return null;

					// Patch render once so wires keep up with pan/zoom.
					if (!_.graph.data._wireRenderPatched) {
						const origRender = _.graph.functions.render;
						_.graph.functions.render = () => {
							origRender();
							_.graph.functions.updateConnections();
						};
						_.graph.data._wireRenderPatched = true;
					}

					if (_.graph.data._wireLayer?.svg) return _.graph.data._wireLayer;

					// Ensure viewport is a positioning context
					const vpStyle = window.getComputedStyle(vpEl);
					if (vpStyle.position === 'static') vpEl.style.position = 'relative';

					const svgNS = 'http://www.w3.org/2000/svg';
					const svg = document.createElementNS(svgNS, 'svg');
					svg.classList.add('wire-layer');
					svg.setAttribute('width', '100%');
					svg.setAttribute('height', '100%');
					svg.style.position = 'absolute';
					svg.style.left = '0';
					svg.style.top = '0';
					svg.style.right = '0';
					svg.style.bottom = '0';
					svg.style.pointerEvents = 'none';
					svg.style.overflow = 'visible';
					// Keep wires behind nodes (nodes live under graphCanvas).
					svg.style.zIndex = '0';

					const wiresGroup = document.createElementNS(svgNS, 'g');
					wiresGroup.setAttribute('data-role', 'wires');
					svg.appendChild(wiresGroup);

					const tempPath = document.createElementNS(svgNS, 'path');
					tempPath.setAttribute('data-role', 'temp');
					tempPath.setAttribute('fill', 'none');
					tempPath.setAttribute('stroke', '#7aa2ff');
					tempPath.setAttribute('stroke-width', '3');
					tempPath.setAttribute('stroke-linecap', 'round');
					tempPath.setAttribute('opacity', '0.9');
					tempPath.style.filter = 'drop-shadow(0 0 3px rgba(122,162,255,0.35))';
					tempPath.style.display = 'none';
					svg.appendChild(tempPath);

					// Insert before the graph canvas so nodes paint above wires.
					const canvasEl = _.graph.data.elements.graphCanvas.element;
					if (canvasEl && canvasEl.parentElement === vpEl) {
						vpEl.insertBefore(svg, canvasEl);
					} else {
						vpEl.appendChild(svg);
					}

					_.graph.data._wireLayer = { svg, wiresGroup, tempPath };
					return _.graph.data._wireLayer;
				},
				_getPortRole: (portEl) => {
					if (!portEl) return null;
					// Heuristic based on existing markup: .input/.output are on the row wrapper above ports
					const $p = $(portEl);
					if ($p.parent().parent().hasClass('input')) return 'input';
					if ($p.parent().parent().hasClass('output')) return 'output';
					// Fallbacks
					if ($p.closest('.input').length) return 'input';
					if ($p.closest('.output').length) return 'output';
					return null;
				},
				_isExecPortEl: (portEl) => {
					if (!portEl) return false;
					const typeNameRaw = _.graph.functions._getPortTypeName(null, null, portEl);
					const typeNorm = _.graph.functions._canonicalTypeName(typeNameRaw);
					if (typeNorm === 'exec') return true;

					const cls = portEl.classList;
					if (cls && (cls.contains('p-exec') || cls.contains('exec'))) return true;

					return false;
				},
				_isTransparentCssColor: (cssColor) => {
					if (!cssColor) return true;
					const c = String(cssColor).trim().toLowerCase();
					if (c === '' || c === 'transparent') return true;
					// Common "fully transparent" forms.
					if (c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)') return true;
					return false;
				},
				_colorWithAlpha: (cssColor, alpha) => {
					const a = Math.max(0, Math.min(1, Number(alpha)));
					const c = String(cssColor || '').trim();
					if (!c) return `rgba(183,199,255,${a})`;

					// rgb()/rgba()
					let m = c.match(/^rgba?\(([^)]+)\)$/i);
					if (m) {
						const parts = m[1].split(',').map(s => s.trim());
						if (parts.length >= 3) {
							const r = parts[0];
							const g = parts[1];
							const b = parts[2];
							return `rgba(${r}, ${g}, ${b}, ${a})`;
						}
					}

					// hex #rgb/#rrggbb
					m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
					if (m) {
						let hex = m[1];
						if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
						const r = parseInt(hex.slice(0, 2), 16);
						const g = parseInt(hex.slice(2, 4), 16);
						const b = parseInt(hex.slice(4, 6), 16);
						return `rgba(${r}, ${g}, ${b}, ${a})`;
					}

					// Fallback: can't reliably alpha-blend named colors here.
					return `rgba(183,199,255,${a})`;
				},
				_getPortColor: (portEl) => {
					if (!portEl) return null;
					const cs = window.getComputedStyle(portEl);
					const candidates = [
						cs.getPropertyValue('--port-color'),
						cs.backgroundColor,
						cs.borderTopColor,
						cs.color
					];
					for (const raw of candidates) {
						const c = String(raw || '').trim();
						if (!_.graph.functions._isTransparentCssColor(c)) return c;
					}
					return null;
				},
				_getWireStrokeForPorts: (fromPortEl, toPortEl) => {
					// Prefer the output-side port color if available.
					return _.graph.functions._getPortColor(fromPortEl) || _.graph.functions._getPortColor(toPortEl);
				},
				_normalizeTypeName: (typeName) => {
					if (typeName == null) return null;
					const s = String(typeName).trim();
					if (!s) return null;
					return s.toLowerCase();
				},
				_canonicalTypeName: (typeName) => {
					let s = _.graph.functions._normalizeTypeName(typeName);
					if (!s) return null;

					// Remove common decorations/containers.
					// Examples: "float (0-1)" -> "float", "List<float>" -> "list", "float?" -> "float"
					s = s.replace(/\s+/g, '');
					for (const sep of ['<', '(', '[', '{']) {
						const i = s.indexOf(sep);
						if (i >= 0) s = s.slice(0, i);
					}
					s = s.replace(/[?]/g, '');

					// If it's a namespaced type, keep the last segment.
					if (s.includes('.')) s = s.split('.').filter(Boolean).at(-1) || s;

					// Map common aliases to canonical names.
					const aliasMap = {
						'boolean': 'bool',
						'bool': 'bool',
						'int32': 'int',
						'int64': 'int',
						'integer': 'int',
						'int': 'int',
						'single': 'float',
						'float32': 'float',
						'float': 'float',
						'double': 'double',
						'float64': 'double',
						'number': 'float',
						'color': 'color',
						'string': 'string',
						'player': 'player',
						'exec': 'exec',
						'any': 'any',
						't': 't'
					};

					return aliasMap[s] || s;
				},
				_parseAllowedTypesFromTypeParam: (typeParamString) => {
					if (!typeParamString) return [];
					let s = String(typeParamString).trim();
					// Common formats: "(float, int)", "float|int", "float, int"
					s = s.replace(/[()\[\]{}]/g, '');
					const out = [];
					for (const part of s.split(/[,|]/g)) {
						const t = _.graph.functions._canonicalTypeName(part);
						if (!t) continue;
						if (!out.includes(t)) out.push(t);
					}
					return out;
				},
				_getPortMeta: (nodeId, portId) => {
					if (!nodeId || !portId) return null;
					const nodeData = (_.graph.data.nodes || []).find(n => n.id === nodeId);
					const nodeDescs = nodeData?.object?.nodeDescs;
					if (!Array.isArray(nodeDescs)) return null;

					for (const desc of nodeDescs) {
						const inputs = Array.isArray(desc?.inputs) ? desc.inputs : [];
						for (const p of inputs) {
							if (p?.portId === portId) return { nodeDesc: desc, port: p, dir: 'input' };
						}
						const outputs = Array.isArray(desc?.outputs) ? desc.outputs : [];
						for (const p of outputs) {
							if (p?.portId === portId) return { nodeDesc: desc, port: p, dir: 'output' };
						}
					}

					return null;
				},
				_getPortTypeName: (nodeId, portId, portEl) => {
					const meta = _.graph.functions._getPortMeta(nodeId, portId);
					const t0 = meta?.port?.type;
					if (t0 != null && String(t0).trim() !== '') return String(t0);

					// Try DOM attributes / dataset on the port element (or nearby wrappers).
					const candidates = [];
					const push = (el) => {
						if (!el) return;
						if (!candidates.includes(el)) candidates.push(el);
					};
					push(portEl);
					// If we were passed a wrapper (e.g. .port-container), try to find the actual .port.
					if (portEl && portEl !== document && portEl !== window) {
						push(portEl.querySelector?.('.port'));
						push(portEl.closest?.('.port'));
						const pc = portEl.closest?.('.port-container');
						push(pc);
						push(pc?.querySelector?.('.port'));
						push(portEl.parentElement);
					}

					const attrNames = ['porttype', 'portType', 'data-porttype', 'data-portType', 'type', 'data-type'];
					for (const el of candidates) {
						for (const name of attrNames) {
							const v = (el?.getAttribute && el.getAttribute(name)) || null;
							if (v != null && String(v).trim() !== '') return String(v);
						}
						const dv = el?.dataset?.porttype ?? el?.dataset?.portType ?? el?.dataset?.type;
						if (dv != null && String(dv).trim() !== '') return String(dv);
					}

					// Fallback: infer from CSS classes used by the chip renderer.
					for (const el of candidates) {
						const cls = el?.classList;
						if (!cls) continue;
						for (const c of cls) {
							if (typeof c === 'string' && c.startsWith('p-') && c.length > 2) {
								return c.slice(2);
							}
						}
					}

					return null;
				},
				_getAllowedTypeSetForPort: (nodeId, portId, portEl) => {
					const typeNameRaw = _.graph.functions._getPortTypeName(nodeId, portId, portEl);
					const typeNorm = _.graph.functions._canonicalTypeName(typeNameRaw);
					if (!typeNorm) {
						// Some ports (notably generic T ports in the current chip renderer) may expose
						// a constraint list directly in the DOM, e.g. "(float, int)".
						// Treat that as an allowed-type set.
						const raw = String(typeNameRaw || '').trim();
						const looksLikeList = raw.startsWith('(') || raw.includes(',') || raw.includes('|');
						if (looksLikeList) {
							const allowed = _.graph.functions._parseAllowedTypesFromTypeParam(raw);
							// If the constraint itself includes "any", treat as a wildcard.
							if (allowed.includes('any')) return { wildcard: true, set: null };
							if (allowed.length > 0) return { wildcard: false, set: new Set(allowed) };
						}
						return null;
					}

					// Exec is handled as a concrete, single-type set.
					if (typeNorm === 'exec') return { wildcard: false, set: new Set(['exec']) };

					// "any" is always a true wildcard (exec is handled separately above).
					if (typeNorm === 'any') return { wildcard: true, set: null };

					const meta = _.graph.functions._getPortMeta(nodeId, portId);
					const typeParams = Array.isArray(meta?.nodeDesc?.typeParams) ? meta.nodeDesc.typeParams : [];

					// If this port is a generic type param (e.g. "T"), constrain by its typeParam list.
					let param = typeParams.find(tp => _.graph.functions._canonicalTypeName(tp?.name) === typeNorm) || null;
					if (!param && typeNorm === 't' && typeParams.length === 1) {
						param = typeParams[0];
					}

					if (param) {
						const allowed = _.graph.functions._parseAllowedTypesFromTypeParam(param.type);
						// A type-param constraint of "any" means unconstrained.
						if (allowed.includes('any')) return { wildcard: true, set: null };
						if (allowed.length === 0) return { wildcard: true, set: null };
						return { wildcard: false, set: new Set(allowed) };
					}

					// Unconstrained generic (e.g. "T" without typeParams) behaves like a wildcard.
					if (typeNorm === 't') return { wildcard: true, set: null };

					// Concrete type: must match exactly.
					return { wildcard: false, set: new Set([typeNorm]) };
				},
				_areTypesCompatible: (fromInfo, toInfo) => {
					if (!fromInfo || !toInfo) return false;
					if (fromInfo.wildcard || toInfo.wildcard) return true;
					if (!fromInfo.set || !toInfo.set) return false;
					for (const t of fromInfo.set) {
						if (toInfo.set.has(t)) return true;
					}
					return false;
				},
				_getTypeParamForPort: (nodeId, portId, portEl) => {
					const typeNameRaw = _.graph.functions._getPortTypeName(nodeId, portId, portEl);
					const typeNorm = _.graph.functions._canonicalTypeName(typeNameRaw);
					if (!typeNorm) return null;

					const meta = _.graph.functions._getPortMeta(nodeId, portId);
					const typeParams = Array.isArray(meta?.nodeDesc?.typeParams) ? meta.nodeDesc.typeParams : [];
					let param = typeParams.find(tp => _.graph.functions._canonicalTypeName(tp?.name) === typeNorm) || null;
					if (!param && typeNorm === 't' && typeParams.length === 1) {
						param = typeParams[0];
					}
					return param;
				},
				_isColorAdaptivePort: (nodeId, portId, portEl) => {
					const typeNameRaw = _.graph.functions._getPortTypeName(nodeId, portId, portEl);
					const typeNorm = _.graph.functions._canonicalTypeName(typeNameRaw);
					if (!typeNorm) {
						const raw = String(typeNameRaw || '').trim();
						const looksLikeList = raw.startsWith('(') || raw.includes(',') || raw.includes('|');
						if (looksLikeList) return true;
						return false;
					}
					if (typeNorm === 'exec') return false;
					if (typeNorm === 'any') return true;
					// Generic ports like T (or any named type param) are also color-adaptive.
					return !!_.graph.functions._getTypeParamForPort(nodeId, portId, portEl);
				},
				_setAnyPortColorOverride: (portEl, color) => {
					if (!portEl || !color) return;
					if (portEl.dataset.anyColorOverride !== '1') {
						portEl.dataset.anyPrevPortColor = portEl.style.getPropertyValue('--port-color') || '';
						portEl.dataset.anyPrevBg = portEl.style.getPropertyValue('background-color') || '';
						portEl.dataset.anyPrevBorder = portEl.style.getPropertyValue('border-color') || '';
						portEl.dataset.anyPrevColor = portEl.style.getPropertyValue('color') || '';
					}
					portEl.dataset.anyColorOverride = '1';
					portEl.style.setProperty('--port-color', color);
					// Also set explicit colors so it works even if CSS doesn't use --port-color.
					portEl.style.setProperty('background-color', color);
					portEl.style.setProperty('border-color', color);
					portEl.style.setProperty('color', color);
				},
				_clearAnyPortColorOverride: (portEl) => {
					if (!portEl) return;
					if (portEl.dataset.anyColorOverride !== '1') return;
					const prevPortColor = portEl.dataset.anyPrevPortColor ?? '';
					const prevBg = portEl.dataset.anyPrevBg ?? '';
					const prevBorder = portEl.dataset.anyPrevBorder ?? '';
					const prevColor = portEl.dataset.anyPrevColor ?? '';

					if (prevPortColor) portEl.style.setProperty('--port-color', prevPortColor);
					else portEl.style.removeProperty('--port-color');

					if (prevBg) portEl.style.setProperty('background-color', prevBg);
					else portEl.style.removeProperty('background-color');

					if (prevBorder) portEl.style.setProperty('border-color', prevBorder);
					else portEl.style.removeProperty('border-color');

					if (prevColor) portEl.style.setProperty('color', prevColor);
					else portEl.style.removeProperty('color');

					delete portEl.dataset.anyColorOverride;
					delete portEl.dataset.anyPrevPortColor;
					delete portEl.dataset.anyPrevBg;
					delete portEl.dataset.anyPrevBorder;
					delete portEl.dataset.anyPrevColor;
				},
				_updateAnyPortColorOverrides: () => {
					const prev = _.graph.data._anyPortColorOverrides || {};
					const next = {};

					const connections = _.graph.data.connections || [];
					for (const conn of connections) {
						const fromPortEl = _.graph.functions._findPortEl(conn.from?.nodeId, conn.from?.portId);
						const toPortEl = _.graph.functions._findPortEl(conn.to?.nodeId, conn.to?.portId);
						if (!fromPortEl || !toPortEl) continue;

						const fromIsAny = _.graph.functions._isColorAdaptivePort(conn.from.nodeId, conn.from.portId, fromPortEl);
						const toIsAny = _.graph.functions._isColorAdaptivePort(conn.to.nodeId, conn.to.portId, toPortEl);

						// Only override when exactly one side is a color-adaptive (any/generic) port.
						if (fromIsAny === toIsAny) continue;

						if (fromIsAny) {
							const c = _.graph.functions._getPortColor(toPortEl);
							if (!c) continue;
							const key = `${conn.from.nodeId}::${conn.from.portId}`;
							if (!(key in next)) next[key] = c;
						} else if (toIsAny) {
							const c = _.graph.functions._getPortColor(fromPortEl);
							if (!c) continue;
							const key = `${conn.to.nodeId}::${conn.to.portId}`;
							if (!(key in next)) next[key] = c;
						}
					}

					// Clear overrides no longer needed.
					for (const key of Object.keys(prev)) {
						if (key in next) continue;
						const [nodeId, portId] = key.split('::');
						const portEl = _.graph.functions._findPortEl(nodeId, portId);
						_.graph.functions._clearAnyPortColorOverride(portEl);
					}

					// Apply new/changed overrides.
					for (const key of Object.keys(next)) {
						if (prev[key] === next[key]) continue;
						const [nodeId, portId] = key.split('::');
						const portEl = _.graph.functions._findPortEl(nodeId, portId);
						_.graph.functions._setAnyPortColorOverride(portEl, next[key]);
					}

					_.graph.data._anyPortColorOverrides = next;
				},
				_updatePortConnectedClasses: () => {
					const prevSet = _.graph.data._connectedPortSet || new Set();
					const nextSet = new Set();

					const connections = _.graph.data.connections || [];
					for (const conn of connections) {
						const fromNodeId = conn.from?.nodeId;
						const fromPortId = conn.from?.portId;
						const toNodeId = conn.to?.nodeId;
						const toPortId = conn.to?.portId;
						if (!fromNodeId || !fromPortId || !toNodeId || !toPortId) continue;

						const fromPortEl = _.graph.functions._findPortEl(fromNodeId, fromPortId);
						const toPortEl = _.graph.functions._findPortEl(toNodeId, toPortId);

						if (fromPortEl) nextSet.add(`${fromNodeId}::${fromPortId}`);
						if (toPortEl) nextSet.add(`${toNodeId}::${toPortId}`);
					}

					const getContainer = (portEl) => portEl?.closest?.('.port-container') || portEl?.parentElement || null;

					// Remove class for ports no longer connected.
					for (const key of prevSet) {
						if (nextSet.has(key)) continue;
						const [nodeId, portId] = String(key).split('::');
						const portEl = _.graph.functions._findPortEl(nodeId, portId);
						if (portEl) {
							portEl.classList.remove('connected');
							getContainer(portEl)?.classList?.remove?.('connected');
						}
					}

					// Add class for newly connected ports.
					for (const key of nextSet) {
						if (prevSet.has(key)) continue;
						const [nodeId, portId] = String(key).split('::');
						const portEl = _.graph.functions._findPortEl(nodeId, portId);
						if (portEl) {
							portEl.classList.add('connected');
							getContainer(portEl)?.classList?.add?.('connected');
						}
					}

					_.graph.data._connectedPortSet = nextSet;
				},
				_getPortContainerEl: (portEl) => {
					return portEl?.closest?.('.port-container') || portEl?.parentElement || null;
				},
				_clearCannotConnectHover: () => {
					const prevKey = _.graph.data._cannotConnectHoverKey;
					if (!prevKey) return;
					const [nodeId, portId] = String(prevKey).split('::');
					const prevPortEl = _.graph.functions._findPortEl(nodeId, portId);
					if (prevPortEl) {
						prevPortEl.classList.remove('cannot-connect');
						_.graph.functions._getPortContainerEl(prevPortEl)?.classList?.remove?.('cannot-connect');
					}
					_.graph.data._cannotConnectHoverKey = null;
				},
				_canConnectPorts: (fromNodeId, fromPortId, toNodeId, toPortId) => {
					if (!fromNodeId || !fromPortId || !toNodeId || !toPortId) return false;
					if (fromNodeId === toNodeId && fromPortId === toPortId) return false;

					const fromPortEl0 = _.graph.functions._findPortEl(fromNodeId, fromPortId);
					const toPortEl0 = _.graph.functions._findPortEl(toNodeId, toPortId);
					if (!fromPortEl0 || !toPortEl0) return false;

					let from = { nodeId: fromNodeId, portId: fromPortId, role: _.graph.functions._getPortRole(fromPortEl0) };
					let to = { nodeId: toNodeId, portId: toPortId, role: _.graph.functions._getPortRole(toPortEl0) };

					// Normalize direction: output -> input
					if (from.role !== 'output' && to.role === 'output') {
						[from, to] = [to, from];
					}

					const fromPortEl = _.graph.functions._findPortEl(from.nodeId, from.portId);
					const toPortEl = _.graph.functions._findPortEl(to.nodeId, to.portId);
					if (!fromPortEl || !toPortEl) return false;

					from.role = _.graph.functions._getPortRole(fromPortEl);
					to.role = _.graph.functions._getPortRole(toPortEl);

					// Enforce output -> input if roles are known
					if (from.role && to.role && !(from.role === 'output' && to.role === 'input')) return false;

					// Enforce exec-only connections.
					const fromIsExec = _.graph.functions._isExecPortEl(fromPortEl);
					const toIsExec = _.graph.functions._isExecPortEl(toPortEl);
					if (fromIsExec !== toIsExec) return false;

					// Enforce type compatibility.
					const fromTypeInfo = _.graph.functions._getAllowedTypeSetForPort(from.nodeId, from.portId, fromPortEl);
					const toTypeInfo = _.graph.functions._getAllowedTypeSetForPort(to.nodeId, to.portId, toPortEl);
					if (!_.graph.functions._areTypesCompatible(fromTypeInfo, toTypeInfo)) return false;

					return true;
				},
				_updateCannotConnectHover: (clientX, clientY) => {
					const drag = _.graph.data._connectionDrag;
					if (!drag?.active) {
						_.graph.functions._clearCannotConnectHover();
						return;
					}

					const el = document.elementFromPoint(clientX, clientY);
					const portEl = el?.closest?.('.port');
					if (!portEl) {
						_.graph.functions._clearCannotConnectHover();
						return;
					}

					const nodeEl = portEl.closest?.('.chip');
					const toNodeId = nodeEl?.id;
					const toPortId = portEl.getAttribute?.('id');
					if (!toNodeId || !toPortId) {
						_.graph.functions._clearCannotConnectHover();
						return;
					}

					const nextKey = `${toNodeId}::${toPortId}`;
					const can = _.graph.functions._canConnectPorts(drag.from.nodeId, drag.from.portId, toNodeId, toPortId);
					const prevKey = _.graph.data._cannotConnectHoverKey;

					// If it can connect, ensure we clear any previous cannot-connect highlight.
					if (can) {
						if (prevKey) _.graph.functions._clearCannotConnectHover();
						return;
					}

					// It cannot connect: update highlight if the hovered target changed.
					if (prevKey && prevKey !== nextKey) {
						_.graph.functions._clearCannotConnectHover();
					}

					// Apply cannot-connect to the hovered port + its container.
					portEl.classList.add('cannot-connect');
					_.graph.functions._getPortContainerEl(portEl)?.classList?.add?.('cannot-connect');
					_.graph.data._cannotConnectHoverKey = nextKey;
				},
				_getWireStrokeWidth: () => {
					// Wires are drawn in viewport (screen) space, so scale width manually with zoom.
					const base = 5;
					const s = Number(_.graph.data.cameraState?.scale ?? 1);
					const w = base * (Number.isFinite(s) ? s : 1);
					return Math.max(1, Math.min(10, w));
				},
				_getPortType: (nodeId, portId) => {
					if (!nodeId || !portId) return null;

					const nodeData = (_.graph.data.nodes || []).find(n => n.id === nodeId);
					const nodeObj = nodeData?.object;
					const nodeDescs = nodeObj?.nodeDescs;
					if (!Array.isArray(nodeDescs)) return null;

					for (const desc of nodeDescs) {
						const inputs = Array.isArray(desc?.inputs) ? desc.inputs : [];
						for (const p of inputs) {
							if (p?.portId === portId) return p?.type ?? null;
						}

						const outputs = Array.isArray(desc?.outputs) ? desc.outputs : [];
						for (const p of outputs) {
							if (p?.portId === portId) return p?.type ?? null;
						}
					}

					return null;
				},
				_findPortEl: (nodeId, portId) => {
					const nodeEl = document.getElementById(nodeId);
					if (!nodeEl) return null;

					// NOTE: ids are not globally unique in the current node builder, so avoid #id selectors.
					const esc = (s) =>
						(window.CSS && typeof window.CSS.escape === 'function')
							? window.CSS.escape(s)
							: String(s).replace(/["\\]/g, '\\$&');

					return nodeEl.querySelector(`.port[id="${esc(portId)}"]`);
				},
				_getPortPointInViewport: (portEl) => {
					const vpEl = _.graph.data.elements.graphCanvasViewport.element;
					if (!vpEl || !portEl) return null;

					const vpRect = vpEl.getBoundingClientRect();
					const r = portEl.getBoundingClientRect();

					return {
						x: (r.left + r.right) * 0.5 - vpRect.left,
						y: (r.top + r.bottom) * 0.5 - vpRect.top
					};
				},
				_buildBezierPath: (p0, p1, side0 = 1, side1 = -1) => {
					// side: +1 means "pull control point to the right", -1 to the left
					const dx = Math.abs(p1.x - p0.x);
					const c = Math.max(60, dx * 0.5);

					const c1x = p0.x + c * side0;
					const c1y = p0.y;

					const c2x = p1.x + c * side1;
					const c2y = p1.y;

					return `M ${p0.x} ${p0.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1.x} ${p1.y}`;
				},
				updateConnections: () => {
					const layer = _.graph.functions._ensureWireLayer();
					if (!layer) return;

					const strokeWidth = _.graph.functions._getWireStrokeWidth();

					// Update any-port color overrides first so wire strokes reflect the new colors immediately.
					_.graph.functions._updateAnyPortColorOverrides();
					_.graph.functions._updatePortConnectedClasses();

					// Permanent wires
					(_.graph.data.connections || []).forEach((conn) => {
						const fromPortEl = _.graph.functions._findPortEl(conn.from.nodeId, conn.from.portId);
						const toPortEl = _.graph.functions._findPortEl(conn.to.nodeId, conn.to.portId);

						if (!fromPortEl || !toPortEl) {
							if (conn.element) conn.element.style.display = 'none';
							return;
						}

						const p0 = _.graph.functions._getPortPointInViewport(fromPortEl);
						const p1 = _.graph.functions._getPortPointInViewport(toPortEl);
						if (!p0 || !p1) return;

						const fromRole = _.graph.functions._getPortRole(fromPortEl);
						const toRole = _.graph.functions._getPortRole(toPortEl);

						// Color exec wires to match the exec port.
						const stroke = _.graph.functions._getWireStrokeForPorts(fromPortEl, toPortEl);
						if (stroke) {
							conn.element.setAttribute('stroke', stroke);
							conn.element.style.filter = `drop-shadow(0 0 4px ${_.graph.functions._colorWithAlpha(stroke, 0.35)})`;
						} else {
							conn.element.setAttribute('stroke', '#b7c7ff');
							conn.element.style.filter = 'drop-shadow(0 0 4px rgba(183,199,255,0.35))';
						}
						conn.element.setAttribute('stroke-width', String(strokeWidth));

						const side0 = fromRole === 'input' ? -1 : 1;
						const side1 = toRole === 'input' ? -1 : 1;

						conn.element.style.display = '';
						conn.element.setAttribute('d', _.graph.functions._buildBezierPath(p0, p1, side0, side1));
					});

					// Dragging (temp) wire
					const drag = _.graph.data._connectionDrag;
					if (!drag?.active) return;

					const fromPortEl = _.graph.functions._findPortEl(drag.from.nodeId, drag.from.portId);
					if (!fromPortEl) return;

					const p0 = _.graph.functions._getPortPointInViewport(fromPortEl);
					const p1 = drag.mouseVp;
					if (!p0 || !p1) return;

					const fromRole = _.graph.functions._getPortRole(fromPortEl);
					const side0 = fromRole === 'input' ? -1 : 1;
					const side1 = -side0;

					layer.tempPath.setAttribute('stroke-width', String(strokeWidth));
					layer.tempPath.setAttribute('d', _.graph.functions._buildBezierPath(p0, p1, side0, side1));
				},
				removeConnectionsForPort: (nodeId, portId, options = null) => {
					if (!nodeId || !portId) return;
					const skipHistory = !!options?.skipHistory;

					const connections = _.graph.data.connections || [];
					if (connections.length === 0) return;
					const willRemove = connections.some((conn) =>
						(conn.from?.nodeId === nodeId && conn.from?.portId === portId) ||
						(conn.to?.nodeId === nodeId && conn.to?.portId === portId)
					);
					if (!willRemove) return;
					if (!skipHistory) _.graph.functions._recordHistory?.();

					const kept = [];
					let removedAny = false;

					for (const conn of connections) {
						const matches =
							(conn.from?.nodeId === nodeId && conn.from?.portId === portId) ||
							(conn.to?.nodeId === nodeId && conn.to?.portId === portId);

						if (matches) {
							removedAny = true;
							try {
								conn.element?.remove?.();
							} catch {
								// ignore
							}
						} else {
							kept.push(conn);
						}
					}
					if (!removedAny) return;
					_.graph.data.connections = kept;
					_.graph.functions.updateConnections();
				},
				removeConnectionsFromPort: (nodeId, portId, options = null) => {
					if (!nodeId || !portId) return;
					const skipHistory = !!options?.skipHistory;

					const connections = _.graph.data.connections || [];
					if (connections.length === 0) return;
					const willRemove = connections.some((conn) => conn.from?.nodeId === nodeId && conn.from?.portId === portId);
					if (!willRemove) return;
					if (!skipHistory) _.graph.functions._recordHistory?.();

					const kept = [];
					let removedAny = false;

					for (const conn of connections) {
						const matches = conn.from?.nodeId === nodeId && conn.from?.portId === portId;
						if (matches) {
							removedAny = true;
							try {
								conn.element?.remove?.();
							} catch {
								// ignore
							}
						} else {
							kept.push(conn);
						}
					}
					if (!removedAny) return;
					_.graph.data.connections = kept;
					_.graph.functions.updateConnections();
				},
				removeConnectionsToPort: (nodeId, portId, options = null) => {
					if (!nodeId || !portId) return;
					const skipHistory = !!options?.skipHistory;

					const connections = _.graph.data.connections || [];
					if (connections.length === 0) return;
					const willRemove = connections.some((conn) => conn.to?.nodeId === nodeId && conn.to?.portId === portId);
					if (!willRemove) return;
					if (!skipHistory) _.graph.functions._recordHistory?.();

					const kept = [];
					let removedAny = false;

					for (const conn of connections) {
						const matches = conn.to?.nodeId === nodeId && conn.to?.portId === portId;
						if (matches) {
							removedAny = true;
							try {
								conn.element?.remove?.();
							} catch {
								// ignore
							}
						} else {
							kept.push(conn);
						}
					}
					if (!removedAny) return;
					_.graph.data.connections = kept;
					_.graph.functions.updateConnections();
				},
				addConnection: (fromNodeId, fromPortId, toNodeId, toPortId, options = null) => {
					if (!fromNodeId || !fromPortId || !toNodeId || !toPortId) return false;
					const skipHistory = !!options?.skipHistory;
					if (!skipHistory) _.graph.functions._historyBeginBatch?.();
					try {
						if (!skipHistory) _.graph.functions._recordHistory?.();

					const layer = _.graph.functions._ensureWireLayer();
					if (!layer) return false;

					const fromPortEl0 = _.graph.functions._findPortEl(fromNodeId, fromPortId);
					const toPortEl0 = _.graph.functions._findPortEl(toNodeId, toPortId);
					if (!fromPortEl0 || !toPortEl0) return false;

					let from = { nodeId: fromNodeId, portId: fromPortId, role: _.graph.functions._getPortRole(fromPortEl0) };
					let to = { nodeId: toNodeId, portId: toPortId, role: _.graph.functions._getPortRole(toPortEl0) };

					// Normalize direction: output -> input
					if (from.role !== 'output' && to.role === 'output') {
						[from, to] = [to, from];
					}

					const fromPortEl = _.graph.functions._findPortEl(from.nodeId, from.portId);
					const toPortEl = _.graph.functions._findPortEl(to.nodeId, to.portId);
					if (!fromPortEl || !toPortEl) return false;

					from.role = _.graph.functions._getPortRole(fromPortEl);
					to.role = _.graph.functions._getPortRole(toPortEl);
					if (from.role && to.role && !(from.role === 'output' && to.role === 'input')) return false;

					// No duplicate connections.
					if ((_.graph.data.connections || []).some(c => c?.from?.nodeId === from.nodeId && c?.from?.portId === from.portId && c?.to?.nodeId === to.nodeId && c?.to?.portId === to.portId)) {
						return false;
					}

					// Enforce exec-only connections.
					const fromIsExec = _.graph.functions._isExecPortEl(fromPortEl);
					const toIsExec = _.graph.functions._isExecPortEl(toPortEl);
					if (fromIsExec !== toIsExec) return false;

					// Enforce type compatibility.
					const fromTypeInfo = _.graph.functions._getAllowedTypeSetForPort(from.nodeId, from.portId, fromPortEl);
					const toTypeInfo = _.graph.functions._getAllowedTypeSetForPort(to.nodeId, to.portId, toPortEl);
					if (!_.graph.functions._areTypesCompatible(fromTypeInfo, toTypeInfo)) return false;

					// Enforce: data (non-exec) input ports can have only 1 incoming connection.
					if (to.role === 'input' && !toIsExec) {
						_.graph.functions.removeConnectionsToPort(to.nodeId, to.portId, { skipHistory: true });
					}

					// Enforce: exec output ports can have only 1 connection.
					if (from.role === 'output' && fromIsExec) {
						_.graph.functions.removeConnectionsFromPort(from.nodeId, from.portId, { skipHistory: true });
					}

					const svgNS = 'http://www.w3.org/2000/svg';
					const path = document.createElementNS(svgNS, 'path');
					path.setAttribute('fill', 'none');
					const stroke = _.graph.functions._getWireStrokeForPorts(fromPortEl, toPortEl) || '#b7c7ff';
					path.setAttribute('stroke', stroke);
					path.setAttribute('stroke-width', String(_.graph.functions._getWireStrokeWidth()));
					path.setAttribute('stroke-linecap', 'round');
					path.setAttribute('opacity', '0.95');
					path.style.filter = `drop-shadow(0 0 4px ${_.graph.functions._colorWithAlpha(stroke, 0.35)})`;
					layer.wiresGroup.appendChild(path);

					const connection = {
						id: 'connection-' + (_.graph.data.connections?.length || 0),
						from: { nodeId: from.nodeId, portId: from.portId },
						to: { nodeId: to.nodeId, portId: to.portId },
						element: path
					};
					if (!_.graph.data.connections) _.graph.data.connections = [];
					_.graph.data.connections.push(connection);
					_.graph.functions.updateConnections();
					return true;
					} finally {
						if (!skipHistory) _.graph.functions._historyEndBatch?.();
					}
				},
				startConnection: (fromNodeId, fromPortId, startEvent) => {
					const layer = _.graph.functions._ensureWireLayer();
					if (!layer) return;

					// Cancel any in-progress drag
					_.graph.functions.cancelConnection();

					const fromPortEl = _.graph.functions._findPortEl(fromNodeId, fromPortId);
					if (!fromPortEl) return;

					// Tint the temp wire to match the origin port (fallback to default).
					const tempStroke = _.graph.functions._getPortColor(fromPortEl) || '#7aa2ff';
					layer.tempPath.setAttribute('stroke', tempStroke);
					layer.tempPath.style.filter = `drop-shadow(0 0 3px ${_.graph.functions._colorWithAlpha(tempStroke, 0.35)})`;

					const hasExistingConnection = !!(_.graph.data.connections || []).some(
						(c) =>
							(c.from?.nodeId === fromNodeId && c.from?.portId === fromPortId) ||
							(c.to?.nodeId === fromNodeId && c.to?.portId === fromPortId)
					);

					// If this port already has a connection, don't flash a temp wire on click.
					// We'll show the temp wire only after the user actually drags.
					layer.tempPath.style.display = hasExistingConnection ? 'none' : '';

					const vpEl = _.graph.data.elements.graphCanvasViewport.element;
					const vpRect = vpEl.getBoundingClientRect();

					// Initialize the endpoint so the wire doesn't flash to the top-left.
					const fromP0 = _.graph.functions._getPortPointInViewport(fromPortEl);
					let initialMouseVp = fromP0 ? { x: fromP0.x, y: fromP0.y } : { x: 0, y: 0 };
					if (startEvent && typeof startEvent.clientX === 'number' && typeof startEvent.clientY === 'number') {
						initialMouseVp = {
							x: startEvent.clientX - vpRect.left,
							y: startEvent.clientY - vpRect.top
						};
					}

					const startClient = {
						x: (startEvent && typeof startEvent.clientX === 'number') ? startEvent.clientX : null,
						y: (startEvent && typeof startEvent.clientY === 'number') ? startEvent.clientY : null
					};

					const startPointerId = (startEvent && startEvent.pointerId != null) ? startEvent.pointerId : null;

					const drag = {
						active: true,
						from: { nodeId: fromNodeId, portId: fromPortId },
						mouseVp: initialMouseVp,
						hasExistingConnection,
						didMove: false,
						startClient,
						pointerId: startPointerId,
						handlers: {}
					};
					_.graph.data._connectionDrag = drag;

					drag.handlers.onMove = (e) => {
						if (!_.graph.data._connectionDrag?.active) return;
						if (drag.pointerId != null && e.pointerId != null && e.pointerId !== drag.pointerId) return;

						if (!drag.didMove && drag.startClient.x != null && drag.startClient.y != null) {
							const dx = e.clientX - drag.startClient.x;
							const dy = e.clientY - drag.startClient.y;
							if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
								drag.didMove = true;
								// Show temp wire now that it's a real drag gesture.
								if (layer.tempPath.style.display === 'none') layer.tempPath.style.display = '';
							}
						}

						drag.mouseVp = {
							x: e.clientX - vpRect.left,
							y: e.clientY - vpRect.top
						};
						_.graph.functions.updateConnections();
						_.graph.functions._updateCannotConnectHover(e.clientX, e.clientY);
					};

					drag.handlers.onUp = (e) => {
						if (!_.graph.data._connectionDrag?.active) return;
						if (drag.pointerId != null && e.pointerId != null && e.pointerId !== drag.pointerId) return;

						// If this was a simple click on a connected port (no drag), remove its connection(s).
						if (drag.hasExistingConnection && !drag.didMove) {
							const el = document.elementFromPoint(e.clientX, e.clientY);
							const portEl = el?.closest?.('.port');
							const nodeEl = portEl?.closest?.('.chip');
							const nodeId = nodeEl?.id;
							const portId = portEl?.getAttribute?.('id');

							if (nodeId === drag.from.nodeId && portId === drag.from.portId) {
								_.graph.functions.cancelConnection();
								_.graph.functions.removeConnectionsForPort(nodeId, portId);
								return;
							}
						}

						const el = document.elementFromPoint(e.clientX, e.clientY);
						const portEl = el?.closest?.('.port');

						if (!portEl) {
							_.graph.functions.cancelConnection();
							return;
						}

						const nodeEl = portEl.closest('.chip');
						const toNodeId = nodeEl?.id;
						const toPortId = portEl.getAttribute('id');

						if (!toNodeId || !toPortId) {
							_.graph.functions.cancelConnection();
							return;
						}

						_.graph.functions.finishConnection(toNodeId, toPortId);
					};

					drag.handlers.onCancel = (e) => {
						if (!_.graph.data._connectionDrag?.active) return;
						if (drag.pointerId != null && e?.pointerId != null && e.pointerId !== drag.pointerId) return;
						_.graph.functions.cancelConnection();
					};

					drag.handlers.onKey = (e) => {
						if (e.key === 'Escape') _.graph.functions.cancelConnection();
					};

					window.addEventListener('mousemove', drag.handlers.onMove, true);
					window.addEventListener('mouseup', drag.handlers.onUp, true);
					window.addEventListener('pointermove', drag.handlers.onMove, true);
					window.addEventListener('pointerup', drag.handlers.onUp, true);
					window.addEventListener('pointercancel', drag.handlers.onCancel, true);
					window.addEventListener('keydown', drag.handlers.onKey, true);

					// Initialize line immediately (only visible if tempPath is shown).
					_.graph.functions.updateConnections();
				},
				finishConnection: (toNodeId, toPortId) => {
					const drag = _.graph.data._connectionDrag;
					if (!drag?.active) return;

					const layer = _.graph.functions._ensureWireLayer();
					if (!layer) return;

					const fromPortEl = _.graph.functions._findPortEl(drag.from.nodeId, drag.from.portId);
					const toPortEl = _.graph.functions._findPortEl(toNodeId, toPortId);
					if (!fromPortEl || !toPortEl) {
						_.graph.functions.cancelConnection();
						return;
					}

					// Don’t connect a port to itself
					if (drag.from.nodeId === toNodeId && drag.from.portId === toPortId) {
						_.graph.functions.cancelConnection();
						return;
					}

					const fromRole0 = _.graph.functions._getPortRole(fromPortEl);
					const toRole0 = _.graph.functions._getPortRole(toPortEl);

					let from = { nodeId: drag.from.nodeId, portId: drag.from.portId, role: fromRole0 };
					let to = { nodeId: toNodeId, portId: toPortId, role: toRole0 };

					// Normalize direction: output -> input
					if (from.role !== 'output' && to.role === 'output') {
						[from, to] = [to, from];
					}

					// Re-resolve port elements after normalization (in case we swapped).
					const fromPortElN = _.graph.functions._findPortEl(from.nodeId, from.portId);
					const toPortElN = _.graph.functions._findPortEl(to.nodeId, to.portId);
					if (!fromPortElN || !toPortElN) {
						_.graph.functions.cancelConnection();
						return;
					}

					// Recompute roles post-normalization so subsequent rules are correct.
					from.role = _.graph.functions._getPortRole(fromPortElN);
					to.role = _.graph.functions._getPortRole(toPortElN);

					// Enforce output -> input if roles are known
					if (from.role && to.role && !(from.role === 'output' && to.role === 'input')) {
						_.graph.functions.cancelConnection();
						return;
					}

					// Enforce: exec ports can only connect to exec ports.
					const fromIsExec = _.graph.functions._isExecPortEl(fromPortElN);
					const toIsExec = _.graph.functions._isExecPortEl(toPortElN);
					if (fromIsExec !== toIsExec) {
						_.graph.functions.cancelConnection();
						return;
					}

					// Enforce: non-exec ports can only connect to compatible types.
					const fromTypeInfo = _.graph.functions._getAllowedTypeSetForPort(from.nodeId, from.portId, fromPortElN);
					const toTypeInfo = _.graph.functions._getAllowedTypeSetForPort(to.nodeId, to.portId, toPortElN);
					if (!_.graph.functions._areTypesCompatible(fromTypeInfo, toTypeInfo)) {
						_.graph.functions.cancelConnection();
						return;
					}

					// Create/overwrite is a single undo step.
					_.graph.functions._historyBeginBatch?.();
					try {
						_.graph.functions._recordHistory?.();

						// Enforce: data (non-exec) input ports can have only 1 incoming connection.
					// New connection overwrites the old incoming connection.
					if (to.role === 'input' && !toIsExec) {
						_.graph.functions.removeConnectionsToPort(to.nodeId, to.portId, { skipHistory: true });
					}

					// Enforce: exec output ports can have only 1 connection. New connection overwrites old.
					// Exec input ports can have multiple connections.
					if (from.role === 'output' && _.graph.functions._isExecPortEl(fromPortElN)) {
						_.graph.functions.removeConnectionsFromPort(from.nodeId, from.portId, { skipHistory: true });
					}

					const svgNS = 'http://www.w3.org/2000/svg';
					const path = document.createElementNS(svgNS, 'path');
					path.setAttribute('fill', 'none');
					const stroke = _.graph.functions._getWireStrokeForPorts(fromPortElN, toPortElN) || '#b7c7ff';
					path.setAttribute('stroke', stroke);
					path.setAttribute('stroke-width', String(_.graph.functions._getWireStrokeWidth()));
					path.setAttribute('stroke-linecap', 'round');
					path.setAttribute('opacity', '0.95');
					path.style.filter = `drop-shadow(0 0 4px ${_.graph.functions._colorWithAlpha(stroke, 0.35)})`;

					layer.wiresGroup.appendChild(path);

					const connection = {
						id: 'connection-' + (_.graph.data.connections?.length || 0),
						from: { nodeId: from.nodeId, portId: from.portId },
						to: { nodeId: to.nodeId, portId: to.portId },
						element: path
					};

					if (!_.graph.data.connections) _.graph.data.connections = [];
					_.graph.data.connections.push(connection);

					_.graph.functions.cancelConnection(); // clears temp + handlers
					_.graph.functions.updateConnections();
					} finally {
						_.graph.functions._historyEndBatch?.();
					}
				},
				cancelConnection: () => {
					const layer = _.graph.data._wireLayer;
					const drag = _.graph.data._connectionDrag;

					if (layer?.tempPath) {
						layer.tempPath.style.display = 'none';
						layer.tempPath.removeAttribute('d');
					}

					if (drag?.handlers) {
						window.removeEventListener('mousemove', drag.handlers.onMove, true);
						window.removeEventListener('mouseup', drag.handlers.onUp, true);
						window.removeEventListener('pointermove', drag.handlers.onMove, true);
						window.removeEventListener('pointerup', drag.handlers.onUp, true);
						window.removeEventListener('pointercancel', drag.handlers.onCancel, true);
						window.removeEventListener('keydown', drag.handlers.onKey, true);
					}

					_.graph.functions._clearCannotConnectHover();

					_.graph.data._connectionDrag = null;
				},
				_bindPortConnectionDelegation: () => {
					if (_.graph.data._portConnectionBound) return;

					const canvasEl = _.graph.data.elements.graphCanvas.element;
					if (!canvasEl) return;

					_.graph.data._portConnectionBound = true;

					const startFromPortEl = (portEl, e) => {
						if (!portEl) return;
						const nodeEl = portEl.closest('.chip');
						if (!nodeEl?.id) return;
						const portId = portEl.getAttribute('id');
						if (!portId) return;
						_.graph.functions.startConnection(nodeEl.id, portId, e);
					};

					// Pointer-first (mobile + modern desktop). Use capture so we win before node handlers.
					canvasEl.addEventListener(
						'pointerdown',
						(e) => {
							const portEl = e.target?.closest?.('.port');
							if (!portEl) return;
							if (e.pointerType === 'mouse' && e.button !== 0) return; // left mouse only
							e.preventDefault();
							e.stopPropagation();
							startFromPortEl(portEl, e);
						},
						{ capture: true, passive: false }
					);

					// Fallback for older browsers: mouse.
					$(canvasEl).on('mousedown.portConnect', '.port', function (e) {
						if (window.PointerEvent) return;
						if (e.which !== 1) return; // left button only
						e.preventDefault();
						e.stopPropagation();
						startFromPortEl(this, e);
					});
				}
			},
			load: {
				elements: async () => {
					// Bind delegated port handlers once elements exist (after this function finishes).
					queueMicrotask(() => _.graph.functions._bindPortConnectionDelegation());

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
					touchPanAndPinchZoom: async () => {
						const vpEl = _.graph.data.elements.graphCanvasViewport.element;
						if (!vpEl) return;

						// Prevent the browser from hijacking touch gestures (scroll/zoom).
						vpEl.style.touchAction = 'none';
						vpEl.style.webkitUserSelect = 'none';

						const pointers = new Map(); // pointerId -> { x, y }
						let pinch = null; // { startDist, startScale, world, rect }

						const isInteractiveTarget = (t) => {
							if (!t) return false;
							return !!(t.closest?.('.chip') || t.closest?.('.port'));
						};

						const getTwoPointers = () => {
							const arr = Array.from(pointers.values());
							if (arr.length < 2) return null;
							return [arr[0], arr[1]];
						};

						const dist = (a, b) => {
							const dx = a.x - b.x;
							const dy = a.y - b.y;
							return Math.sqrt(dx * dx + dy * dy);
						};

						const midpoint = (a, b) => ({ x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 });

						const stopPan = () => {
							_.graph.data.cameraState.dragging = false;
							vpEl.classList.remove('grabbing');
						};

						vpEl.addEventListener(
							'pointerdown',
							(e) => {
								// This handler is for touch/pen only.
								if (e.pointerType === 'mouse') return;
								if (isInteractiveTarget(e.target)) return;
								e.preventDefault();

								pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
								try { vpEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }

								if (pointers.size === 1) {
									// Start single-finger pan.
									_.graph.data.cameraState.dragging = true;
									_.graph.data.cameraState.lastX = e.clientX;
									_.graph.data.cameraState.lastY = e.clientY;
									vpEl.classList.add('grabbing');
									pinch = null;
								}

								if (pointers.size === 2) {
									// Start pinch zoom.
									const two = getTwoPointers();
									if (!two) return;
									const [p0, p1] = two;
									const rect = vpEl.getBoundingClientRect();
									const mid = midpoint(p0, p1);
									const mx = mid.x - rect.left;
									const my = mid.y - rect.top;
									const world = _.graph.functions.screenToWorld(mx, my);

									pinch = {
										startDist: Math.max(1, dist(p0, p1)),
										startScale: _.graph.data.cameraState.scale,
										world
									};
									vpEl.classList.add('grabbing');
									_.graph.data.cameraState.dragging = false;
								}
							},
							{ passive: false }
						);

						vpEl.addEventListener(
							'pointermove',
							(e) => {
								if (e.pointerType === 'mouse') return;
								if (!pointers.has(e.pointerId)) return;
								e.preventDefault();

								pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

								// Pinch takes precedence.
								if (pointers.size >= 2 && pinch) {
									const two = getTwoPointers();
									if (!two) return;
									const [p0, p1] = two;

									const rect = vpEl.getBoundingClientRect();
									const mid = midpoint(p0, p1);
									const mx = mid.x - rect.left;
									const my = mid.y - rect.top;

									const zoomFactor = dist(p0, p1) / pinch.startDist;
									const newScale = _.graph.functions.clamp(
										pinch.startScale * zoomFactor,
										_.graph.data.cameraState.minScale,
										_.graph.data.cameraState.maxScale
									);

									_.graph.data.cameraState.scale = newScale;
									// Keep the same world point under the midpoint.
									_.graph.data.cameraState.tx = mx - pinch.world.x * newScale;
									_.graph.data.cameraState.ty = my - pinch.world.y * newScale;

									_.graph.functions.requestRender();
									return;
								}

								// Single-finger pan.
								if (_.graph.data.cameraState.dragging) {
									const dx = e.clientX - _.graph.data.cameraState.lastX;
									const dy = e.clientY - _.graph.data.cameraState.lastY;
									_.graph.data.cameraState.lastX = e.clientX;
									_.graph.data.cameraState.lastY = e.clientY;
									_.graph.data.cameraState.tx += dx;
									_.graph.data.cameraState.ty += dy;
									_.graph.functions.requestRender();
								}
							},
							{ passive: false }
						);

						const onPointerUpLike = (e) => {
							if (e.pointerType === 'mouse') return;
							if (!pointers.has(e.pointerId)) return;
							pointers.delete(e.pointerId);

							if (pointers.size === 0) {
								pinch = null;
								stopPan();
								return;
							}

							// Transition from pinch to pan with the remaining finger.
							if (pointers.size === 1) {
								pinch = null;
								const only = Array.from(pointers.values())[0];
								_.graph.data.cameraState.dragging = true;
								_.graph.data.cameraState.lastX = only.x;
								_.graph.data.cameraState.lastY = only.y;
								vpEl.classList.add('grabbing');
							}
						};

						vpEl.addEventListener('pointerup', onPointerUpLike, { passive: true });
						vpEl.addEventListener('pointercancel', onPointerUpLike, { passive: true });
					},
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
				add: async (node, options = null) => {
					const skipHistory = !!options?.skipHistory;
					if (!skipHistory) _.graph.functions._recordHistory?.();
					let nodeData = await chip.render(null, node, { log: false, autoFit: false });
					console.log(nodeData.object);
					if (nodeData.html) {
						let nodeId = String(options?.id || '');
						if (!nodeId) {
							const idNum = Number.isFinite(Number(_.graph.data._nextNodeId)) ? Number(_.graph.data._nextNodeId) : (_.graph.data.nodes.length || 0);
							_.graph.data._nextNodeId = idNum + 1;
							nodeId = 'node-' + idNum;
						} else {
							const m = nodeId.match(/^node-(\d+)$/);
							if (m) _.graph.data._nextNodeId = Math.max(Number(_.graph.data._nextNodeId || 0), Number(m[1]) + 1);
						}
						nodeData.html = nodeData.html.replace('class="chip', 'id="' + nodeId + '" class="chip');

						// Give every port a unique id for connections to reference
						const tempContainer = $('<div>' + nodeData.html + '</div>');
						const chipDescs = tempContainer.find('.section');
						tempContainer.find('.port').each(function (index) {
							const portEl = this;
							const $port = $(portEl);
							const portId = 'port-' + index;
							$port.attr('id', portId);

							// Map this DOM port to its corresponding nodeDesc entry, if possible.
							const sectionEl = $port.closest('.section')[0];
							if (!sectionEl) return;

							const chipDescIndex = chipDescs.index(sectionEl);
							if (chipDescIndex < 0) return;

							const inInput = $port.closest('.input').length > 0;
							const inOutput = $port.closest('.output').length > 0;
							const portType = inInput ? 'inputs' : (inOutput ? 'outputs' : null);
							if (!portType) return;

							const nodeDesc = nodeData.object?.nodeDescs?.[chipDescIndex];
							if (!nodeDesc) return;

							const portsInSection = $(sectionEl).find(inInput ? '.input .port' : '.output .port');
							const portIndex = portsInSection.index(portEl);
							if (portIndex < 0) return;

							const chipDesc = nodeDesc?.[portType]?.[portIndex];
							if (!chipDesc) return;

							chipDesc.portId = portId;
						});
						nodeData.html = tempContainer.html();

						$(_.graph.data.elements.graphCanvas.element).append(nodeData.html);
						const nodeElement = $(_.graph.data.elements.graphCanvas.element).find('#' + nodeId);

						const nodeObject = {
							id: nodeId,
							element: nodeElement,
							selected: false,
							object: nodeData.object
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

						// Ensure the deletion handler is installed.
						_.graph.node.setNodeDeletionHandler();
						// Ensure copy/paste handler is installed.
						_.graph.node.setCopyPasteHandler();
						// Ensure undo/redo handler is installed.
						_.graph.node.setUndoRedoHandler();

						return nodeObject;

					} else {
						console.warn('Failed to render chip for node:', node);
						return null;
					}
				},
				_copySelectedNodesToClipboard: () => {
					const selected = _.graph.functions.getSelectedNodes?.() || [];
					if (selected.length === 0) return false;

					const nodes = [];
					let minX = Infinity;
					let minY = Infinity;

					for (const n of selected) {
						const leftRaw = n?.element?.css?.('left');
						const topRaw = n?.element?.css?.('top');
						const x = Number.parseFloat(String(leftRaw || '0')) || 0;
						const y = Number.parseFloat(String(topRaw || '0')) || 0;

						minX = Math.min(minX, x);
						minY = Math.min(minY, y);

						nodes.push({
							oldId: n.id,
							payload: n.object ?? null,
							x,
							y
						});
					}

					const selectedSet = new Set(selected.map(n => n.id));
					const connections = (_.graph.data.connections || [])
						.filter(c => selectedSet.has(c?.from?.nodeId) && selectedSet.has(c?.to?.nodeId))
						.map(c => ({
							fromNodeId: c.from.nodeId,
							fromPortId: c.from.portId,
							toNodeId: c.to.nodeId,
							toPortId: c.to.portId
						}));

					_.graph.data._nodeClipboard = {
						createdAt: Date.now(),
						nodes: nodes.map(n => ({
							oldId: n.oldId,
							payload: n.payload,
							relX: n.x - minX,
							relY: n.y - minY
						})),
						connections
					};

					return true;
				},
				_pasteClipboard: async () => {
					const h = _.graph.data._history;
					try {
						return await (async () => {
							const clip = _.graph.data._nodeClipboard;
							if (!clip || !Array.isArray(clip.nodes) || clip.nodes.length === 0) return false;

							const vpEl = _.graph.data.elements.graphCanvasViewport.element;
							if (!vpEl) return false;

							// Paste near viewport center, with a small incremental offset.
							_.graph.functions._historyBeginBatch?.();
							// Record a single undo step for the whole paste.
							_.graph.functions._recordHistory?.();
							const centerX = (vpEl.clientWidth * 0.5 - _.graph.data.cameraState.tx) / _.graph.data.cameraState.scale;
							const centerY = (vpEl.clientHeight * 0.5 - _.graph.data.cameraState.ty) / _.graph.data.cameraState.scale;
							const serial = Number(_.graph.data._pasteSerial || 0) + 1;
							_.graph.data._pasteSerial = serial;
							const delta = 20 * serial;
							const baseX = centerX + delta;
							const baseY = centerY + delta;

							// Deselect existing nodes so pasted nodes become the active selection.
							for (const n of (_.graph.data.nodes || [])) {
								if (n?.selected) _.graph.functions.deselectNode(n.element);
							}

							const idMap = new Map();
							const newIds = [];

							for (const n of clip.nodes) {
								const payload = n.payload ?? null;
								const addArg = payload?.chipName ? payload.chipName : payload;
								const created = await _.graph.node.add(addArg, { skipHistory: true });
								if (!created?.id) continue;

								idMap.set(n.oldId, created.id);
								newIds.push(created.id);

								await _.graph.node.setPosition(created.id, baseX + (Number(n.relX) || 0), baseY + (Number(n.relY) || 0));
							}

							for (const c of (clip.connections || [])) {
								const fromNodeId = idMap.get(c.fromNodeId);
								const toNodeId = idMap.get(c.toNodeId);
								if (!fromNodeId || !toNodeId) continue;
								_.graph.functions.addConnection?.(fromNodeId, c.fromPortId, toNodeId, c.toPortId, { skipHistory: true });
							}

							for (const id of newIds) {
								_.graph.functions.selectNode(id);
							}

							_.graph.functions.updateConnections?.();
							return true;
						})();
					} finally {
						if (h) _.graph.functions._historyEndBatch?.();
					}
				},
				setCopyPasteHandler: () => {
					if (_.graph.data._copyPasteHandlerInstalled) return;
					_.graph.data._copyPasteHandlerInstalled = true;

					const handler = (e) => {
						// Don't interfere while dragging a connection.
						if (_.graph.data._connectionDrag?.active) return;

						// Ignore while typing in inputs.
						const ae = document.activeElement;
						const tag = String(ae?.tagName || '').toLowerCase();
						const isTyping = tag === 'input' || tag === 'textarea' || ae?.isContentEditable;
						if (isTyping) return;

						const ctrlOrCmd = !!(e.ctrlKey || e.metaKey);
						if (!ctrlOrCmd) return;

						const key = String(e.key || '').toLowerCase();
						if (key !== 'c' && key !== 'v' && key !== 'x') return;

						if (key === 'c') {
							const did = _.graph.node._copySelectedNodesToClipboard();
							if (!did) return;
							e.preventDefault();
							e.stopPropagation();
							return;
						}

						if (key === 'x') {
							const did = _.graph.node._copySelectedNodesToClipboard();
							if (!did) return;
							e.preventDefault();
							e.stopPropagation();
							const selected = _.graph.functions.getSelectedNodes?.() || [];
							const ids = selected.map(n => n.id);
							for (const id of ids) _.graph.functions.deleteNode(id);
							return;
						}

						// Paste
						if (!_.graph.data._nodeClipboard) return;
						e.preventDefault();
						e.stopPropagation();
						Promise.resolve(_.graph.node._pasteClipboard()).catch(() => { /* ignore */ });
					};

					window.addEventListener('keydown', handler, true);
					_.graph.data._copyPasteHandler = handler;
				},
				setUndoRedoHandler: () => {
					if (_.graph.data._undoRedoHandlerInstalled) return;
					_.graph.data._undoRedoHandlerInstalled = true;

					const handler = (e) => {
						// Don't interfere while dragging a connection.
						if (_.graph.data._connectionDrag?.active) return;

						// Ignore while typing in inputs.
						const ae = document.activeElement;
						const tag = String(ae?.tagName || '').toLowerCase();
						const isTyping = tag === 'input' || tag === 'textarea' || ae?.isContentEditable;
						if (isTyping) return;

						const ctrlOrCmd = !!(e.ctrlKey || e.metaKey);
						if (!ctrlOrCmd) return;

						const key = String(e.key || '').toLowerCase();
						const isZ = key === 'z';
						const isY = key === 'y';
						if (!isZ && !isY) return;

						e.preventDefault();
						e.stopPropagation();

						if (isY || (isZ && e.shiftKey)) {
							Promise.resolve(_.graph.functions.redo?.()).catch(() => { /* ignore */ });
							return;
						}

						Promise.resolve(_.graph.functions.undo?.()).catch(() => { /* ignore */ });
					};

					window.addEventListener('keydown', handler, true);
					_.graph.data._undoRedoHandler = handler;
				},
				setNodeDeletionHandler: () => {
					if (_.graph.data._nodeDeletionHandlerInstalled) return;
					_.graph.data._nodeDeletionHandlerInstalled = true;

					const handler = (e) => {
						// Don't interfere while dragging a connection.
						if (_.graph.data._connectionDrag?.active) return;

						const key = String(e.key || '');
						if (key !== 'Backspace' && key !== 'Delete') return;

						// Ignore while typing in inputs.
						const ae = document.activeElement;
						const tag = String(ae?.tagName || '').toLowerCase();
						const isTyping = tag === 'input' || tag === 'textarea' || ae?.isContentEditable;
						if (isTyping) return;

						const selected = _.graph.functions.getSelectedNodes?.() || [];
						if (selected.length === 0) return;

						// Prevent browser back navigation / default delete behavior.
						e.preventDefault();
						e.stopPropagation();

						// Copy list before mutating underlying arrays.
						const toDelete = selected.map(n => n.id);
						for (const nodeId of toDelete) {
							_.graph.functions.deleteNode(nodeId);
						}
					};

					window.addEventListener('keydown', handler, true);
					_.graph.data._nodeDeletionHandler = handler;
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

						// Keep wires in sync with node motion.
						if (_.graph.functions.updateConnections) {
							_.graph.functions.updateConnections();
						}
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
					let dragHistoryRecorded = false;

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
						if (window.PointerEvent) return;
						if (e.which !== 1) return; // Only left mouse button

						// If the gesture started on a port, let the port connection system handle it.
						const dragTarget = e.target;
						if (dragTarget?.closest?.('.port')) return;

						e.preventDefault();
						if (!dragHistoryRecorded) {
							_.graph.functions._recordHistory?.();
							dragHistoryRecorded = true;
						}

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
						$(window).off('mousemove.nodeDrag mouseup.nodeDrag pointermove.nodeDrag pointerup.nodeDrag pointercancel.nodeDrag');

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
							dragHistoryRecorded = false;
							dragNodes.forEach(el => el.removeClass('grabbing'));

							dragNodes = [];
							grabOffsets.clear();

							$(window).off('mousemove.nodeDrag mouseup.nodeDrag pointermove.nodeDrag pointerup.nodeDrag pointercancel.nodeDrag');
						});
					});

					// Pointer-based dragging (touch + pen + mouse).
					nodeElement.on('pointerdown', function (e) {
						if (e.pointerType === 'mouse' && e.button !== 0) return;
						// If the gesture started on a port, let the port connection system handle it.
						const dragTarget = e.target;
						if (dragTarget?.closest?.('.port')) return;

						e.preventDefault();
						if (!dragHistoryRecorded) {
							_.graph.functions._recordHistory?.();
							dragHistoryRecorded = true;
						}
						isDragging = true;
						const activePointerId = e.pointerId;
						try { nodeElement[0].setPointerCapture(activePointerId); } catch { /* ignore */ }

						const grabbedIsSelected = nodeElement.hasClass('selected');
						if (grabbedIsSelected) {
							dragNodes = _.graph.functions
								.getSelectedNodes()
								.map(n => n.element)
								.filter(el => el && el.length > 0);
							if (!dragNodes.some(el => el.is(nodeElement))) dragNodes.push(nodeElement);
						} else {
							dragNodes = [nodeElement];
						}

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

						const parent = nodeElement.parent();
						dragNodes.forEach(el => el.appendTo(parent));

						$(window).off('pointermove.nodeDrag pointerup.nodeDrag pointercancel.nodeDrag');
						$(window).on('pointermove.nodeDrag', function (ev) {
							if (!isDragging) return;
							if (ev.pointerId !== activePointerId) return;
							const mouseWorld = getMouseWorld(ev.clientX, ev.clientY);
							dragNodes.forEach(el => {
								const off = grabOffsets.get(el[0]);
								if (!off) return;
								_.graph.node.setPosition(el, mouseWorld.x - off.dx, mouseWorld.y - off.dy);
							});
						});

						const endDrag = (ev) => {
							if (!isDragging) return;
							if (ev && ev.pointerId != null && ev.pointerId !== activePointerId) return;
							isDragging = false;
							dragHistoryRecorded = false;
							dragNodes.forEach(el => el.removeClass('grabbing'));
							dragNodes = [];
							grabOffsets.clear();
							$(window).off('pointermove.nodeDrag pointerup.nodeDrag pointercancel.nodeDrag');
						};
						$(window).on('pointerup.nodeDrag pointercancel.nodeDrag', endDrag);
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
							if (window.PointerEvent) return;
							if (e.button !== 0) return; // left button only

							// If the gesture started on a port, let the port connection system handle it.
							const selectTarget = e.target;
							if (selectTarget?.closest?.('.port')) return;

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

					domEl.addEventListener(
						'pointerdown',
						(e) => {
							if (e.pointerType === 'mouse' && e.button !== 0) return;
							// If the gesture started on a port, let the port connection system handle it.
							const selectTarget = e.target;
							if (selectTarget?.closest?.('.port')) return;

							const isMultiSelect = e.ctrlKey || e.metaKey;
							const nodeData = _.graph.data.nodes.find(n => n.element && n.element.is(nodeElement));

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
						true
					);

					nodeElement.on('mousedown', function (e) {
						if (window.PointerEvent) return;
						if (e.which !== 1) return; // left mouse button only

						// If the gesture started on a port, don't stop propagation; let the delegated port handler run.
						const selectTarget = e.target;
						if (selectTarget?.closest?.('.port')) return;

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

					nodeElement.on('pointerdown', function (e) {
						if (e.pointerType === 'mouse' && e.button !== 0) return;
						const selectTarget = e.target;
						if (selectTarget?.closest?.('.port')) return;
						e.stopPropagation();
						e.preventDefault();

						const isMultiSelect = e.ctrlKey || e.metaKey;
						const startX = e.clientX;
						const startY = e.clientY;
						let moved = false;
						const activePointerId = e.pointerId;

						$(window).off('pointermove.nodeSelect pointerup.nodeSelect pointercancel.nodeSelect');
						$(window).on('pointermove.nodeSelect', function (ev) {
							if (ev.pointerId !== activePointerId) return;
							if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) moved = true;
						});

						const endSelect = (ev) => {
							if (ev && ev.pointerId != null && ev.pointerId !== activePointerId) return;
							$(window).off('pointermove.nodeSelect pointerup.nodeSelect pointercancel.nodeSelect');
							if (moved) {
								preselectedOnDown = false;
								return;
							}

							const nodeData = _.graph.data.nodes.find(n => n.element && n.element.is(nodeElement));
							if (!isMultiSelect) {
								_.graph.data.nodes.forEach(n => {
									if (n.element && !n.element.is(nodeElement)) _.graph.functions.deselectNode(n.element);
								});
								_.graph.functions.selectNode(nodeElement);
							} else {
								if (!preselectedOnDown) {
									if (nodeData?.selected) _.graph.functions.deselectNode(nodeElement);
									else _.graph.functions.selectNode(nodeElement);
								}
							}

							preselectedOnDown = false;
						};

						$(window).on('pointerup.nodeSelect pointercancel.nodeSelect', endSelect);
					});
				},
				setPortConnectionHandler: async (node) => {
					let nodeElement = await _.graph.functions.validateNode(node);
					if (!nodeElement) return;

					const nodeId = nodeElement.attr('id');
					let nodeData = _.graph.data.nodes.find(n => n.id === nodeId);
					if (!nodeData) {
						console.warn('Node data not found for element:', nodeElement);
						return;
					}

					// Implement connection creation by dragging from ports, and call this handler to set up the port elements for that interaction.
					
					const ports = nodeElement.find('.port');

					ports.each(function () {
						const portElement = $(this);
						const portId = portElement.attr('id');
					 	const portType = portElement.parent().parent().hasClass('input') ? 'input' : 'output';

						portElement.on('mousedown', function (e) {
							e.preventDefault();
							e.stopPropagation();

							// Start a connection drag from this port. Show a temporary connection line following the mouse.
							// If the mouse is released over a compatible port, create a connection. Otherwise cancel.
							_.graph.functions.startConnection(nodeId, portId, e);
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
			},
			mobile: async () => {
				if (!_.data.mobile.isMobile) return;

				// Load nav bar for mobile
				$.each(_.data.mobile.nav, function (key, navItem) {
					const id = navItem.id;
					const element = $('#' + id);
					_.data.mobile.nav[key].element = element;
					if (navItem.clickTrigger) {
						element.on('click', function () {
							$('body').trigger(navItem.clickTrigger);
						});
					}
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