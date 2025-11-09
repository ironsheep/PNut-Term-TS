#!/bin/bash
# Notarize and staple DMG files for distribution

set -e

echo "🔐 PNut-Term-TS DMG Notarization & Stapling"
echo "==========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Auto-detect DMG files by pattern
echo "🔍 Auto-detecting DMG files..."
X64_DMG=""
ARM64_DMG=""

# Find x64 DMG by pattern
X64_DMG=$(find . -maxdepth 1 -type f -name "pnut-term-ts-macos-x64-*.dmg" | head -1)
if [ -n "$X64_DMG" ]; then
    X64_DMG=$(basename "$X64_DMG")
    echo "✅ Found x64 DMG: $X64_DMG"
else
    echo "⚠️  x64 DMG not found"
fi

# Find arm64 DMG by pattern
ARM64_DMG=$(find . -maxdepth 1 -type f -name "pnut-term-ts-macos-arm64-*.dmg" | head -1)
if [ -n "$ARM64_DMG" ]; then
    ARM64_DMG=$(basename "$ARM64_DMG")
    echo "✅ Found arm64 DMG: $ARM64_DMG"
else
    echo "⚠️  arm64 DMG not found"
fi

if [ -z "$X64_DMG" ] && [ -z "$ARM64_DMG" ]; then
    echo ""
    echo "❌ No DMG files found!"
    echo ""
    echo "Please run CREATE-DMGS.command first"
    echo ""
    echo "Press any key to exit..."
    read -n 1 -s
    exit 1
fi

echo ""
echo "📝 This script will notarize your DMGs with Apple"
echo "   Using keychain profile: pnut-ts-notary"
echo ""

# Function to notarize a DMG
notarize_dmg() {
    local DMG_FILE=$1
    local ARCH=$2

    echo ""
    echo "=========================================="
    echo -e "${BLUE}🔄 Notarizing $ARCH DMG...${NC}"
    echo "=========================================="
    echo ""

    # Submit for notarization
    echo "📤 Submitting to Apple for notarization..."
    echo "   This may take several minutes..."
    echo ""

    # Run notarization and capture output
    NOTARIZE_OUTPUT=$(xcrun notarytool submit "${DMG_FILE}" --keychain-profile "pnut-ts-notary" --wait 2>&1)
    NOTARIZE_RESULT=$?

    # Display the output
    echo "$NOTARIZE_OUTPUT"
    echo ""

    # Check for success in the output (look for "status: Accepted")
    if echo "$NOTARIZE_OUTPUT" | grep -q "status: Accepted"; then
        echo -e "${GREEN}✅ Notarization successful!${NC}"
        echo ""

        # Now staple the ticket
        echo "📎 Stapling notarization ticket..."
        xcrun stapler staple "${DMG_FILE}"

        echo ""
        echo "🔍 Validating stapled DMG..."
        xcrun stapler validate "${DMG_FILE}"

        echo ""
        echo -e "${GREEN}✅ $ARCH DMG fully notarized and stapled!${NC}"

        return 0
    elif echo "$NOTARIZE_OUTPUT" | grep -q "status: Invalid"; then
        echo ""
        echo -e "${RED}❌ Notarization INVALID for $ARCH DMG${NC}"
        echo ""

        # Extract submission ID if available
        SUBMISSION_ID=$(echo "$NOTARIZE_OUTPUT" | grep -o "id: [a-f0-9-]*" | head -1 | cut -d' ' -f2)

        if [ -n "$SUBMISSION_ID" ]; then
            echo "To check the detailed log, run:"
            echo -e "${YELLOW}xcrun notarytool log '$SUBMISSION_ID' --keychain-profile \"pnut-ts-notary\"${NC}"
        fi

        echo ""
        echo "Common causes of Invalid status:"
        echo "  - Unsigned or incorrectly signed code"
        echo "  - Missing hardened runtime entitlements"
        echo "  - Unsigned libraries or frameworks"
        echo "  - Code signing certificate issues"
        echo ""
        echo "Fix: Re-run SIGN-APPS.command with proper signing"

        return 1
    elif echo "$NOTARIZE_OUTPUT" | grep -q "status: Rejected"; then
        echo ""
        echo -e "${RED}❌ Notarization REJECTED for $ARCH DMG${NC}"
        echo ""

        # Extract submission ID if available
        SUBMISSION_ID=$(echo "$NOTARIZE_OUTPUT" | grep -o "id: [a-f0-9-]*" | head -1 | cut -d' ' -f2)

        if [ -n "$SUBMISSION_ID" ]; then
            echo "To check the detailed log, run:"
            echo -e "${YELLOW}xcrun notarytool log '$SUBMISSION_ID' --keychain-profile \"pnut-ts-notary\"${NC}"
        fi

        echo ""
        echo "Apple has rejected this submission."
        echo "Check the log for specific requirements."

        return 1
    elif [ $NOTARIZE_RESULT -ne 0 ]; then
        echo ""
        echo -e "${RED}❌ Notarization submission failed for $ARCH DMG${NC}"
        echo ""
        echo "Common issues:"
        echo "  - Network connectivity problems"
        echo "  - Invalid keychain profile"
        echo "  - Authentication issues"
        echo "  - Apple service downtime"

        return 1
    else
        echo ""
        echo -e "${YELLOW}⚠️  Unknown notarization status for $ARCH DMG${NC}"
        echo ""
        echo "Could not determine status from output."
        echo "Check output above for details."

        # Extract submission ID if available
        SUBMISSION_ID=$(echo "$NOTARIZE_OUTPUT" | grep -o "id: [a-f0-9-]*" | head -1 | cut -d' ' -f2)

        if [ -n "$SUBMISSION_ID" ]; then
            echo ""
            echo "To check status manually, run:"
            echo -e "${YELLOW}xcrun notarytool info '$SUBMISSION_ID' --keychain-profile \"pnut-ts-notary\"${NC}"
            echo -e "${YELLOW}xcrun notarytool log '$SUBMISSION_ID' --keychain-profile \"pnut-ts-notary\"${NC}"
        fi

        return 1
    fi
}

# Track success
SUCCESS_COUNT=0
FAILED_COUNT=0

# Notarize x64 DMG if present
if [ -n "$X64_DMG" ]; then
    if notarize_dmg "$X64_DMG" "x64"; then
        ((SUCCESS_COUNT++))
    else
        ((FAILED_COUNT++))
        echo ""
        echo "Continue with arm64? (y/n)"
        read -n 1 -s CONTINUE
        echo ""
        if [ "$CONTINUE" != "y" ]; then
            echo "Stopping..."
            exit 1
        fi
    fi
fi

# Notarize arm64 DMG if present
if [ -n "$ARM64_DMG" ]; then
    if notarize_dmg "$ARM64_DMG" "arm64"; then
        ((SUCCESS_COUNT++))
    else
        ((FAILED_COUNT++))
    fi
fi

echo ""
echo "=========================================="
echo "📊 NOTARIZATION SUMMARY"
echo "=========================================="
echo ""

if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ All DMGs successfully notarized and stapled!${NC}"
    echo ""
    echo "📦 Ready for distribution:"
    [ -n "$X64_DMG" ] && echo "   - $X64_DMG (notarized & stapled)"
    [ -n "$ARM64_DMG" ] && echo "   - $ARM64_DMG (notarized & stapled)"
    echo ""
    echo "🎯 These DMGs will now install without Gatekeeper warnings!"
else
    echo -e "${YELLOW}⚠️  Some notarizations failed${NC}"
    echo "   Successful: $SUCCESS_COUNT"
    echo "   Failed: $FAILED_COUNT"
    echo ""
    echo "Please check the logs and fix any issues before distribution"
fi

echo ""
echo "💡 Manual commands reference:"
echo "=========================================="
echo ""
echo "# To notarize manually:"
echo -e "${BLUE}xcrun notarytool submit <dmg-file> --keychain-profile \"pnut-ts-notary\" --wait${NC}"
echo ""
echo "# To check status of submission:"
echo -e "${BLUE}xcrun notarytool info '<submission-id>' --keychain-profile \"pnut-ts-notary\"${NC}"
echo ""
echo "# To get detailed log:"
echo -e "${BLUE}xcrun notarytool log '<submission-id>' --keychain-profile \"pnut-ts-notary\"${NC}"
echo ""
echo "# To staple after successful notarization:"
echo -e "${BLUE}xcrun stapler staple <dmg-file>${NC}"
echo ""
echo "# To validate:"
echo -e "${BLUE}xcrun stapler validate <dmg-file>${NC}"
echo ""

echo "Press any key to exit..."
read -n 1 -s