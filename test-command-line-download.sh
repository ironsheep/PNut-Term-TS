#!/bin/bash

# Test script for command-line download functionality

echo "================================================="
echo "Testing PNut-Term-TS Command-Line Download"
echo "================================================="
echo ""

# Create a test binary file if it doesn't exist
if [ ! -f test-download.bin ]; then
    echo "Creating test binary file..."
    echo -e "#!/bin/bash\necho 'Test binary file'" > test-download.bin
    chmod +x test-download.bin
fi

echo "Test binary file: test-download.bin"
echo ""

# Test 1: Download to RAM
echo "Test 1: Download to RAM"
echo "Command: pnut-term-ts -r test-download.bin"
echo ""
echo "Expected behavior:"
echo "  - Should auto-detect USB device (if only one connected)"
echo "  - Should download test-download.bin to RAM"
echo "  - Should display download progress and status"
echo ""

# Test 2: Download to FLASH
echo "Test 2: Download to FLASH"
echo "Command: pnut-term-ts -f test-download.bin"
echo ""
echo "Expected behavior:"
echo "  - Should auto-detect USB device (if only one connected)"
echo "  - Should download test-download.bin to FLASH"
echo "  - Should display download progress and status"
echo ""

# Test 3: Download with specific device
echo "Test 3: Download with specific device"
echo "Command: pnut-term-ts -r test-download.bin -p <device>"
echo ""
echo "Expected behavior:"
echo "  - Should use specified device"
echo "  - Should download test-download.bin to RAM"
echo ""

echo "================================================="
echo "To run tests manually:"
echo ""
echo "1. List available devices:"
echo "   ./dist/pnut-term-ts.min.js -n"
echo ""
echo "2. Test RAM download (auto-detect):"
echo "   ./dist/pnut-term-ts.min.js -r test-download.bin"
echo ""
echo "3. Test FLASH download (auto-detect):"
echo "   ./dist/pnut-term-ts.min.js -f test-download.bin"
echo ""
echo "4. Test with specific device:"
echo "   ./dist/pnut-term-ts.min.js -r test-download.bin -p <device-name>"
echo ""
echo "================================================="