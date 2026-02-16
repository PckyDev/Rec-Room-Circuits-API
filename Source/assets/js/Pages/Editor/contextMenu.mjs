////////////////////////////////////////////////////////
//    _____           _          _____                //
//   |  __ \         | |        |  __ \               //
//   | |__) |__   ___| | ___   _| |  | | _____   __   //
//   |  ___/ _ \ / __| |/ / | | | |  | |/ _ \ \ / /   //
//   | |  | (_) | (__|   <| |_| | |__| |  __/\ V /    //
//   |_|   \___/ \___|_|\_\\__, |_____/ \___| \_/     //
//                          __/ |                     //
//                         |___/                      //
////////////////////////////////////////////////////////
// Project:			Rec Room Circuits Graph Editor    //
// File:			contextMenu.mjs					  //
// Dependency for:	editor.mjs						  //
// Description:		All logic related to the context  //
//					menu, which is used to interact   //
//					with the graph elements.		  //
////////////////////////////////////////////////////////

export const contextMenu = {
	_hideTimer: null,
	_dragHideCaptureBound: false,
	_longPressCaptureBound: false,
	elements: {
		contextMenu: {
			id: 'contextMenu',
			element: null,
			interactiveElements: {
				duplicate: {
					id: 'contextDuplicate',
					element: null,
					eventOnClick: 'contextDuplicate',
					hidden: false,
					disabled: true,
				},
				delete: {
					id: 'contextDelete',
					element: null,
					eventOnClick: 'contextDelete',
					hidden: false,
					disabled: true,
				},
				undo: {
					id: 'contextUndo',
					element: null,
					eventOnClick: 'contextUndo',
					hidden: false,
					disabled: true,
				},
				redo: {
					id: 'contextRedo',
					element: null,
					eventOnClick: 'contextRedo',
					hidden: false,
					disabled: true,
				},
				createInvention: {
					id: 'contextInventionCreate',
					element: null,
					eventOnClick: 'contextCreateInvention',
					hidden: false,
					disabled: true,
				},
				aboutChip: {
					id: 'contextAboutChip',
					element: null,
					eventOnClick: 'contextAboutChip',
					hidden: false,
					disabled: true,
				},
			}
		},
	},
	init: async () => {
		contextMenu.load.elements();
		contextMenu.load.events();
		contextMenu.functions.hide(); // Start with the context menu hidden
		contextMenu.functions.setPosition(0, 0); // Position it at the top-left corner initially to avoid accidental clicks on page elements
	},
	functions: {
		openAt: (x, y, meta = null) => {
			try {
				$(document).trigger('contextMenuBeforeOpen', [{ x, y, meta }]);
			} catch {
				/* ignore */
			}
			contextMenu.load.states();
			contextMenu.functions.setPosition(x, y);
			contextMenu.functions.show();
		},
		setPosition: (x, y) => {
			const menu = contextMenu.elements.contextMenu.element;
			const menuWidth = menu.outerWidth();
			const menuHeight = menu.outerHeight();
			const windowWidth = $(window).width();
			const windowHeight = $(window).height();

			// Adjust position to prevent overflow
			if (x + menuWidth > windowWidth) {
				x = windowWidth - menuWidth - 10; // 10px padding from edge
			}

			if (y + menuHeight > windowHeight) {
				y = windowHeight - menuHeight - 10; // 10px padding from edge
			}

			menu.css({ top: y, left: x });
		},
		show: () => {
			if (contextMenu._hideTimer) {
				clearTimeout(contextMenu._hideTimer);
				contextMenu._hideTimer = null;
			}
			contextMenu.elements.contextMenu.element.show();
			contextMenu.elements.contextMenu.element.addClass('open');
		},
		hide: (options = {}) => {
			const immediate = options?.immediate === true;
			contextMenu.elements.contextMenu.element.removeClass('open');
			if (contextMenu._hideTimer) {
				clearTimeout(contextMenu._hideTimer);
				contextMenu._hideTimer = null;
			}

			if (immediate) {
				contextMenu.elements.contextMenu.element.hide();
				return;
			}

			// Wait 0.1s and then fully hide the menu
			contextMenu._hideTimer = setTimeout(() => {
				contextMenu.elements.contextMenu.element.hide();
				contextMenu._hideTimer = null;
			}, 100);
		},
		hideImmediate: () => {
			contextMenu.functions.hide({ immediate: true });
		},
		toggle: () => {
			const menu = contextMenu.elements.contextMenu.element;
			if (menu.hasClass('open')) {
				contextMenu.functions.hide();
			} else {
				contextMenu.functions.show();
			}
		},
	},
	load: {
		elements: () => {
			// Load context menu elements into the store for easy access
			$.each(contextMenu.elements, (key, value) => {
				if (value.id) {
					value.element = $(`#${value.id}`);
				}
				if (value.interactiveElements) {
					$.each(value.interactiveElements, (interactiveKey, interactiveValue) => {
						if (interactiveValue.id) {
							interactiveValue.element = $(`#${interactiveValue.id}`);
							if (interactiveValue.eventOnClick) {
								interactiveValue.element.on('click', function (e) {
									e.preventDefault();
									if (!interactiveValue.disabled) {
										$(document).trigger(interactiveValue.eventOnClick);
										contextMenu.functions.hide(); // Hide the context menu after an action is taken
									}
								});
							}
						}
					});
				}
			});
		},
		events: () => {
			// Hide immediately when starting drag-like gestures (drag-select, node drag).
			// Use capture-phase native listeners so this still runs even if other handlers stop propagation.
			if (!contextMenu._dragHideCaptureBound) {
				contextMenu._dragHideCaptureBound = true;
				const hideOnDownCapture = (e) => {
					const target = e.target;
					if (!target) return;
					if ($(target).closest(`#${contextMenu.elements.contextMenu.id}`).length) return;

					// Left click / primary pointer only (mouse). Touch/pen don't need filtering.
					if (e.type === 'mousedown') {
						if (e.button !== 0) return;
					}
					if (e.type === 'pointerdown') {
						if (e.pointerType === 'mouse' && e.button !== 0) return;
					}

					contextMenu.functions.hideImmediate();
				};

				document.addEventListener('pointerdown', hideOnDownCapture, true);
				document.addEventListener('mousedown', hideOnDownCapture, true);
				document.addEventListener('touchstart', hideOnDownCapture, true);
			}

			// Hide immediately when starting drag-like gestures (drag-select, node drag).
			// Avoid hiding when interacting with the menu itself.
			$(document).on('pointerdown.contextMenuHideOnDrag mousedown.contextMenuHideOnDrag touchstart.contextMenuHideOnDrag', function (e) {
				if ($(e.target).closest(`#${contextMenu.elements.contextMenu.id}`).length) return;

				if (e.type === 'mousedown') {
					if (e.which !== 1) return; // left button only
				}

				if (e.type === 'pointerdown') {
					if (e.pointerType === 'mouse' && e.button !== 0) return; // left button only
				}

				contextMenu.functions.hideImmediate();
			});

			// Attach right-click event to the page to open the context menu
			$(document).on('contextmenu', function (e) {
				e.preventDefault();
				contextMenu.functions.openAt(e.pageX, e.pageY, {
					source: 'contextmenu',
					target: e.target,
					originalEvent: e,
				});
			});

			// Long-press to open on mobile (touch/pen).
			// Cancels if the pointer moves too much (so panning/dragging doesn't pop it).
			let longPressTimer = null;
			let longPressPointerId = null;
			let longPressStartX = 0;
			let longPressStartY = 0;
			let longPressTarget = null;
			const LONG_PRESS_DELAY_MS = 550;
			const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

			const cancelLongPress = () => {
				if (longPressTimer) {
					clearTimeout(longPressTimer);
					longPressTimer = null;
				}
				longPressPointerId = null;
				longPressTarget = null;
			};

			const startLongPress = (x, y, pointerId = null, target = null) => {
				cancelLongPress();
				longPressPointerId = pointerId;
				longPressStartX = x;
				longPressStartY = y;
				longPressTarget = target;
				longPressTimer = setTimeout(() => {
					longPressTimer = null;
					contextMenu.functions.openAt(longPressStartX, longPressStartY, {
						source: 'longpress',
						target: longPressTarget,
					});
				}, LONG_PRESS_DELAY_MS);
			};

			// Capture-phase long press handling so it works even when node handlers stop propagation.
			if (window.PointerEvent && !contextMenu._longPressCaptureBound) {
				contextMenu._longPressCaptureBound = true;
				const onPointerDownCapture = (e) => {
					try {
						if (!e) return;
						if (String(e.pointerType || '').toLowerCase() === 'mouse') return;
						const t = e.target;
						if (!t) return;
						if ($(t).closest(`#${contextMenu.elements.contextMenu.id}`).length) return;
						// Don't long-press when starting a wire connection gesture.
						if (t.closest && t.closest('.port')) return;
						startLongPress(e.pageX, e.pageY, e.pointerId, t);
					} catch {
						/* ignore */
					}
				};
				const onPointerMoveCapture = (e) => {
					if (longPressPointerId == null) return;
					if (e.pointerId !== longPressPointerId) return;
					const dx = e.pageX - longPressStartX;
					const dy = e.pageY - longPressStartY;
					if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelLongPress();
				};
				const onPointerUpLikeCapture = (e) => {
					if (longPressPointerId == null) return;
					if (e && e.pointerId != null && e.pointerId !== longPressPointerId) return;
					cancelLongPress();
				};

				document.addEventListener('pointerdown', onPointerDownCapture, true);
				document.addEventListener('pointermove', onPointerMoveCapture, true);
				document.addEventListener('pointerup', onPointerUpLikeCapture, true);
				document.addEventListener('pointercancel', onPointerUpLikeCapture, true);
			}

			// Prefer Pointer Events when available.
			$(document).on('pointerdown.contextMenuLongPress', function (e) {
				// If capture-phase handler is installed, don't double-start.
				if (contextMenu._longPressCaptureBound) return;
				// Only touch/pen long press (mouse is handled by right click).
				if (e.pointerType === 'mouse') return;
				if ($(e.target).closest(`#${contextMenu.elements.contextMenu.id}`).length) return;
				if (e.target?.closest?.('.port')) return;
				startLongPress(e.pageX, e.pageY, e.pointerId, e.target);
			});
			$(document).on('pointermove.contextMenuLongPress', function (e) {
				if (contextMenu._longPressCaptureBound) return;
				if (longPressPointerId == null) return;
				if (e.pointerId !== longPressPointerId) return;
				const dx = e.pageX - longPressStartX;
				const dy = e.pageY - longPressStartY;
				if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelLongPress();
			});
			$(document).on('pointerup.contextMenuLongPress pointercancel.contextMenuLongPress', function (e) {
				if (contextMenu._longPressCaptureBound) return;
				if (longPressPointerId == null) return;
				if (e.pointerId !== longPressPointerId) return;
				cancelLongPress();
			});

			// Fallback for older browsers without Pointer Events.
			$(document).on('touchstart.contextMenuLongPress', function (e) {
				if (window.PointerEvent) return;
				if ($(e.target).closest(`#${contextMenu.elements.contextMenu.id}`).length) return;
				const t = e.originalEvent?.touches?.[0];
				if (!t) return;
				startLongPress(t.pageX, t.pageY, null, e.target);
			});
			$(document).on('touchmove.contextMenuLongPress', function (e) {
				if (window.PointerEvent) return;
				if (!longPressTimer) return;
				const t = e.originalEvent?.touches?.[0];
				if (!t) return;
				const dx = t.pageX - longPressStartX;
				const dy = t.pageY - longPressStartY;
				if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelLongPress();
			});
			$(document).on('touchend.contextMenuLongPress touchcancel.contextMenuLongPress', function () {
				if (window.PointerEvent) return;
				cancelLongPress();
			});

			// Hide context menu on left click or escape key press
			$(document).on('click', function (e) {
				if (!$(e.target).closest(`#${contextMenu.elements.contextMenu.id}`).length) {
					contextMenu.functions.hide();
				}
			});
			$(document).on('keydown', function (e) {
				if (e.key === 'Escape') {
					contextMenu.functions.hide();
				}
			});
		},
		states: () => {
			$.each(contextMenu.elements.contextMenu.interactiveElements, (key, value) => {
				if (value.disabled) {
					value.element.addClass('disabled');
				} else {
					value.element.removeClass('disabled');
				}

				if (value.hidden) {
					value.element.hide();
				} else {
					value.element.show();
				}
			});
		}
	},
	setItemState: (itemKey, { hidden, disabled }) => {
		const item = contextMenu.elements.contextMenu.interactiveElements[itemKey];
		if (item) {
			if (hidden !== undefined) {
				item.hidden = hidden;
			}
			if (disabled !== undefined) {
				item.disabled = disabled;
			}
		} else {
			console.warn(`Context menu item with key "${itemKey}" not found.`);
		}
	},
	getAllItems: () => {
		// Return an array of all context menu item keys
		return Object.keys(contextMenu.elements.contextMenu.interactiveElements);
	}
};