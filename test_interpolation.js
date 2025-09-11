var mode = 'RTS';
// Test 1: Normal template literal
var test1 = "resetButton.textContent = '".concat(mode, "';");
console.log('Test 1:', test1);
// Test 2: Without quotes
var test2 = "resetButton.textContent = ".concat(mode, ";");
console.log('Test 2:', test2);
// Test 3: Escaping dollar
var test3 = "resetButton.textContent = '${mode}';";
console.log('Test 3:', test3);
// What we actually have in the file
var script = "\n  if (resetButton) {\n    resetButton.textContent = '".concat(mode, "';\n  }\n");
console.log('Actual:', script);
