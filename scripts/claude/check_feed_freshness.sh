#!/usr/bin/env bash
# check_feed_freshness.sh — documentation-drift instrument, FEED half.
#
# ADVISORY ONLY. Always exits 0.
#
# WHY THIS EXISTS
# ---------------
# DOCs/handoffs-to-DOCs-AGENT/ holds point-in-time SNAPSHOTS of documents whose
# maintained copies live elsewhere in the repo. Both other halves of this
# instrument deliberately EXCLUDE that directory, and the release gate excludes
# it too, for a defensible reason: a snapshot is allowed to carry the version it
# was taken at.
#
# The consequence is the hole this fills. "Correctly frozen at v1.0.0" and
# "silently rotted for seven releases" are the same string in the same place,
# so no instrument could tell them apart -- and in September 2026 two feeds had
# been stale since the 1.0.0 release, through six subsequent ones, teaching a
# --debugbaud flag that no longer existed. Nothing reported it. A person had to
# think to look.
#
# WHAT IT CHECKS
#   STALE     — the feed's content differs from the canonical document it names.
#               Either canonical moved and the feed was not re-snapshotted, or
#               somebody edited the feed in place. The README forbids the second
#               ("edit the canonical copy, then re-snapshot; never edit both")
#               and until now nothing enforced it.
#   UNDECLARED— a feed that names no source at all. It cannot be checked, and a
#               snapshot nobody can check is the state this exists to end.
#
# The source is declared BY THE FEED, in its own banner, not by a table in this
# script. A new feed is covered the day it is written, and a feed cannot drift
# from a mapping it carries itself.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 0

FEED_DIR="DOCs/handoffs-to-DOCs-AGENT"
echo "== FEED FRESHNESS — each handoff snapshot vs the document it snapshots =="
echo

if [ ! -d "$FEED_DIR" ]; then
  echo "  $FEED_DIR not present — nothing to audit"
  echo
  echo "(advisory — exit 0 regardless of findings)"
  exit 0
fi

python3 - "$FEED_DIR" <<'PY'
import os, re, subprocess, sys

feed_dir = sys.argv[1]
CANON = re.compile(r'canonical document is\s*\*\*`([^`]+)`\*\*', re.I)
DERIVED = re.compile(r'DERIVED FROM CODE', re.I)

def strip_banner(text):
    """Remove the handoff banner: the first blockquote block naming the snapshot.
    Everything else must match canonical byte for byte."""
    lines = text.split('\n')
    out, i, dropped = [], 0, False
    while i < len(lines):
        if (not dropped and lines[i].startswith('>')
                and any('HANDOFF SNAPSHOT' in l for l in lines[i:i+3])):
            while i < len(lines) and lines[i].startswith('>'):
                i += 1
            if i < len(lines) and lines[i].strip() == '':
                i += 1
            dropped = True
            continue
        out.append(lines[i]); i += 1
    return '\n'.join(out)

feeds = sorted(f for f in os.listdir(feed_dir)
               if f.endswith('.md') and f != 'README.md')
stale = undeclared = derived = ok = 0

for name in feeds:
    path = os.path.join(feed_dir, name)
    text = open(path, encoding='utf-8', errors='replace').read()

    # Only inside the banner region: prose elsewhere saying a section was
    # "re-derived from" some file must not reclassify a real snapshot.
    if DERIVED.search(text[:1200]):
        derived += 1
        print(f"  DERIVED     {name}")
        print(f"              re-derived from code, not a copy of a document — no diff possible")
        continue

    m = CANON.search(text)
    if not m:
        undeclared += 1
        print(f"  UNDECLARED  {name}")
        print(f"              names no canonical source — add a snapshot banner, or mark it")
        print(f"              DERIVED FROM CODE if it is not a copy of a document")
        continue

    src = m.group(1)
    if not os.path.exists(src):
        undeclared += 1
        print(f"  UNDECLARED  {name}")
        print(f"              names '{src}', which does not exist")
        continue

    canon = open(src, encoding='utf-8', errors='replace').read()
    if strip_banner(text) == canon:
        ok += 1
        continue

    stale += 1
    def last(p):
        r = subprocess.run(['git', 'log', '-1', '--format=%h %ad', '--date=short', '--', p],
                           capture_output=True, text=True)
        return r.stdout.strip() or '(untracked)'
    print(f"  STALE       {name}")
    print(f"              differs from {src}")
    print(f"              feed      last touched {last(path)}")
    print(f"              canonical last touched {last(src)}")
    print(f"              → re-snapshot from canonical; never edit the feed in place")

print()
print(f"  {len(feeds)} feed(s): {ok} current, {stale} stale, "
      f"{undeclared} undeclared, {derived} derived-from-code")
if len(feeds) == 0:
    print("  no feeds found — the pattern broke, or the directory is empty.")
    print("  'found none' must never be indistinguishable from 'could not look'.")
PY

echo
echo "(advisory — exit 0 regardless of findings)"
exit 0
