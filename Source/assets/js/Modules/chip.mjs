const _ = {
	repo: {
		mainUrl: 'https://raw.githubusercontent.com/PckyDev/Rec-Room-Circuits-Viewer/refs/heads/main/',
		circuitsDataPath: 'Circuits%20Data/CV2_ChipConfigs.json',
		objectsDataPath: 'Circuits%20Data/CV2_ObjectConfigs.json',
		css: {
			basePath: 'Source/assets/css/Chip/',
			files: [
				'chip-layout.css',
				'chip-versions.css',
				'port-colors.css',
				'port-sizes.css',
				'port-versions.css',
				'port-hover.css'
			]
		}
	}
}

async function getInfo() {
	const circuits = await fetch(`${_.repo.mainUrl}${_.repo.circuitsDataPath}`);
	const circuitsData = await circuits.json();

	const objects = await fetch(`${_.repo.mainUrl}${_.repo.objectsDataPath}`);
	const objectsData = await objects.json();

	let data = {
		chips: circuitsData,
		objects: objectsData,
	};

	const getProperties = {
		chips: [ 'exportedAtUtc', 'sourceFolder', 'configuredSourceFolder', 'sourceFolderUsedFallback', 'count' ],
		objects: [ 'updatedAtUtc', 'count' ]
	};	

	let info = {};

	$.each(data, function(key, value) {
		info[key] = {};
		getProperties[key].forEach(prop => {
			if (prop.toLowerCase().includes('date') || prop.toLowerCase().includes('time') || prop.toLowerCase().includes('utc')) {
				let date = new Date(value[prop]);
				info[key][prop] = date.toLocaleString();
			} else {
				info[key][prop] = value[prop];
			}
		});
	});

	return info;
}

async function combineJSON(chipsOpt, objectsOpt) {
	const chips = chipsOpt || await getJSON().then(data => data.chips);
	const objects = objectsOpt || await getJSON().then(data => data.objects);

	let combined = {};

	$.each(chips, function(chipName, chipData) {
		combined[chipName] = chipData;
	});

	$.each(objects, function(objectName, objectData) {
		if (objectName in combined) {
			console.warn(`Name conflict for "${objectName}". Object will overwrite chip with the same name in combined results.`);
		}
		combined[objectName] = objectData;
	});

	return combined;
}

async function getJSON(opt) {

	const options = {
		combineResults: opt?.combineResults || false,
	}

	const circuits = await fetch(`${_.repo.mainUrl}${_.repo.circuitsDataPath}`);
	const circuitsData = await circuits.json();

	const objects = await fetch(`${_.repo.mainUrl}${_.repo.objectsDataPath}`);
	const objectsData = await objects.json();

	let data = {
		chips: circuitsData.configs,
		objects: objectsData.configs
	};

	if (options.combineResults) {
		await combineJSON(data.chips, data.objects).then(combinedData => {
			data = combinedData;
		});
	}
	
	return data;
}

async function search(query, opt) {

	const options = {
		chipsJSON: opt?.chipsJSON || null,
		combineResults: opt?.combineResults || false,
	}

	let jsonData = options.chipsJSON || await getJSON();

	// Check if jsonData is already combined (has chip and object names at the same level) or if it is still separated by category.
	let jsonDataIsCombined = true;
	if (jsonData.chips) {
		jsonDataIsCombined = false;
	}

	let results = {};
	
	query = query.toLowerCase().replace(/\s/gm, '');

	if (jsonDataIsCombined) {
		$.each(jsonData, function(chipName, chipData) {
			if (chipName.toLowerCase().replace(/\s/gm, '').match(new RegExp(`${query}`, 'gm'))) {
				results[chipName] = chipData;
			}
		});
	} else {
		$.each(jsonData, function(key, value) {
			$.each(value, function(chipName, chipData) {
				if (chipName.toLowerCase().replace(/\s/gm, '').match(new RegExp(`${query}`, 'gm'))) {
					if (options.combineResults) {
						results[chipName] = chipData;
						return;
					}
					results[key] = results[key] || {};
					results[key][chipName] = chipData;
				}
			});
		});
	}

	// Sort results alphabetically by chipName within each category (chips/objects) or overall if combined.
	if (options.combineResults) {
		results = Object.fromEntries(Object.entries(results).sort((a, b) => a[0].localeCompare(b[0])));
	} else {
		$.each(results, function(key, value) {
			results[key] = Object.fromEntries(Object.entries(value).sort((a, b) => a[0].localeCompare(b[0])));
		});
	}

	return results;
}

async function initPortsHover(chipElement) {
	const portHoverTemplate = `
		<div class="port-hover">
			<p class="title">{{type}}</p>
			<p class="value">{{value}}</p>
			<svg class="disconnect" xmlns="http://www.w3.org/2000/svg" viewBox="-64 0 512 512" width="1em" height="1em" fill="currentColor">
				<path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"></path>
			</svg>
			<svg class="not-allowed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor">
				<path d="M367.2 412.5L99.5 144.8C77.1 176.1 64 214.5 64 256c0 106 86 192 192 192c41.5 0 79.9-13.1 111.2-35.5zm45.3-45.3C434.9 335.9 448 297.5 448 256c0-106-86-192-192-192c-41.5 0-79.9 13.1-111.2 35.5L412.5 367.2zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z"></path>
			</svg>
		</div>`;
	
	$(chipElement).find('.port').each(function() {
		const portElement = $(this);
		const portType = portElement.attr('portType') || '';
		const portValue = portElement.attr('portValue') || '';

		const hoverElement = $(portHoverTemplate
			.replace('{{type}}', portType)
			.replace('{{value}}', portValue)
		);

		portElement.parent().append(hoverElement);

		// Position the hover element above the port and centered horizontally
		function positionHover() {
			// const portSide = portElement.parent().parent().hasClass('input') ? 'left' : 'right');
		}

		positionHover();

		portElement.on('mouseenter', function() {
			hoverElement.addClass('show');
		}).on('mouseleave', function() {
			hoverElement.removeClass('show');
		});
	});
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

		const data = await getInfo();
		const logData = [
			'///////////////////////////////////////////////////////',
			'Rec Room Circuits API initialized',
			'- Chips: ' + data.chips.count + ' / Updated: ' + data.chips.exportedAtUtc,
			'- Objects: ' + data.objects.count + ' / Updated: ' + data.objects.updatedAtUtc,
			'///////////////////////////////////////////////////////'
		];
		logData.forEach(line => console.log(line));

		return data;
	},
	async render(element, chip, opt) {

		if (!chip) {
			console.error('Element and chip parameters are required to render a chip.');
			return;
		}

		if (typeof chip == 'string') {
			chip = chip.replace(/\s/gm, '');
			await search(chip, { combineResults: true }).then(results => {
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
			autoFit: opt?.autoFit || true,
			enablePortHover: opt?.enablePortHover || false
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
						<div portType="{{actualPortType}}" portValue="{{actualPortValue}}" class="port p-{{portType}}">
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
			portDefinitions: {
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
				'Self': {
					replaceOutputs: [
						{ name: '|', type: 'object' }
					],
				}
			},
			nodes: []
		};

		_.nodes = (chip.nodeDescs
			? (globalThis.structuredClone
				? structuredClone(chip.nodeDescs)
				: JSON.parse(JSON.stringify(chip.nodeDescs)))
			: []);

		if (options.log) console.log({RenderElement: element, ChipObject: chip, ChipNodes: _.nodes, Options: options});

		let portSectionsHTML = '';
		_.nodes.forEach(sec => {

			let inputPortsHTML = '';
			let outputPortsHTML = '';
			let portLoop = ['input', 'output'];
			portLoop.forEach(loop => {
				let ports = (loop === 'input' ? (sec.inputs || []) : (sec.outputs || [])).slice();

				if (chip.chipName in _.portDefinitions) {
					const def = _.portDefinitions[chip.chipName];

					const extraKey = loop === 'input' ? 'extraInputs' : 'extraOutputs';
					const extraPorts = Array.isArray(def[extraKey]) ? def[extraKey] : [];
					if (extraPorts.length > 0) {
						ports = ports.concat(extraPorts);
					}

					const replaceKey = loop === 'input' ? 'replaceInputs' : 'replaceOutputs';
					const replacePorts = Array.isArray(def[replaceKey]) ? def[replaceKey] : [];
					if (replacePorts.length > 0) {
						ports = replacePorts.slice();
					}
				}

				// Store the resolved ports on the cloned node data so render(null, ...) can return them
				// without mutating the cached JSON objects used for later renders.
				if (!element) {
					if (loop === 'input') {
						sec.inputs = ports;
					} else {
						sec.outputs = ports;
					}
				}

				ports.forEach(port => {
					let portType = 'object';
					$.each(_.portTypeDefinitions, function(key, value) {
						if (port.type.toLowerCase().match(new RegExp(`\^${key}|list<${key}>`, 'gm'))) {
							portType = value;
							return false; // break loop
						}
					});

					const typeParams = sec.typeParams || [];
					let actualPortType = port.type;
					if (actualPortType.toLowerCase() == 't') {
						if (typeParams.length > 0) {
							$.each(typeParams, function(i, param) {
								if (param.name.toLowerCase() == 't') {
									actualPortType = param.type;
									return false; // break loop
								}
							});
						}
					}
						

					let portHTML = _.templates.port
						.replace('{{portName}}', port.name !== '' ? port.name : '|')
						.replace('{{portType}}', port.type.toLowerCase().includes('list') ? portType + ' list' : portType)
						.replace('{{portValue}}', _.defaultPortValues[port.type.toLowerCase()] || '')
						.replace('{{actualPortType}}', actualPortType)
						.replace('{{actualPortValue}}', _.defaultPortValues[port.type.toLowerCase()] || '');
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
		if (chip.isObjectBoard) {
			chipType = 'board';
		} else {
			$.each(_.chipTypeDefinitions, function(key, value) {
				if (chip.chipName.match(new RegExp(`${key}`, 'gm'))) {
					chipType = value;
					return false; // break loop
				}
			});
		}

		let chipHTML = _.templates.chip
			.replace('{{chipType}}', chipType)
			.replace('{{chipTitle}}', chip.chipName)
			.replace('{{portSections}}', portSectionsHTML)
			.replaceAll('class="name">|<', 'class="name" style="opacity: 0;">|<');

		if (element) {
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
				})
				.attr('identifier', chip.chipName.toLowerCase().replace(/\s/g, ''));
			
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

			if (options.autoFit) {
				$("body")
					.on('resize-' + chip.chipName.toLowerCase().replace(/\s/g, ''), function() {
						autoFit();
					})
					.on('resize-chips', function() {
						autoFit();
					});

				autoFit();
			}

			if (options.enablePortHover) {
				initPortsHover($(element).find('.chip'));
			}
		} else {
			return {
				html: chipHTML,
				object: {
					...chip,
					nodeDescs: _.nodes,
				},
			};
		}
	},
	async get(chipName) {
		let jsonData = await getJSON({ combineResults: true });
		chipName = chipName.replace(/\s/gm, '');
		return jsonData[chipName];
	},
	async getAll(opt) {
		return await getJSON(opt);
	},
	async search(query, opt) {
		return await search(query, opt);
	},
	async initPortsHover(nodeElement) {
		if (!nodeElement) return;
		initPortsHover(nodeElement);
	}

}