#!/bin/bash
# Release consistency gate — every number and every shipped surface agrees before we tag.
#
# WHY THIS EXISTS
# ---------------
# v1.0.3 shipped with F1 Help that contradicted the app: the code was renamed and the
# packaged APP-HELP.md still described the old names, because the doc pass happened after
# the tag. In the same release USER-GUIDE.md and QUICK-START.md were found still stamped
# "Version 1.0.0" — three releases stale. Neither failure announced itself; a release with
# wrong content succeeds exactly as loudly as a correct one.
#
# So the rule this enforces: a version number asserted anywhere that ships must agree with
# package.json, and the changelog the release workflow will parse must actually parse.
#
# TWO STRENGTHS, ON PURPOSE
#   HARD (exit 1)  — mechanical facts with one right answer: version stamps, changelog
#                    heading, the workflow's own parse. No judgement, so no reason to waive.
#   ADVISORY       — content drift from the doc instrument. Reported, never fatal: a doc
#                    checker wired as a hard gate gets disabled the first time it blocks an
#                    urgent fix, and then detects nothing forever.
#
# The file list is DISCOVERED, never hardcoded — any tracked doc that carries a version
# stamp is checked, so a new shipped doc is covered the day it is written.
#
# Usage:  scripts/check-release-consistency.sh [expected-tag]
#   e.g.  scripts/check-release-consistency.sh v1.0.4
# Run it BEFORE tagging. The release workflow runs it too, so a mismatch fails the release
# loudly instead of shipping.

set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

fail=0
# Every git call goes through this. Two reasons: a container-mounted checkout trips
# "dubious ownership" and would otherwise make every git query fail SILENTLY (the first
# version of this script read that failure as "no docs found" and as "APP-HELP.md is
# uncommitted" — the exact class of misread it is meant to catch), and it keeps CI and
# local behavior identical.
GIT=(git -c "safe.directory=${REPO_ROOT}")
if ! "${GIT[@]}" rev-parse --git-dir >/dev/null 2>&1; then
  echo "❌ cannot query git in ${REPO_ROOT} — this gate needs it to discover shipped files."
  exit 2
fi

note() { printf '  %s\n' "$1"; }
bad()  { printf '❌ %s\n' "$1"; fail=1; }
ok()   { printf '✅ %s\n' "$1"; }

echo "=== Release consistency gate ==="
echo

# ---------------------------------------------------------------- package.json is truth
VERSION="$(node -p "require('./package.json').version" 2>/dev/null)"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  bad "package.json version is missing or not semver: '${VERSION}'"
  echo; echo "Cannot continue without a version to compare against."; exit 1
fi
ok "package.json version: ${VERSION}"

# ---------------------------------------------------------------- optional tag argument
if [[ $# -ge 1 ]]; then
  want="$1"
  if [[ "$want" != "v${VERSION}" ]]; then
    bad "tag '${want}' does not match package.json (expected 'v${VERSION}')"
  else
    ok "tag matches package.json: ${want}"
  fi
  # "Tag already exists" is a PRE-TAG check only. In CI the tag is what triggered the run,
  # so it always exists there — asserting it would fail every release. Locally it is the
  # useful half of the check: it stops a silent no-op re-tag of a version already shipped.
  if [[ -z "${GITHUB_ACTIONS:-}" ]]; then
    if "${GIT[@]}" rev-parse -q --verify "refs/tags/${want}" >/dev/null 2>&1; then
      bad "tag '${want}' ALREADY EXISTS — pick a new version, or delete the tag deliberately"
    else
      ok "tag '${want}' is free"
    fi
  else
    note "running in CI — skipping the tag-already-exists check (the tag triggered this run)"
  fi
fi

# ---------------------------------------------------------------- changelog top entry
top_heading="$(grep -m1 -E '^## ' CHANGELOG.md || true)"
if [[ -z "$top_heading" ]]; then
  bad "CHANGELOG.md has no '## ' version heading at all"
elif [[ "$top_heading" =~ ^\#\#\ v${VERSION}\ \([0-9]{4}-[0-9]{2}-[0-9]{2}\)$ ]]; then
  ok "CHANGELOG.md top entry: ${top_heading}"
else
  bad "CHANGELOG.md top entry does not match '## v${VERSION} (YYYY-MM-DD)'"
  note "found: ${top_heading}"
fi

# ------------------------------------------- the workflow's OWN parse must produce a body
# Copied verbatim from .github/workflows/release.yml. Both failure modes there are SILENT:
# the release succeeds with an empty or wrong body. Simulating it here is the only way the
# failure is ever seen before it ships.
CHANGELOG_CONTENT=$(awk -v v="${VERSION}" '
  $0 ~ ("^## \\[" v "\\]") || $0 ~ ("^## v" v "( |$|\\()") { flag=1; next }
  /^## / { flag=0 }
  flag' CHANGELOG.md | sed '/^$/N;/^\n$/d')
SUMMARY_LINE=$(echo "${CHANGELOG_CONTENT}" | grep -m1 -v '^\s*$' | grep -v '^###' | sed 's/^- //' | sed 's/\*\*[^*]*\*\*: //')

if [[ -z "${CHANGELOG_CONTENT// }" ]]; then
  bad "the release workflow's awk extracts an EMPTY body for ${VERSION} — the release would ship blank"
else
  ok "workflow changelog parse: $(echo -n "$CHANGELOG_CONTENT" | wc -c | tr -d ' ') chars"
fi
if [[ -z "${SUMMARY_LINE// }" ]]; then
  bad "no theme line — the GitHub release '**This release:**' would fall back to boilerplate"
else
  note "This release: ${SUMMARY_LINE:0:100}"
fi

# ---------------------------------------------------------------- shipped doc version stamps
# DISCOVERED, not hardcoded: any tracked .md whose first 10 lines or last 5 lines carry a
# "Version X.Y.Z" stamp is a shipped surface that asserts a version, and must agree.
#
# Working areas are excluded by the SAME rule the doc-drift instrument uses — plans,
# investigations, handoffs, history, pure-process and project-specific notes are internal
# and legitimately carry the version they were written about. Scope is mechanical rather
# than a judgement call, because a judgement-call scope is what gets shaded under deadline.
echo
echo "-- version stamps in tracked docs --"
stamped=0
while IFS= read -r doc; do
  [[ -f "$doc" ]] || continue
  stamp="$( { head -10 "$doc"; tail -5 "$doc"; } | grep -oE 'Version [0-9]+\.[0-9]+\.[0-9]+' | head -1 )"
  [[ -z "$stamp" ]] && continue
  stamped=$((stamped+1))
  found="${stamp#Version }"
  if [[ "$found" == "$VERSION" ]]; then
    ok "${doc}: ${found}"
  else
    bad "${doc}: stamped ${found}, expected ${VERSION}"
  fi
done < <("${GIT[@]}" ls-files '*.md' \
  | grep -vE '^DOCs/(plans|investigations|pure-process|project-specific|handoffs-to-[A-Za-z-]+|handoffs-from-[A-Za-z-]+|history|pascal-REF|manual-source|spec)/' \
  | grep -vE '^(REF-NO-COMMIT|tasks|sprint-plans)/')
if [[ $stamped -eq 0 ]]; then
  bad "no version-stamped docs discovered — the pattern broke, or git listed nothing"
  note "this is a gate failure, not a pass: 'found none' must never be indistinguishable from 'could not look'"
fi

# ---------------------------------------------------------------- packaged docs are current
# APP-HELP.md is copied into every package and read by F1 at runtime, so it ships whatever
# is committed at TAG time. A doc commit landing after the tag is invisible to the release.
echo
echo "-- packaged docs vs HEAD --"
for doc in $(grep -ohE 'DOCs/[A-Za-z0-9_-]+\.md' scripts/create-*-package.sh 2>/dev/null | sort -u); do
  [[ -f "$doc" ]] || { bad "packaging copies ${doc}, which does not exist"; continue; }
  "${GIT[@]}" diff --quiet HEAD -- "$doc" 2>/dev/null
  case $? in
    0) ok "${doc} is committed (ships as-is)" ;;
    1) bad "${doc} has UNCOMMITTED changes — packaging ships the COMMITTED copy, so they would be lost" ;;
    *) bad "${doc}: git could not compare against HEAD — treating as a failure, not a pass" ;;
  esac
done

# ---------------------------------------------------------------- advisory: content drift
echo
echo "-- content drift (ADVISORY — never fatal) --"
# KNOWN, UNRESOLVED (2026-08-23): during development this block was twice observed
# reporting 0 when the instruments independently reported 15/41/1, and the reading has not
# reproduced in any subsequent run. Suspect the instruments' PID-named temp file
# (/tmp/.doc_orphans.$$ in check_doc_claims.sh, not cleaned up on failure) under PID reuse.
# Because a silent zero is the exact failure this gate exists to prevent, the counts below
# assert the instrument's OUTPUT SHAPE before trusting any number — an empty or
# unrecognized output reports UNCHECKED rather than clean. The counts remain advisory and
# never fail the gate, so a wrong number here cannot block a release; it can only mislead
# a reader, which the UNCHECKED path is there to stop.
#
# These counts are ADVISORY, but they must still be TRUE. An advisory that silently
# reports zero is worse than no advisory: it reads as "clean" forever. The patterns below
# are matched against the instruments' real output shapes, and a zero here is only
# trustworthy because the shapes were verified against a run that had findings.
#   ORPHAN entries look like:     "  path/to/doc.md:180  no source literal contains: X"
#   DUPLICATE entries look like:  "  `<the repeated material>`"
if [[ -r scripts/claude/check_doc_claims.sh ]]; then
  cl="$(bash scripts/claude/check_doc_claims.sh 2>&1)"
  if [[ -z "$cl" ]]; then
    note "doc-claim instrument produced NO OUTPUT — treat as UNCHECKED, not as clean"
  elif ! printf '%s\n' "$cl" | grep -q '^== ORPHAN'; then
    # A zero that comes from an unrecognized format is indistinguishable from a real zero,
    # and reads as "clean" forever. Assert the shape before trusting the count.
    note "doc-claim output did not contain the expected '== ORPHAN' section — UNCHECKED, not clean"
  else
    orphans="$(printf '%s\n' "$cl" | grep -c 'no source literal contains:')"
    dupes="$(printf '%s\n' "$cl" | awk '/^== DUPLICATE/{f=1;next} f' | grep -cE '^  `')"
    note "doc-claim: ${orphans} orphan, ${dupes} duplicate — review, do not auto-fix"
    note "  (Pascal identifiers quoted in the reference docs are expected noise here)"
  fi
else
  note "scripts/claude/check_doc_claims.sh not present — content drift UNCHECKED"
fi
if [[ -r scripts/claude/check_doc_counts.sh ]]; then
  co="$(bash scripts/claude/check_doc_counts.sh 2>&1)"
  if [[ -z "$co" ]]; then
    note "count instrument produced NO OUTPUT — treat as UNCHECKED, not as clean"
  elif ! printf '%s\n' "$co" | grep -q '^== COUNT'; then
    note "count output did not contain the expected '== COUNT' section — UNCHECKED, not clean"
  else
    note "count mismatches: $(printf '%s\n' "$co" | grep -c 'MISMATCH')"
  fi
else
  note "scripts/claude/check_doc_counts.sh not present — counts UNCHECKED"
fi

echo
if [[ $fail -ne 0 ]]; then
  echo "❌ RELEASE GATE FAILED — fix the items above before tagging."
  exit 1
fi
echo "✅ Release gate passed — numbers and shipped content agree for ${VERSION}."
exit 0
