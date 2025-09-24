/* eslint-disable no-console */
// insertBuildDate.js
const fs = require('fs');
const path = require('path');

// Use minified file if it exists, otherwise use regular
const minFilePath = path.join(__dirname, '../dist/pnut-term-ts.min.js');
const regularFilePath = path.join(__dirname, '../dist/pnut-term-ts.js');
const outfileName = fs.existsSync(minFilePath) ? '../dist/pnut-term-ts.min.js' : '../dist/pnut-term-ts.js';

const filePath = path.join(__dirname, outfileName); // Update this path to your compiled JavaScript file
const buildDate = new Date();

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading file from disk: ${err}`);
  } else {
    // Replace the placeholder with the build date
    const result = data.replace('{buildDateHere}', `Build date: ${buildDate.toLocaleDateString()}`);

    fs.writeFile(filePath, result, 'utf8', (err) => {
      if (err) {
        console.error(`Error writing file: ${err}`);
      }
    });
    console.log(`Updated: ${outfileName}`);
  }
});
