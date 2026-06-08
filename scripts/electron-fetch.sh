#!/usr/bin/env bash
# Shared helper: robustly download and verify an Electron release .zip.
#
# Electron release downloads (from GitHub's CDN) are an occasional point of
# flakiness in CI — transient 5xx / Gateway Timeouts, and short error-page
# payloads that masquerade as a successful download. A plain `curl -o … && unzip`
# turns those hiccups into a hard build failure (e.g. a 92-byte error body fed to
# unzip → "End-of-central-directory signature not found").
#
# download_and_verify_electron <url> <dest_zip>
#   - retries the download with backoff (and lets curl retry transient errors)
#   - fails on HTTP >= 400 instead of saving the error body (curl --fail)
#   - verifies the result is a complete, valid zip before returning
#   - returns 0 with a verified zip at <dest_zip>, non-zero otherwise
download_and_verify_electron() {
  local url="$1"
  local dest="$2"
  local max_attempts="${ELECTRON_FETCH_ATTEMPTS:-4}"
  local attempt=1

  if ! command -v curl > /dev/null 2>&1; then
    echo "   ❌ curl not found (required to download Electron)"
    return 1
  fi
  if ! command -v unzip > /dev/null 2>&1; then
    echo "   ❌ unzip not found (required to verify Electron archive)"
    return 1
  fi

  while [ "$attempt" -le "$max_attempts" ]; do
    echo "   📥 Electron download attempt ${attempt}/${max_attempts}: ${url}"
    # --fail            : treat HTTP >= 400 as an error (don't save error pages)
    # --retry/-all-errors: ride out transient 5xx / timeouts inside curl too
    # --connect-timeout : don't hang forever on a dead connection
    if curl -L --fail --retry 5 --retry-delay 5 --retry-all-errors \
            --connect-timeout 30 -o "$dest" "$url"; then
      # Integrity check — catches truncated downloads and non-zip error bodies
      # that slipped through with a 2xx status.
      if unzip -tqq "$dest" > /dev/null 2>&1; then
        local bytes
        bytes=$(wc -c < "$dest" | tr -d ' ')
        echo "   ✅ Verified Electron archive (${bytes} bytes)"
        return 0
      fi
      echo "   ⚠️  Downloaded file failed zip integrity check — will retry"
    else
      echo "   ⚠️  curl download failed (exit $?) — will retry"
    fi

    rm -f "$dest"
    attempt=$((attempt + 1))
    [ "$attempt" -le "$max_attempts" ] && sleep 5
  done

  echo "   ❌ Could not obtain a valid Electron archive after ${max_attempts} attempts:"
  echo "      ${url}"
  return 1
}
