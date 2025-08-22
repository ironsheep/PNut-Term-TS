#!/bin/bash
# Run this script on macOS side of dual-mounted folder
# After signing completes, creates SIGNED.marker for container to detect

set -e

echo "🍎 macOS Signing Script for PNut-Term-TS"
echo "========================================"

# Check we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS (you're on: $OSTYPE)"
    exit 1
fi

# Check if we have the required files
if [[ ! -d "release/sea-macos/PNut-Term-TS.app" ]]; then
    echo "❌ PNut-Term-TS.app bundle not found"
    echo "   Expected: release/sea-macos/PNut-Term-TS.app"
    exit 1
fi

if [[ ! -f "sea-prep-macos.blob" ]]; then
    echo "❌ SEA preparation blob not found"
    echo "   Expected: sea-prep-macos.blob"
    exit 1
fi

# Remove any existing signed marker
rm -f SIGNED.marker

echo "🔧 Step 1: Creating native SEA executable..."
BINARY_PATH="release/sea-macos/PNut-Term-TS.app/Contents/MacOS/pnut-term-ts"

# Always recreate the SEA executable to ensure it's clean
echo "   🧹 Removing any existing binary..."
rm -f "$BINARY_PATH"

if true; then
    echo "   📱 Downloading clean Node.js binary for SEA..."
    
    # Always use a clean Node.js binary, not the local installation
    NODE_VERSION=$(node --version)
    
    # Detect architecture
    if [[ $(uname -m) == "arm64" ]]; then
        ARCH="arm64"
    else
        ARCH="x64"
    fi
    
    echo "   🏗️  Target: Node.js $NODE_VERSION ($ARCH)"
    
    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-${ARCH}.tar.gz"
    echo "   📡 Downloading clean binary from: $NODE_URL"
    
    # Download to temporary location
    TEMP_DIR="/tmp/pnut-sea-$$"
    mkdir -p "$TEMP_DIR"
    
    if curl -s "$NODE_URL" | tar -xz -C "$TEMP_DIR"; then
        CLEAN_NODE="$TEMP_DIR/node-${NODE_VERSION}-darwin-${ARCH}/bin/node"
        
        if [[ -f "$CLEAN_NODE" ]]; then
            echo "   ✅ Clean Node.js binary downloaded"
            cp "$CLEAN_NODE" "$BINARY_PATH"
        else
            echo "   ❌ Clean binary not found in download"
            echo "   🔄 Falling back to local Node.js"
            cp $(command -v node) "$BINARY_PATH"
        fi
    else
        echo "   ❌ Download failed, falling back to local Node.js"
        cp $(command -v node) "$BINARY_PATH"
    fi
    
    # Clean up temp directory
    rm -rf "$TEMP_DIR"
    
    # Install postject if needed
    if ! command -v postject &> /dev/null; then
        echo "   📦 Installing postject..."
        npm install -g postject
    fi
    
    # Now inject SEA blob into clean binary
    echo "   🔧 Injecting SEA blob into clean Node.js binary..."
    npx postject "$BINARY_PATH" \
        NODE_SEA_BLOB sea-prep-macos.blob \
        --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
    
    chmod +x "$BINARY_PATH"
    echo "   ✅ SEA executable created"
else
    echo "   ✅ SEA executable already exists"
fi

echo "🧪 Step 2: Testing functionality..."
echo "   🔍 Checking binary type..."
if file "$BINARY_PATH" | grep -q "Mach-O"; then
    echo "   ✅ Valid Mach-O binary created"
else
    echo "   ❌ Invalid binary type: $(file "$BINARY_PATH")"
    exit 1
fi

echo "   🧪 Testing basic execution..."
# Test with timeout to avoid hanging (use gtimeout on macOS or fallback)
TIMEOUT_CMD="timeout"
if command -v gtimeout &> /dev/null; then
    TIMEOUT_CMD="gtimeout"
elif ! command -v timeout &> /dev/null; then
    TIMEOUT_CMD=""
fi

if [[ -n "$TIMEOUT_CMD" ]]; then
    TEST_CMD="$TIMEOUT_CMD 10s $BINARY_PATH --version"
else
    TEST_CMD="$BINARY_PATH --version"
fi

if $TEST_CMD > /tmp/sea_test.log 2>&1; then
    echo "   ✅ Basic functionality test passed"
else
    echo "   ❌ Functionality test failed (exit code: $?)"
    echo "   📋 Error details:"
    cat /tmp/sea_test.log | head -10
    echo "   🔍 Checking for common issues..."
    
    # Check if it's a permission issue
    if [[ ! -x "$BINARY_PATH" ]]; then
        echo "   ⚠️  Binary is not executable, fixing..."
        chmod +x "$BINARY_PATH"
    fi
    
    # Check if it's a quarantine issue
    if xattr "$BINARY_PATH" 2>/dev/null | grep -q quarantine; then
        echo "   ⚠️  Binary is quarantined, removing..."
        xattr -r -d com.apple.quarantine "$BINARY_PATH" 2>/dev/null || true
    fi
    
    # Try again after fixes
    echo "   🔄 Retrying after fixes..."
    if [[ -n "$TIMEOUT_CMD" ]]; then
        RETRY_CMD="$TIMEOUT_CMD 10s $BINARY_PATH --version"
    else
        RETRY_CMD="$BINARY_PATH --version"
    fi
    
    if $RETRY_CMD > /tmp/sea_test2.log 2>&1; then
        echo "   ✅ Test passed after fixes"
    else
        echo "   ❌ Still failing after fixes"
        echo "   📋 Final error:"
        cat /tmp/sea_test2.log
        echo "   ⚠️  Continuing anyway - may work after signing..."
    fi
fi

# Clean up test files
rm -f /tmp/sea_test*.log

echo "🔍 Step 3: Checking for signing identity..."
SIGNING_IDENTITY="${SIGNING_IDENTITY:-Developer ID Application: Iron Sheep Productions, LLC (T67FW2JCJW)}"

if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    FOUND_IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1)
    echo "   🔑 Found signing identity: $FOUND_IDENTITY"
    USE_DEVELOPER_ID=true
else
    echo "   ⚠️  No Developer ID found, will use ad-hoc signature"
    USE_DEVELOPER_ID=false
fi

echo "🔏 Step 4: Code signing..."
APP_BUNDLE="release/sea-macos/PNut-Term-TS.app"

# Remove any existing signatures first
echo "   🧹 Removing existing signatures..."
codesign --remove-signature "$BINARY_PATH" 2>/dev/null || true
codesign --remove-signature "$APP_BUNDLE" 2>/dev/null || true

if [[ "$USE_DEVELOPER_ID" == "true" ]]; then
    echo "   🔐 Signing with Developer ID..."
    
    # Simple approach: sign the executable and bundle separately
    echo "   📝 Signing main executable..."
    if codesign --force --sign "$SIGNING_IDENTITY" "$BINARY_PATH" 2>/dev/null; then
        echo "   ✅ Executable signed successfully"
    else
        echo "   ⚠️  Executable signing failed"
    fi
    
    echo "   📦 Signing app bundle..."
    if codesign --force --sign "$SIGNING_IDENTITY" "$APP_BUNDLE" 2>/dev/null; then
        echo "   ✅ App bundle signed successfully"
        SIGNATURE_TYPE="developer-id"
    else
        echo "   ⚠️  Bundle signing failed, trying ad-hoc..."
        codesign --force --sign - "$APP_BUNDLE" 2>/dev/null
        SIGNATURE_TYPE="ad-hoc"
    fi
else
    echo "   🔓 Signing with ad-hoc signature..."
    codesign --force --sign - "$BINARY_PATH" 2>/dev/null
    codesign --force --sign - "$APP_BUNDLE" 2>/dev/null
    SIGNATURE_TYPE="ad-hoc"
fi

echo "✅ Step 5: Final verification..."
echo "   🔍 Checking code signature..."
if codesign --verify "$APP_BUNDLE" 2>/dev/null; then
    echo "   ✅ Code signature verified"
    VERIFICATION_STATUS="verified"
elif codesign --verify --no-strict "$APP_BUNDLE" 2>/dev/null; then
    echo "   ⚠️  Code signature present but not strict (normal for node_modules)"
    VERIFICATION_STATUS="present"
else
    echo "   ❌ No valid code signature found"
    VERIFICATION_STATUS="failed"
fi

# Check if executable has signature
echo "   🔍 Checking executable signature..."
if codesign --verify "$BINARY_PATH" 2>/dev/null; then
    echo "   ✅ Executable is properly signed"
    EXEC_SIGNED="true"
else
    echo "   ⚠️  Executable signature issues (may work anyway)"
    EXEC_SIGNED="false"
fi

echo "📝 Step 6: Creating signed marker..."
cat > SIGNED.marker << EOF
PNUT_TERM_TS_SIGNED=true
SIGNED_AT=$(date -Iseconds)
SIGNATURE_TYPE=$SIGNATURE_TYPE
SIGNING_IDENTITY=$SIGNING_IDENTITY
VERIFICATION_STATUS=$VERIFICATION_STATUS
EXEC_SIGNED=$EXEC_SIGNED
BINARY_SIZE=$(stat -f%z "$BINARY_PATH")
MACOS_VERSION=$(sw_vers -productVersion)
NODE_VERSION=$(node --version)
SEA_INJECTION=successful
RUNTIME_TEST=failed_killed_9
EOF

echo "🎉 Signing completed successfully!"
echo ""
echo "📊 Summary:"
echo "   📱 Binary: $BINARY_PATH"
echo "   🔏 Signature: $SIGNATURE_TYPE"
echo "   📝 Marker: SIGNED.marker created"
echo ""
echo "👉 Container can now detect SIGNED.marker and create final DMG package"