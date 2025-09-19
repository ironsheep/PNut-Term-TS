#!/bin/bash

# Test package for PLOT hover coordinate display
# This script sets up and runs the hover coordinate test

echo "================================================"
echo "PLOT Window Hover Coordinate Display Test"
echo "================================================"
echo ""
echo "This test verifies the new mouse hover coordinate display feature."
echo ""

# Check if dist files exist
if [ ! -f "../dist/pnut-term-ts.js" ]; then
    echo "❌ Error: Build files not found. Please run 'npm run build' first."
    exit 1
fi

# Copy test files
echo "📦 Setting up test files..."
cp ../test-plot-hover.spin2 . 2>/dev/null || echo "   Note: test-plot-hover.spin2 not found, creating..."

# Create test file if it doesn't exist
cat > test-plot-hover.spin2 << 'EOF'
'' Test PLOT window hover coordinate display
CON _clkfreq = 100_000_000

PUB go() | i

 ' Test 1: Basic PLOT with coordinate display
 debug(`PLOT MyPlot SIZE 400 300 COLOR BLACK CYAN)
 debug(`MyPlot TEXT 10 10 'Move mouse to see coordinates')

 ' Draw a grid for reference
 repeat i from 0 to 400 step 50
   debug(`MyPlot LINE `(i) 0 `(i) 300 LINESIZE 1 GRAY 8)

 repeat i from 0 to 300 step 50
   debug(`MyPlot LINE 0 `(i) 400 `(i) LINESIZE 1 GRAY 8)

 ' Draw test points
 debug(`MyPlot DOT 100 100 DOTSIZE 5 RED 15)
 debug(`MyPlot DOT 200 150 DOTSIZE 5 GREEN 15)
 debug(`MyPlot DOT 300 200 DOTSIZE 5 BLUE 15)

 ' Add labels
 debug(`MyPlot TEXT 85 115 '(100,100)' TEXTSIZE 10 WHITE`)
 debug(`MyPlot TEXT 185 165 '(200,150)' TEXTSIZE 10 WHITE`)
 debug(`MyPlot TEXT 285 215 '(300,200)' TEXTSIZE 10 WHITE`)

 repeat
   waitms(100)

'' Test 2: With DOTSIZE scaling
PUB test_scaled() | i

 debug(`PLOT Scaled SIZE 400 300 DOTSIZE 2 2 COLOR BLACK YELLOW)
 debug(`Scaled TEXT 10 10 'DOTSIZE 2x2 - coords are halved')

 ' With DOTSIZE 2,2 pixel coords are divided by 2
 debug(`Scaled DOT 50 50 DOTSIZE 5 RED 15)   ' Shows as (50,50) at pixel 100,100
 debug(`Scaled DOT 100 75 DOTSIZE 5 GREEN 15) ' Shows as (100,75) at pixel 200,150

 repeat
   waitms(100)

'' Test 3: With inverted axes
PUB test_inverted() | i

 debug(`PLOT Inverted SIZE 400 300 CARTESIAN 1 0 COLOR BLACK WHITE)
 debug(`Inverted TEXT 10 10 'X-axis inverted')

 debug(`Inverted DOT 100 100 DOTSIZE 5 RED 15)
 debug(`Inverted TEXT 85 115 'Check hover coords')

 repeat
   waitms(100)

'' Test 4: HIDEXY - no coordinate display
PUB test_hidexy() | i

 debug(`PLOT NoCoords SIZE 400 300 HIDEXY COLOR BLACK GRAY)
 debug(`NoCoords TEXT 150 140 'HIDEXY - No coords shown')
 debug(`NoCoords DOT 200 150 DOTSIZE 10 CYAN 15)

 repeat
   waitms(100)
EOF

echo "✅ Test file created: test-plot-hover.spin2"
echo ""
echo "================================================"
echo "Test Instructions:"
echo "================================================"
echo ""
echo "1. Run the test with your P2 hardware connected:"
echo "   node ../dist/pnut-term-ts.js test-plot-hover.spin2"
echo ""
echo "2. Move your mouse over the PLOT window"
echo ""
echo "3. Expected behavior:"
echo "   • Coordinates appear near mouse cursor as 'x,y'"
echo "   • Display moves to avoid obscuring data"
echo "   • Coordinates match logical units (divided by DOTSIZE)"
echo "   • With HIDEXY, no coordinates are shown"
echo ""
echo "4. Test different configurations:"
echo "   • test_scaled() - Tests DOTSIZE scaling"
echo "   • test_inverted() - Tests axis inversion"
echo "   • test_hidexy() - Tests coordinate hiding"
echo ""
echo "================================================"
echo "Visual Verification:"
echo "================================================"
echo ""
echo "• Hover over red dot at (100,100) → Should show '100,100'"
echo "• Hover over green dot at (200,150) → Should show '200,150'"
echo "• Hover over blue dot at (300,200) → Should show '300,200'"
echo ""
echo "• In scaled view: coordinates should be halved"
echo "• In inverted view: X coordinates count from right"
echo "• In HIDEXY view: no coordinates displayed"
echo ""
echo "Ready to test!"