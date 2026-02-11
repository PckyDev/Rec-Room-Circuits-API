$(async function () {
	
	// Step 1:
	// - Function to import an external module from a URL
	async function importExternal(url) {
		const module = await fetch(url, {cache: 'no-cache'});
		if (!module.ok) { throw new Error('Failed to load module: ' + url); }

		const moduleCode = await module.text();
		const blob = new Blob([moduleCode], { type: 'text/javascript' });
		const blobUrl = URL.createObjectURL(blob);
		
		try {
			const module = await import(blobUrl);
			if (Object.keys(module).length === 1) {
				return module[Object.keys(module)[0]];
			} else {
				return module;
			}
		} finally {
			URL.revokeObjectURL(blobUrl);
		}
	}

	// Step 2:
	// - Importing the chip module
	const url = 'https://raw.githubusercontent.com/PckyDev/Rec-Room-Circuits-API/refs/heads/main/Source/assets/js/Modules/chip.mjs';
	const chip = await importExternal(url);

	// Step 3:
	// - Initialize the chip API
	chip.init();

	// Step 4:
	// - Render a chip to test
	chip.render($('body'), 'Trigger Volume', { size: 1, autoFit: true });

});