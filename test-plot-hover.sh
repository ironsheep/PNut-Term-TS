#!/bin/bash

echo "Testing PLOT window hover coordinate display..."
echo ""
echo "This test creates a PLOT window with a grid and reference dots."
echo "Move your mouse over the window to see coordinates displayed."
echo ""
echo "Expected behavior:"
echo "1. Coordinates should appear as 'x,y' near the mouse cursor"
echo "2. The flyout should avoid obscuring the cursor position"
echo "3. Coordinates should be in logical units (divided by DOTSIZE)"
echo "4. With HIDEXY, no coordinates should be shown"
echo ""
echo "Running test..."

# Run the test (adjust path as needed)
node dist/pnut-term-ts.js test-plot-hover.spin2