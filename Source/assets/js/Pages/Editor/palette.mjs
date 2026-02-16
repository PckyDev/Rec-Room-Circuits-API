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
// File:			palette.mjs						  //
// Dependency for:	editor.mjs						  //
// Description:		All logic related to the palette, //
//					which is the UI element that	  //
// 					allows users to select chips to	  //
// 					place in the graph.				  //
////////////////////////////////////////////////////////

import { chip } from "../../Modules/chip.mjs";
import { graph } from "../../Pages/Editor/graph.mjs";
import { store } from "../../Pages/Editor/data.mjs";

export const palette = {
    init: async () => {
        await palette.load.templates();
        await palette.load.chips();
        await palette.load.searchInput();
		await palette.load.aboutChipEvent();
        // await palette.load.resizeBar();
        // await palette.load.openEvent();
    },
    functions: {
        resize: async (newWidth) => {
            const chipsContainer = $("#" + store.palette.paletteChipsContainerId);
            const classTemplate = "row row-cols-{{chipsPerRow}}";
            $.each(store.palette.resizeCols, function (index, colData) {
                if (newWidth >= colData.min && newWidth <= colData.max) {
                    chipsContainer.attr(
                        "class",
                        classTemplate.replace(
                            "{{chipsPerRow}}",
                            colData.chipsPerRow,
                        ),
                    );
                    return false; // break loop
                }
            });
            $("body").trigger("resize-chips");
        },
        openInfoModal: async (chipData) => {
            const modal = $("#" + store.palette.paletteInfoModalId);

            if (modal.length === 0) {
                console.warn(
                    'Modal element with id "' + store.palette.paletteInfoModalId + '" not found.',
                );
                return;
            }

            // Set model content based on chipData
            modal
                .find(".title")
                .text(
                    chipData.paletteName || chipData.chipName || "Unknown Chip",
                );
            modal
                .find(".chip-description")
                .text(chipData.description || "No description available.");

            // Show/hide badges based on chipData properties
            let deprecated = false;
            if (chipData.deprecationStage) {
                if (chipData.deprecationStage.name !== "Active") {
                    deprecated = true;
                }
            }

            const badges = {
                r1: chipData.isValidInRoom1 || false,
                r2: chipData.isValidInRoom2 || false,
                dev: chipData.isDevChip || false,
                studio: chipData.isStudioChip || false,
                troll: chipData.isTrollingRisk || false,
                role: chipData.isRoleAssignmentRisk || false,
                beta: chipData.isBetaChip || false,
                deprecated: deprecated,
            };
            $.each(badges, function (badgeClass, isVisible) {
                const badgeElement = modal.find(".badges ." + badgeClass);
                if (isVisible) {
                    badgeElement.show();
                } else {
                    badgeElement.hide();
                }
            });

            // Render chip preview in the modal
            const previewContainer = modal.find(".chip-preview-viewport");
            // Clear previous preview
            previewContainer.empty();
            // Render new preview
            await chip.render(previewContainer, chipData, {
                size: 1,
                log: false,
                autoFit: true,
                enablePortHover: true,
            });

            // Open the modal using jQuery Bootstrap's modal method
            modal.modal("show");
        },
    },
    load: {
        templates: async () => {
            $.each(
                store.palette.templates,
                function (templateName, templateData) {
                    const templateElement = $("#" + templateData.id);
                    if (templateElement.length > 0) {
                        templateData.html = templateElement[0].outerHTML
                            .replace('id="' + templateData.id + '"', "")
                            .trim();
                        const children = templateElement.parent().children();
                        children.each(function () {
                            if (this.id === templateData.id) {
                                $(this).remove();
                            }
                        });
                    } else {
                        console.warn(
                            'Template element with id "' +
                                templateData.id +
                                '" not found.',
                        );
                    }
                },
            );
        },
        chips: async (query) => {
            if (!store.editor.chipsJSON || Object.keys(store.editor.chipsJSON).length === 0) {
                console.warn("No chipsJSON data available to load chips.");
				return;
            }

            let chipsJSON = store.editor.chipsJSON;

            if (query) {
                chipsJSON = await chip.search(query, {
                    chipsJSON: store.editor.chipsJSON,
                    combineResults: true,
                });
            }
            // console.log('Chips to display:', chipsJSON);

            const chipsContainer = $(
                "#" + store.palette.paletteChipsContainerId,
            );
            chipsContainer.html("");

            // Lazy-render chips as they enter (or get near) the viewport.
            // Clean up any previous observer before rebuilding the list.
            if (store.palette._chipObserver) {
                store.palette._chipObserver.disconnect();
                store.palette._chipObserver = null;
            }

            const canObserve = typeof IntersectionObserver !== "undefined";

            const observer = canObserve
                ? new IntersectionObserver(
                      async (entries, obs) => {
                          for (const entry of entries) {
                              if (!entry.isIntersecting) continue;

                              const target = entry.target;
                              obs.unobserve(target);

                              if (target.dataset.rendered === "true") continue;
                              target.dataset.rendered = "true";

                              const chipName = target.dataset.chipName;
                              const chipData = chipsJSON[chipName];
                              await chip.render($(target), chipData, {
                                  size: 1,
                                  log: false,
                              });
                          }
                      },
                      {
                          root: null,
                          // Start rendering a bit before it becomes visible
                          rootMargin: "250px 0px",
                          threshold: 0.01,
                      },
                  )
                : null;

            store.palette._chipObserver = observer;

            for (const [chipName, chipData] of Object.entries(chipsJSON)) {
                const chipElementHTML =
                    store.palette.templates.paletteChipTemplate.html.replace(
                        store.palette.templates.paletteChipTemplate
                            .placeholders.chipPaletteName,
                        chipData.paletteName,
                    );

                const chipElement = $(chipElementHTML);
                chipsContainer.append(chipElement);

                const chipPaletteRender = chipsContainer
                    .children()
                    .last()
                    .find("#" + store.palette.chipPaletteRenderId);

                // Make the render target unique and track its render state
                chipPaletteRender.removeAttr("id");
                chipPaletteRender[0].dataset.chipName = chipName;
                chipPaletteRender[0].dataset.rendered = "false";

                if (observer) {
                    observer.observe(chipPaletteRender[0]);
                } else {
                    // Fallback: no IntersectionObserver support -> render immediately
                    await chip.render(chipPaletteRender, chipData, {
                        size: 1,
                        log: false,
                    });
                    chipPaletteRender[0].dataset.rendered = "true";
                }

                // Allow info button clicks without spawning / dragging.
                chipElement.on("click", "button", function (e) {
                    if (
                        $(e.target)
                            .closest("button")
                            .hasClass(store.palette.chipOpenInfoModalBtnClass)
                    ) {
                        e.preventDefault();
                        e.stopPropagation();
                        palette.functions.openInfoModal(chipData);
                    }
                });

                // Click-to-spawn (center) + click-hold-drag to place.
                (() => {
                    const DRAG_THRESHOLD_PX = 6;
                    let active = false;
                    let pointerId = null;
                    let startX = 0;
                    let startY = 0;
                    let didDrag = false;
                    let createdNodeId = null;
                    let createdNodeW = 0;
                    let createdNodeH = 0;
                    let createPromise = null;
                    let lastMoveX = 0;
                    let lastMoveY = 0;
                    let allowDrag = true;
                    let pressTimer = null;

                    const cleanup = () => {
                        active = false;
                        pointerId = null;
                        startX = 0;
                        startY = 0;
                        didDrag = false;
                        createdNodeId = null;
                        createdNodeW = 0;
                        createdNodeH = 0;
                        createPromise = null;
                        lastMoveX = 0;
                        lastMoveY = 0;
                        allowDrag = true;
                        if (pressTimer) {
                            try {
                                clearTimeout(pressTimer);
                            } catch {
                                /* ignore */
                            }
                            pressTimer = null;
                        }
                    };

                    const _getClampedWorldFromClient = (clientX, clientY) => {
                        const vpEl =
                            store.graph?.elements?.graphCanvasViewport
                                ?.element;
                        if (!vpEl) return null;
                        const rect = vpEl.getBoundingClientRect();
                        const cx = Math.max(
                            rect.left,
                            Math.min(rect.right, clientX),
                        );
                        const cy = Math.max(
                            rect.top,
                            Math.min(rect.bottom, clientY),
                        );
                        const sx = cx - rect.left;
                        const sy = cy - rect.top;
                        const world = graph.functions.screenToWorld(sx, sy);
                        return { world, rect, cx, cy };
                    };

                    const _moveCreatedNodeToClient = (clientX, clientY) => {
                        if (!createdNodeId) return;
                        const info = _getClampedWorldFromClient(
                            clientX,
                            clientY,
                        );
                        if (!info?.world) return;

                        // Keep the pointer on the *center* of the chip.
                        // Prefer the node's unscaled layout size (world units).
                        // Fallback to live bounding box (screen px) divided by zoom.
                        let w = Number(createdNodeW || 0);
                        let h = Number(createdNodeH || 0);
                        try {
                            if (w && h) {
                                // already have a good size
                            } else {
                                const nodeEl = store.graph?.nodes?.find?.(
                                    (n) => n?.id === createdNodeId,
                                )?.element?.[0];
                                const s =
                                    Number(
                                        store.graph?.cameraState?.scale ?? 1,
                                    ) || 1;
                                if (
                                    nodeEl &&
                                    typeof nodeEl.getBoundingClientRect ===
                                        "function"
                                ) {
                                    const r = nodeEl.getBoundingClientRect();
                                    w = Number(r.width || 0) / s;
                                    h = Number(r.height || 0) / s;
                                }
                            }
                            if (
                                false
                            ) {
                            }
                        } catch {
                            /* ignore */
                        }

                        // Defensive: if size is still unknown, don't offset.
                        if (!Number.isFinite(w)) w = 0;
                        if (!Number.isFinite(h)) h = 0;

                        const px =
                            Number(info.world.x || 0) - (w ? w * 0.5 : 0);
                        const py =
                            Number(info.world.y || 0) - (h ? h * 0.5 : 0);
                        graph.node.setPosition(createdNodeId, px, py);
                    };

                    const _ensureNodeCreated = async (clientX, clientY) => {
                        if (createdNodeId) return createdNodeId;
                        if (createPromise) return createPromise;

                        createPromise = (async () => {
                            const vpEl =
                                store.graph?.elements?.graphCanvasViewport
                                    ?.element;
                            if (!vpEl) return null;

                            // One undo step for the whole gesture: create node + drag placement.
                            graph.functions._recordHistory?.();
                            const created = await graph.node.add(chipData, {
                                skipHistory: true,
                            });
                            if (!created?.id) return null;

                            createdNodeId = created.id;
                            createdNodeW = Number(
                                created.element?.outerWidth?.() || 0,
                            );
                            createdNodeH = Number(
                                created.element?.outerHeight?.() || 0,
                            );

                            // Make it the active selection.
                            for (const n of store.graph.nodes || []) {
                                if (n?.selected)
                                    graph.functions.deselectNode(n.element);
                            }
                            graph.functions.selectNode?.(createdNodeId);

                            // Place immediately at the palette click position projected onto the canvas.
                            _moveCreatedNodeToClient(clientX, clientY);
                            return createdNodeId;
                        })();

                        return createPromise;
                    };

                    const onPointerMove = (e) => {
                        if (!active) return;
                        if (pointerId !== null && e.pointerId !== pointerId)
                            return;

                        lastMoveX = e.clientX;
                        lastMoveY = e.clientY;

                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;
                        const dist = Math.hypot(dx, dy);

                        // On touch, require a short long-press before we treat movement as a drag.
                        if (!allowDrag && dist >= DRAG_THRESHOLD_PX) {
                            // User likely intended to scroll; cancel gesture and don't spawn.
                            window.removeEventListener(
                                "pointermove",
                                onPointerMove,
                                true,
                            );
                            window.removeEventListener(
                                "pointerup",
                                onPointerUp,
                                true,
                            );
                            window.removeEventListener(
                                "pointercancel",
                                onPointerCancel,
                                true,
                            );
                            cleanup();
                            return;
                        }

                        if (!didDrag && dist >= DRAG_THRESHOLD_PX) {
                            didDrag = true;
                            // Capture the pointer once we know this is a drag so palette scrolling still works.
                            try {
                                chipElement[0]?.setPointerCapture?.(
                                    e.pointerId,
                                );
                            } catch {
                                /* ignore */
                            }

                            // Create the real node on the canvas where the palette was clicked, then start dragging it.
                            _ensureNodeCreated(startX, startY).then(() => {
                                _moveCreatedNodeToClient(
                                    lastMoveX || startX,
                                    lastMoveY || startY,
                                );
                            });
                        }

                        if (didDrag) {
                            // Prevent page scrolling while dragging a chip.
                            e.preventDefault?.();
                            // Keep the created node under the pointer (projected into the canvas bounds).
                            if (createdNodeId)
                                _moveCreatedNodeToClient(e.clientX, e.clientY);
                        }
                    };

                    const onPointerUp = async (e) => {
                        if (!active) return;
                        if (pointerId !== null && e.pointerId !== pointerId)
                            return;

                        window.removeEventListener(
                            "pointermove",
                            onPointerMove,
                            true,
                        );
                        window.removeEventListener(
                            "pointerup",
                            onPointerUp,
                            true,
                        );
                        window.removeEventListener(
                            "pointercancel",
                            onPointerCancel,
                            true,
                        );

                        try {
                            chipElement[0]?.releasePointerCapture?.(
                                e.pointerId,
                            );
                        } catch {
                            /* ignore */
                        }

                        // If this was a click (no drag), keep existing behavior.
                        if (!didDrag) {
                            cleanup();
                            await graph.node.add(chipData);
                            if (store.editor.mobile.isMobile)
                                $("body").trigger("openPalette");
                            return;
                        }

                        // Drag-drop: node is created on drag start and follows the pointer.
                        if (createPromise) {
                            try {
                                await createPromise;
                            } catch {
                                /* ignore */
                            }
                        }
                        if (createdNodeId) {
                            _moveCreatedNodeToClient(e.clientX, e.clientY);
                        }
                        cleanup();
                        if (store.editor.mobile.isMobile)
                            $("body").trigger("openPalette");
                    };

                    const onPointerCancel = async (e) => {
                        if (!active) return;
                        if (pointerId !== null && e.pointerId !== pointerId)
                            return;
                        window.removeEventListener(
                            "pointermove",
                            onPointerMove,
                            true,
                        );
                        window.removeEventListener(
                            "pointerup",
                            onPointerUp,
                            true,
                        );
                        window.removeEventListener(
                            "pointercancel",
                            onPointerCancel,
                            true,
                        );
                        // If we created a node during this drag, remove it on cancel.
                        if (createPromise) {
                            try {
                                await createPromise;
                            } catch {
                                /* ignore */
                            }
                        }
                        if (createdNodeId) {
                            try {
                                graph.functions.deleteNode?.(createdNodeId);
                            } catch {
                                /* ignore */
                            }
                        }
                        cleanup();
                    };

                    chipElement.on("pointerdown", function (e) {
                        // Ignore if pointer events aren't supported.
                        if (!window.PointerEvent) return;
                        // Ignore non-primary buttons.
                        if (typeof e.button === "number" && e.button !== 0)
                            return;
                        // Ignore gestures that start on buttons.
                        if ($(e.target).closest("button").length > 0) return;

                        active = true;
                        pointerId = e.pointerId;
                        startX = e.clientX;
                        startY = e.clientY;

                        allowDrag = e.pointerType !== "touch";
                        if (!allowDrag) {
                            pressTimer = setTimeout(() => {
                                allowDrag = true;
                            }, 160);
                        }

                        window.addEventListener("pointermove", onPointerMove, {
                            capture: true,
                            passive: false,
                        });
                        window.addEventListener("pointerup", onPointerUp, true);
                        window.addEventListener(
                            "pointercancel",
                            onPointerCancel,
                            true,
                        );
                    });

                    // Fallback for very old browsers: keep click-to-spawn.
                    if (!window.PointerEvent) {
                        chipElement.on("click", async function (e) {
                            if ($(e.target).closest("button").length > 0)
                                return;
                            await graph.node.add(chipData);
                            if (store.editor.mobile.isMobile)
                                $("body").trigger("openPalette");
                        });
                    }
                })();
            }
        },
        searchInput: async () => {
            const searchInput = $("#" + store.palette.searchInputId);
            searchInput.on("input", function () {
                const query = $(this).val().trim();
                palette.load.chips(query);
            });
        },
        aboutChipEvent: async () => {
            if (store.palette._aboutChipEventInstalled) return;
            store.palette._aboutChipEventInstalled = true;

            $(document).on("graphAboutChip", async (e, info) => {
                try {
                    const chipData = info?.payload ?? null;
                    if (!chipData) return;
                    await palette.functions.openInfoModal(chipData);
                } catch (err) {
                    console.warn("AboutChip: failed to open modal", err);
                }
            });
        },
        // resizeBar: async () => {
        //     const resizeBar = $("#" + store.palette.paletteResizeBarId);
        //     let isResizing = false;

        //     resizeBar.on("mousedown", function (e) {
        //         e.preventDefault();
        //         isResizing = true;
        //     });

        //     $(document).on("mousemove", function (e) {
        //         if (!isResizing) return;
        //         if (store.editor.mobile.isMobile) return; // Disable resizing on mobile for now
        //         const newWidth = e.clientX;
        //         palette.functions.resize(newWidth);
        //     });

        //     $(document).on("mouseup", function () {
        //         if (isResizing) {
        //             isResizing = false;
        //         }
        //     });
        // },
        // openEvent: async () => {
        //     $("body").on("openPalette", function () {
        //         const paletteWindow = $("#" + store.palette.paletteWindowId);
        //         if (paletteWindow.hasClass("open")) {
        //             paletteWindow.removeClass("open");
        //         } else {
        //             paletteWindow.addClass("open");
        //         }
        //         palette.functions.resize(paletteWindow.width());
        //     });
        // },
    },
};
