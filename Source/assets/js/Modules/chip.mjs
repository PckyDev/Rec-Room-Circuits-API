export function chip(element, obj) {

	const chip = {
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

	console.log(element, obj);

	let section = {
		inputs: obj.NodeDescs[0].Inputs,
		outputs: obj.NodeDescs[0].Outputs
	};
	chip.nodes.push(section);

	// console.log(chip.nodes[0]);

	let portSectionsHTML = '';
	chip.nodes.forEach(sec => {

		let inputPortsHTML = '';
		sec.inputs.forEach(input => {
			let portType = 'object';
			$.each(chip.portTypeDefinitions, function(key, value) {
				if (input.ReadonlyType.toLowerCase().match(new RegExp(`\^${key}|list<${key}>`, 'gm'))) {
					portType = value;
					return false; // break loop
				}
			});
			inputPortsHTML += chip.templates.port
				.replace('{{portName}}', input.Name !== '' ? input.Name : '|')
				.replace('{{portType}}', input.ReadonlyType.toLowerCase().includes('list') ? portType + ' list' : portType)
				.replace('{{portValue}}', chip.defaultPortValues[input.ReadonlyType.toLowerCase()] || '');
		});

		let outputPortsHTML = '';
		sec.outputs.forEach(output => {
			let portType = 'object';
			$.each(chip.portTypeDefinitions, function(key, value) {
				if (output.ReadonlyType.toLowerCase().match(new RegExp(`\^${key}|list<${key}>`, 'gm'))) {
					portType = value;
					return false; // break loop
				}
			});
			outputPortsHTML += chip.templates.port
				.replace('{{portName}}', output.Name !== '' ? output.Name : '|')
				.replace('{{portType}}', output.ReadonlyType.toLowerCase().includes('list') ? portType + ' list' : portType)
				.replace('{{portValue}}', chip.defaultPortValues[output.ReadonlyType.toLowerCase()] || '');
		});
		portSectionsHTML += chip.templates.portSection
			.replace('{{inputPorts}}', inputPortsHTML)
			.replace('{{outputPorts}}', outputPortsHTML);
	});

	let chipType = '';
	$.each(chip.chipTypeDefinitions, function(key, value) {
		if (obj.ReadonlyChipName.match(new RegExp(`^${key}`, 'gm'))) {
			chipType = value;
			return false; // break loop
		}
	});

	let chipHTML = chip.templates.chip
		.replace('{{chipType}}', chipType)
		.replace('{{chipTitle}}', obj.ReadonlyChipName)
		.replace('{{portSections}}', portSectionsHTML);

	$(element).html(`${chipHTML}`);

	$(element).find('.port-container .name').each(function() {
		if ($(this).text() === '|') {
			$(this).css('opacity', '0');
		}
	});

}