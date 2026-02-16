import { ui } from '../../Modules/RecRoom/ui.mjs';
import { auth } from '../../Modules/RecRoom/auth.mjs';
import { chip } from '../../Modules/chip.mjs';
import { palette } from '../../Pages/Editor/palette.mjs';
import { graph } from '../../Pages/Editor/graph.mjs';
import { store } from '../../Pages/Editor/data.mjs';
import { leftNav } from '../../Pages/Editor/leftNav.mjs';
import { account } from '../../Pages/Editor/account.mjs';
import { contextMenu } from '../../Pages/Editor/contextMenu.mjs';

////////////////////////////////////////////////////////

$(function () {
	const _ = {
		init: async () => {
			await ui.init.inputs();
			await chip.init();
			await chip.getAll({ combineResults: true }).then(data => {
				store.editor.chipsJSON = data;
			});
			await leftNav.init();
			await account.init();
			await palette.init();
			await graph.init();
			await auth.init();
			await contextMenu.init();
			// await auth.start();
		}
	}

	_.init();
});