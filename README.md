<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=soft&height=100&color=0:d97028,100:d93e27&text=Rec%20Room&section=header&reversal=false&animation=fadeIn&fontColor=eae8e4&desc=Circuits%20API%20and%20Graph%20Editor&descSize=25&fontAlignY=60&descAlignY=85">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FPckyDev%2FRec-Room-Circuits-API%2Frefs%2Fheads%2Fmain%2FCircuits%2520Data%2FCV2_ChipConfigs.json&query=%24.exportedAtUtc&style=flat&label=Chips%20Updated&color=%23d97028"> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FPckyDev%2FRec-Room-Circuits-API%2Frefs%2Fheads%2Fmain%2FCircuits%2520Data%2FCV2_ChipConfigs.json&query=%24.count&style=flat&label=Chips%20Count&color=%23d97028"> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FPckyDev%2FRec-Room-Circuits-API%2Frefs%2Fheads%2Fmain%2FCircuits%2520Data%2FCV2_ObjectConfigs.json&query=%24.updatedAtUtc&style=flat&label=Objects%20Updated&color=%23d93e27"> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FPckyDev%2FRec-Room-Circuits-API%2Frefs%2Fheads%2Fmain%2FCircuits%2520Data%2FCV2_ObjectConfigs.json&query=%24.count&style=flat&label=Objects%20Count&color=%23d93e27">
</p>

<p align="center">
	A comprehensive API and graph editor for Rec Room's Circuits V2, featuring detailed data on chips and object boards, as well as a visual graph editor for creating circuit layouts.
</p>

---

## Circuits API
The Circuits API provides access to detailed information about Rec Room's Circuits V2, including data on chips and object boards. The API is designed to be easy to use and integrate into your projects, allowing you to retrieve information about chips, object boards, and their properties. And even allows you to render a visual representation of a chip or object board in HTML and CSS!

## Prerequisites
To use the Circuits API, you will need:
- A modern web browser that supports ES6 modules (e.g., Chrome, Firefox, Edge).
- Basic knowledge of JavaScript and how to import modules.
- jQuery library included in your project, as the API uses jQuery for DOM manipulation in the rendering functions. You can include it via CDN:
	```html
	<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
	```
- An internet connection to access the API data hosted on GitHub.
- (Optional) A code editor for working with the API in your projects.

## How to Use
To use the Circuits API, you can use one of two methods:

### 1. Local Import
You can download the [chip.mjs](https://github.com/PckyDev/Rec-Room-Circuits-API/blob/main/Source/assets/js/Modules/chip.mjs) module file from the repository and import it into your project like so:
```javascript
import { chip } from './chip.mjs';
```

### 2. Fetch from GitHub
Alternatively, you can fetch the module directly from GitHub using a simple function like this:
```javascript
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
```

## How to Initialize the API
Once you have imported the `chip` module, you can initialize the API by calling the `init` method. This will load the chip, object board, and styling data from the API and prepare it for use in your project. Here's how you can do it:
```javascript
// Initialize the Circuits API
await chip.init();
```

## How to Get Chip and Object Board Data
After initializing the API, you can retrieve data about chips and object boards using the following methods:
```javascript
// Get all chips
const allChips = chip.getAll(options);

// Options is an optional object that can have the following properties:
{
  combineResults: boolean, // If true, combines chips and object boards into a single object with chip names as keys. Default is false.
}

// If combineResults is false (default), the result will be an object with two properties:
{
  chips: { [chipName]: chipData, ... },
  objects: { [objectName]: objectData, ... },
}

// If combineResults is true, the result will be an object with chip and object board data combined:
{
  [chipOrObjectName]: chipOrObjectData,
  ...
}
```

## How to Get a Specific Chip or Object Board
You can also retrieve data for a specific chip or object board by name:
```javascript
// Get a specific chip by name
const chipData = chip.get(chipName);
```

## How to Search for Chips and Object Boards
The API also provides a search function that allows you to find chips and object boards based on a search term:
```javascript
// Search for chips and object boards by search query
const searchResults = chip.search(query, options);

// query is the search term (string)
// options is an optional object that can have the following properties:
{
  chipsJSON: {}, // Optional JSON object to search within instead of the default chip data.
  combineResults: boolean // If true, combines chips and object boards into a single object with chip names as keys. Default is false.
}
```
The search method will by default fetch the chip data from the API for every search request, but you can also provide your own JSON data to search through using the `chipsJSON` option. This can be useful if you want to perform multiple searches without repeatedly fetching the data from the API.

## How to Render a Chip or Object Board
The API includes a rendering function that allows you to create a visual representation of a chip or object board using HTML and CSS. You can use this function like so:
```javascript
// Render a chip or object board by name
chip.render(element, chip, options);

// element is the DOM element (or jQuery selector) where the chip will be rendered
// You can leave element undefined or null to create the chip rendering data without actually rendering it to the DOM.
// It will return the chip rendering data so you can manipulate it or render it to the DOM yourself later if you want.

// chip is the name or data object of the chip or object board to render

// options is an optional object that can have the following properties:
{
  log: boolean, // If true, logs the rendered chip data to the console for debugging purposes. Default is false.
  size: number, // The size (in scale) of the rendered chip. Default is 1.
  autoFit: boolean, // If true, automatically scales the chip to fit within the container element. Default is true.
  enablePortHover: boolean, // If true, enables hover effects on the chip's ports to show their type and value. Default is false.
}
```

---

## Disclaimer
> [!NOTE]
> This project is not affiliated with Rec Room. It is intended for educational and informational purposes only, and should not be used for commercial applications or in violation of Rec Room's terms of service.