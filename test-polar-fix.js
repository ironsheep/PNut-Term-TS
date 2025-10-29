#!/usr/bin/env node

// Quick test to verify POLAR command parsing fix
console.log("Testing POLAR command parameter parsing fix...\n");

// Test case 1: POLAR with 2 parameters (angle, scale)
const testCommand1 = "polar -64 -16";
console.log(`Test 1: "${testCommand1}"`);
console.log("Expected: startAngle=-64, angleScale=-16, centerRadius=0 (default)");

// Test case 2: POLAR with 3 parameters (angle, scale, radius)
const testCommand2 = "polar -64 -16 50";
console.log(`\nTest 2: "${testCommand2}"`);
console.log("Expected: startAngle=-64, angleScale=-16, centerRadius=50");

// Test case 3: Compound command with origin and polar
const testCommand3 = "origin 300 270 polar -64 -16";
console.log(`\nTest 3: "${testCommand3}"`);
console.log("Expected: origin.x=300, origin.y=270, polar mode with startAngle=-64, angleScale=-16");

// Test case 4: SET after polar mode
const testCommand4 = "set 103 -59";
console.log(`\nTest 4: After polar mode, "${testCommand4}"`);
console.log("Expected: Should calculate polar coordinates correctly");
console.log("  angle = (-59 + (-64)) * (-16) * PI / 180 = (-123 * -16 * PI) / 180");
console.log("  radius = 103 + 0 = 103");
console.log("  x = 300 + round(103 * cos(angle))");
console.log("  y = 270 + round(103 * sin(angle))");

console.log("\n✅ Manual test instructions:");
console.log("1. Run the application with external hardware");
console.log("2. Check that PLOT window objects render at correct positions");
console.log("3. Verify circles are not all at origin (300, 270)");
console.log("4. Check console logs for 'getCursorXY() returning' messages");