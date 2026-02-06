async function getJSON(converted) {
	const res = await fetch('https://raw.githubusercontent.com/tyleo-rec/CircuitsV2Resources/refs/heads/master/misc/circuitsv2.json');
	const data = await res.json();
	
	if (converted) {
		let converted = {};
		$.each(data.Nodes, async function (index, chip) {
			if (chip.DeprecationStage !== 'Deprecated') {
				let chipName = chip.ReadonlyPaletteName.replace(/\s/gm, '');
				converted[chipName] = chip;
			}
		});
		return converted;
	} else {
		return data;
	}
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
	
	async render(element, chip, opt) {

		if (!element || !chip) {
			console.error('Element and chip parameters are required to render a chip.');
			return;
		}

		if (typeof chip == 'string') {
			chip = chip.replace(/\s/gm, '');
			await search(chip).then(results => {
				if (Object.keys(results).length > 0) {
					chip = results[Object.keys(results)[0]];
				} else {
					console.error(`No chip found matching "${chip}".`);
					return;
				}
			});
		}

		const options = {
			log: opt?.log || false,
			size: opt?.size || 1,
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
			},
			chipTypeDefinitions: {
				'Reroute': 'empty',
				'Event Receiver': 'event-receiver',
				'Event Sender': 'event-sender',
				'Event Definition': 'event-definition',
				'Variable': 'variable',
				'i': 'comment',
			},
			nodes: []
		};

		let section = {
			inputs: chip.NodeDescs[0].Inputs,
			outputs: chip.NodeDescs[0].Outputs
		};
		_.nodes.push(section);

		if (options.log) console.log({RenderElement: element, ChipObject: chip, ChipNodes: _.nodes[0], Options: options});

		let portSectionsHTML = '';
		_.nodes.forEach(sec => {

			let inputPortsHTML = '';
			let outputPortsHTML = '';
			let portLoop = ['input', 'output'];
			portLoop.forEach(loop => {
				let ports = loop === 'input' ? sec.inputs : sec.outputs;
				ports.forEach(port => {
					let portType = 'object';
					$.each(_.portTypeDefinitions, function(key, value) {
						if (port.ReadonlyType.toLowerCase().match(new RegExp(`\^${key}|list<${key}>`, 'gm'))) {
							portType = value;
							return false; // break loop
						}
					});
					let portHTML = _.templates.port
						.replace('{{portName}}', port.Name !== '' ? port.Name : '|')
						.replace('{{portType}}', port.ReadonlyType.toLowerCase().includes('list') ? portType + ' list' : portType)
						.replace('{{portValue}}', _.defaultPortValues[port.ReadonlyType.toLowerCase()] || '');
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
			if (chip.ReadonlyChipName.match(new RegExp(`^${key}|${key}$`, 'gm'))) {
				chipType = value;
				return false; // break loop
			}
		});

		let chipHTML = _.templates.chip
			.replace('{{chipType}}', chipType)
			.replace('{{chipTitle}}', chip.ReadonlyChipName)
			.replace('{{portSections}}', portSectionsHTML);

		$(element)
			.html(`${chipHTML}`)
			.css({
				'display': 'flex',
				'justify-content': 'center',
				'align-items': 'center'
			});

		$(element)
			.css({
				'transform': `scale(${options.size})`,
			})
			.find('.port-container .name').each(function() {
				if ($(this).text() === '|') {
					$(this).css('opacity', '0');
				}
			});

	},
	async get(chipName) {
		let jsonData = await getJSON(true);
		chipName = chipName.replace(/\s/gm, '');
		return jsonData[chipName];
	},
	async getAll(converted) {
		return await getJSON(converted);
	},
	async search(query) {
		return await search(query);
	}
}