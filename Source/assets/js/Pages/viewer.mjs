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
			// console.log('Testing chip search for "Trigger"...');
			// await chip.search('Trigger', { chipsJSON: _.data.chipsJSON, combineResults: true }).then(data => {
			// 	console.log('Search results for "Trigger":', data);
			// });
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
							await chip.render($('#render'), chipData, { size: 1, log: true });
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