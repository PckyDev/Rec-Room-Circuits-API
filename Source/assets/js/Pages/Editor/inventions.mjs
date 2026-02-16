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
// File:			inventions.mjs					  //
// Dependency for:	editor.mjs						  //
// Description:		All logic related to inventions,  //
//					which are graphs that users can   //
//					create, save, publish, and share  //
//					with others.					  //
////////////////////////////////////////////////////////

import { graph } from '../../Pages/Editor/graph.mjs';

export const inventions = {
	elements: {
		inventionCreateModal: {
			id: 'inventionCreateModal',
			element: null,
			interactiveElements: {
				inventionNameInput: {
					id: 'createInventionName',
					element: null,
				},
				inventionDescriptionTextarea: {
					id: 'createInventionDescription',
					element: null,
				},
				createInventionBtn: {
					id: 'createInventionPublish',
					element: null,
				},
				createInventionPreviewImage: {
					id: 'createInventionPreview',
					element: null,
				}
			}
		}
	},
	init: async () => {
		await inventions.load.elements();
		await inventions.load.contextMenuListener();
	},
	functions: {
		// Functions related to inventions can go here
	},
	load: {
		elements: async () => {
			$.each(inventions.elements, (key, inventionElement) => {
				inventionElement.element = $(`#${inventionElement.id}`);
				$.each(inventionElement.interactiveElements, (interactiveKey, interactive) => {
					interactive.element = $(`#${interactive.id}`);
				});
			});
		},
		contextMenuListener: async () => {
			$(document).on('contextCreateInvention', async (event, data) => {
				await inventions.openCreateModal();
			});
		}
	},
	openCreateModal: async () => {
		// // Clear input fields in the modal
		// const state = inventions.elements.inventionCreateModal.interactiveElements;
		// state.inventionNameInput.element.val('');
		// state.inventionDescriptionTextarea.element.val('');
		// state.createInventionBtn.element.removeClass('disabled');

		// // Set the preview image to an image of the selected graph
		// // const graphImage = await graph.export.selectedNodesAsImage( { backgroundColor: '#222d36' } );
		// const graphImage = await graph.export.selectedNodesAsImage();
		// if (graphImage) {
		// 	state.createInventionPreviewImage.element.css('background-image', `url(${graphImage})`);
		// } else {
		// 	state.createInventionPreviewImage.element.css('background-image', '');
		// }

		// // Open the modal using jQuery Bootstrap's modal method
		// inventions.elements.inventionCreateModal.element.modal('show');
	}
};