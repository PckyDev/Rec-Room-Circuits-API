const _ = {
	repo: {
		mainUrl: 'https://raw.githubusercontent.com/PckyDev/Rec-Room-Circuits-Viewer/refs/heads/main/',
		circuitsDataPath: 'Circuits%20Data/CV2_ChipConfigs.json',
		css: {
			basePath: 'Source/assets/css/Chip/',
			files: [
				'chip-layout.css',
				'chip-versions.css',
				'port-colors.css',
				'port-sizes.css',
				'port-versions.css'
			]
		}
	}
}

async function getJSON() {
	const res = await fetch(`${_.repo.mainUrl}${_.repo.circuitsDataPath}`);
	const data = await res.json();
	
	return data.configs;
}

async function search(query) {
	let jsonData = await getJSON(true);
	let results = {};
	query = query.toLowerCase();
	$.each(jsonData, function(chipName, chipData) {
		if (chipName.toLowerCase().match(new RegExp(`\^${query}`, 'gm'))) {
			results[chipName] = chipData;
		}
	});
	return results;
}

export const chip = {
	
	init: async () => {
		const htmlHead = document.head;
		// Fetch CSS files, combine them, and inject into a style tag
		let combinedCSS = '';
		for (const cssFile of _.repo.css.files) {
			const res = await fetch(`${_.repo.mainUrl}${_.repo.css.basePath}${cssFile}`);
			const cssText = await res.text();
			combinedCSS += `\n/* ${cssFile} */\n` + cssText;
		}
		const style = document.createElement('style');
		style.textContent = combinedCSS;
		htmlHead.appendChild(style);
	},
	async render(element, chip, opt) {

		if (!element || !chip) {
			console.error('Element and chip parameters are required to render a chip.');
			return;
		}

		if (typeof chip == 'string') {
			chip = chip.replace(/\s/gm, '');
			let jsonData = await getJSON(true);
			if (jsonData[chip]) {
				chip = jsonData[chip];
			} else {
				await search(chip).then(results => {
					if (Object.keys(results).length > 0) {
						chip = results[Object.keys(results)[0]];
					} else {
						console.error(`No chip found matching "${chip}".`);
						return;
					}
				});
			}
		}

		const options = {
			log: opt?.log || false,
			size: opt?.size || 1,
			autoFit: opt?.autoFit || true
		}

		const _ = {
			templates: {
				chip: `
					<div class="chip c-{{chipType}}">
						<div class="header">
							<p class="title">{{chipTitle}}</p>
							<div class="port p-object">
								<p></p>
							</div>
						</div>
						<div class="ports">
							{{portSections}}
						</div>
						<div class="footer">
							<div class="port p-exec">
								<p></p>
							</div>
						</div>
					</div>`,
				portSection: `
					<div class="section">
						<div class="input">
							{{inputPorts}}
						</div>
						<div class="output">
							{{outputPorts}}
						</div>
					</div>`,
				port: `
					<div class="port-container">
						<p class="name">{{portName}}</p>
						<div class="port p-{{portType}}">
							<p>{{portValue}}</p>
						</div>
					</div>`
			},
			defaultPortValues: {
				bool: 'False',
				int: '0',
				float: '0.0',
				string: '',
				vector3: '0.000, 0.000, 0.000',
				quaternion: '0.000, 0.000, 0.000, 1.000',
				color: 'Red',
				object: '',
				exec: ''
			},
			portTypeDefinitions: {
				'bool': 'bool',
				'int': 'int',
				'float': 'float',
				'string': 'string',
				'vector3': 'vector3',
				'quaternion': 'quaternion',
				'color': 'color',
				'exec': 'exec',
				't': 'any',
				'any': 'any',
			},
			chipTypeDefinitions: {
				'^Reroute$': 'empty',
				'^Event Receiver$': 'event-receiver',
				'^Event Sender$': 'event-sender',
				'^Event Definition$': 'event-definition',
				'Variable$': 'variable',
				'^i$': 'comment',
				'^Message Sender$': 'event-sender',
				'^Message Receiver$': 'event-receiver',
				'^Circuit Board$': 'board',
				'^Data Table$': 'event-definition'
			},
			dynamicPortDefinitions: {
				'Equals': {
					extraInputs: [
						{ name: 'Value', type: 't' }
					],
				},
				'And': {
					extraInputs: [
						{ name: 'Input', type: 'bool' }
					],
				},
				'Or': {
					extraInputs: [
						{ name: 'Input', type: 'bool' }
					],
				},
				'Xor': {
					extraInputs: [
						{ name: 'Input', type: 'bool' }
					],
				},
				'Nand': {
					extraInputs: [
						{ name: 'Input', type: 'bool' }
					],
				},
				'Nor': {
					extraInputs: [
						{ name: 'Input', type: 'bool' }
					],
				},
				'String Concat': {
					extraInputs: [
						{ name: 'Value', type: 'string' }
					],
				},
				'List Create': {
					extraInputs: [
						{ name: 'Item', type: 't' }
					],
				},
				'List Except': {
					extraInputs: [
						{ name: 'Item', type: 'list<t>' }
					],
				},
				'List Intersect': {
					extraInputs: [
						{ name: 'Value', type: 'list<t>' }
					],
				},
				'Add': {
					extraInputs: [
						{ name: 'Value', type: 't' }
					],
				},
				'Subtract': {
					extraInputs: [
						{ name: 'Value', type: 't' }
					],
				},
				'Multiply': {
					extraInputs: [
						{ name: 'Value', type: 't' }
					],
				},
				'Divide': {
					extraInputs: [
						{ name: 'Value', type: 't' }
					],
				},
				'Modulo': {
					extraInputs: [
						{ name: 'Value', type: 't' }
					],
				},
				'Remainder': {
					extraInputs: [
						{ name: 'Value', type: 't' }
					],
				},
			},
			nodes: []
		};

		if (chip.nodeDescs.length !== 0) {
			let section = {
				inputs: chip.nodeDescs[0].inputs,
				outputs: chip.nodeDescs[0].outputs
			};
			_.nodes.push(section);
		} else {
			_.nodes.push({ inputs: [], outputs: [] });
		}

		if (options.log) console.log({RenderElement: element, ChipObject: chip, ChipNodes: _.nodes[0], Options: options});

		let portSectionsHTML = '';
		_.nodes.forEach(sec => {

			let inputPortsHTML = '';
			let outputPortsHTML = '';
			let portLoop = ['input', 'output'];
			portLoop.forEach(loop => {
				let ports = loop === 'input' ? sec.inputs : sec.outputs;
				if (chip.chipName in _.dynamicPortDefinitions) {
					let extraPorts = _.dynamicPortDefinitions[chip.chipName][loop === 'input' ? 'extraInputs' : 'extraOutputs'] || [];
					ports = ports.concat(extraPorts);
				}
				ports.forEach(port => {
					let portType = 'object';
					$.each(_.portTypeDefinitions, function(key, value) {
						if (port.type.toLowerCase().match(new RegExp(`\^${key}|list<${key}>`, 'gm'))) {
							portType = value;
							return false; // break loop
						}
					});
					let portHTML = _.templates.port
						.replace('{{portName}}', port.name !== '' ? port.name : '|')
						.replace('{{portType}}', port.type.toLowerCase().includes('list') ? portType + ' list' : portType)
						.replace('{{portValue}}', _.defaultPortValues[port.type.toLowerCase()] || '');
					if (loop === 'input') {
						inputPortsHTML += portHTML;
					} else {
						outputPortsHTML += portHTML;
					}
				});
			});

			portSectionsHTML += _.templates.portSection
				.replace('{{inputPorts}}', inputPortsHTML)
				.replace('{{outputPorts}}', outputPortsHTML);
		});

		let chipType = '';
		$.each(_.chipTypeDefinitions, function(key, value) {
			if (chip.chipName.match(new RegExp(`${key}`, 'gm'))) {
				chipType = value;
				return false; // break loop
			}
		});

		let chipHTML = _.templates.chip
			.replace('{{chipType}}', chipType)
			.replace('{{chipTitle}}', chip.chipName)
			.replace('{{portSections}}', portSectionsHTML);

		$(element)
			.html(`${chipHTML}`)
			.css({
				'display': 'flex',
				'justify-content': 'center',
				'align-items': 'center'
			})
			.find('.port-container .name').each(function() {
				if ($(this).text() === '|') {
					$(this).css('opacity', '0');
				}
			});
		
		$(element)
			.find('.chip')
				.css({
					'transform': `scale(${options.size})`,
				})

		function autoFit() {
			if (!options.autoFit) return;

			const $chip = $(element).find('.chip');
			if ($chip.length === 0) return;

			let containerWidth = $(element).width();
			let padding = 50; // extra space to prevent overflow

			// Keep padding on BOTH sides.
			const availableWidth = Math.max(0, containerWidth - (padding * 2));

			// Start from the desired scale.
			const baseScale = options.size;
			$chip.css({
				'transform': `scale(${baseScale})`,
			});

			// getBoundingClientRect() already includes the current transform scale,
			// so do NOT multiply by scale again.
			const rect = $chip[0].getBoundingClientRect();
			const renderedWidth = rect.width;

			if (renderedWidth <= 0 || availableWidth <= 0) return;

			// Only scale down if needed (keep the requested size otherwise).
			const fitScale = renderedWidth > availableWidth
				? baseScale * (availableWidth / renderedWidth)
				: baseScale;

			$chip.css({
				'transform': `scale(${fitScale})`,
			});
		}

		$(window).on('resize', function() {
			autoFit();
		});

		autoFit();
	},
	async get(chipName) {
		let jsonData = await getJSON(true);
		chipName = chipName.replace(/\s/gm, '');
		return jsonData[chipName];
	},
	async getAll() {
		return await getJSON();
	},
	async search(query) {
		return await search(query);
	}
}