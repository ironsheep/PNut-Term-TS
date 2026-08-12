#!/usr/bin/env bash
# check_doc_claims.sh — documentation-drift instrument, ORPHAN + DUPLICATE halves.
#
# ADVISORY ONLY. It always exits 0. A doc checker wired as a hard CI gate gets
# disabled the first time it blocks an urgent fix, and then detects nothing
# forever after.
#
# What it detects
#   ORPHAN    — a user-visible string quoted in a document that appears in NO
#               source string literal. The docs claim output the code no longer
#               produces.
#   DUPLICATE — the same quoted material maintained in more than one document.
#               This is not a drift finding, it is the drift MECHANISM: two
#               copies will diverge, the only question is when. The fix is always
#               ONE canonical copy with links from the others — never "edit both
#               and keep them aligned", which is the arrangement that produced
#               the finding.
#
# Where this project's user-visible strings come from (the one project-shaped
# question): TypeScript string literals under src/. There is no string table and
# no localization catalog. The two families worth matching on are
#   * bracketed log/diagnostic prefixes   [DTR RESET], [WINDOW PLACER], …
#   * pipe-separated UI strings           'Hub Data | Mousewheel changes …'
# both of which are distinctive enough that a substring match is meaningful and
# short enough to survive value interpolation.
#
# The document set is discovered MECHANICALLY from version control — every
# tracked .md minus the named working areas — so scope is never a judgement call
# that can be shaded under deadline.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 0

EXCLUDE_RE='^(DOCs/plans/|DOCs/investigations/|DOCs/pure-process/|DOCs/project-specific/|DOCs/handoffs-to-|DOCs/history/|tasks/|node_modules/)'

mapfile -t DOCS < <(git ls-files '*.md' | grep -Ev "$EXCLUDE_RE")
if [ ${#DOCS[@]} -eq 0 ]; then
  echo "no tracked documents found — nothing to audit"; exit 0
fi

SRC_STRINGS=$(mktemp)
trap 'rm -f "$SRC_STRINGS"' EXIT
# Every quoted literal in the shipped sources, one per line, quotes stripped.
grep -rhoE "'[^']{4,}'|\"[^\"]{4,}\"|\`[^\`]{4,}\`" src/ --include='*.ts' 2>/dev/null \
  | sed -E "s/^.//; s/.$//" > "$SRC_STRINGS"

echo "== documents audited: ${#DOCS[@]} =="
echo

# ---------------------------------------------------------------------------
# ORPHAN
# ---------------------------------------------------------------------------
echo "== ORPHAN — quoted in the docs, absent from every source literal =="
orphans=0
for doc in "${DOCS[@]}"; do
  # Candidate claims, taken from PROSE only:
  #   * bracketed log prefixes — letters/digits/spaces only, so the ASCII-art
  #     panel labels ([CT-------], [HUB MAP]) of layout diagrams do not qualify;
  #   * inline code spans carrying a pipe-separated UI string.
  # Fenced blocks are skipped (they are diagrams and Pascal excerpts, not claims
  # about our output) and so are markdown table rows, where a naive backtick span
  # spans two cells and manufactures a pipe that is not in any string.
  awk '
    /^[[:space:]]*```/ { fence = !fence; next }
    fence { next }
    /^[[:space:]]*\|/ { next }
    {
      s = $0
      while (match(s, /\[[A-Z][A-Z0-9 ]{2,}\]|`[^`]* \| [^`]*`/)) {
        print NR "\t" substr(s, RSTART, RLENGTH)
        s = substr(s, RSTART + RLENGTH)
      }
    }' "$doc" 2>/dev/null \
  | while IFS=$'\t' read -r line claim; do
      needle=$(printf '%s' "$claim" | sed -E 's/^`//; s/`$//')
      # Match on the most distinctive fragment: the text before the first pipe
      # for UI strings, the whole bracketed token otherwise.
      frag=$(printf '%s' "$needle" | cut -d'|' -f1 | sed -E 's/[[:space:]]+$//')
      [ ${#frag} -lt 6 ] && continue
      if ! grep -qF -- "$frag" "$SRC_STRINGS"; then
        echo "  $doc:$line  no source literal contains: $frag"
      fi
    done
done | sort -u | tee /tmp/.doc_orphans.$$
orphans=$(wc -l < /tmp/.doc_orphans.$$); rm -f /tmp/.doc_orphans.$$
echo "  ($orphans candidate orphan(s) — each needs a human read; interpolated"
echo "   values and deliberately historical transcripts are expected hits)"
echo

# ---------------------------------------------------------------------------
# DUPLICATE
# ---------------------------------------------------------------------------
echo "== DUPLICATE — the same material maintained in more than one document =="
echo "-- fenced blocks appearing verbatim in 2+ documents --"
python3 - "${DOCS[@]}" <<'PY'
import hashlib, sys, collections
blocks = collections.defaultdict(list)
for path in sys.argv[1:]:
    try:
        lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
    except OSError:
        continue
    inside, buf, start = False, [], 0
    for i, ln in enumerate(lines, 1):
        if ln.lstrip().startswith('```'):
            if inside:
                body = '\n'.join(s.rstrip() for s in buf).strip()
                # Ignore trivial blocks: a one-line command is not a transcript.
                if len(body.split('\n')) >= 3 and len(body) >= 60:
                    blocks[hashlib.sha1(body.encode()).hexdigest()].append((path, start, body))
                inside, buf = False, []
            else:
                inside, start = True, i
        elif inside:
            buf.append(ln)
for h, hits in blocks.items():
    if len({p for p, _, _ in hits}) > 1:
        first = hits[0][2].split('\n')[0][:70]
        print(f"  block starting '{first}'")
        for p, ln, _ in hits:
            print(f"    {p}:{ln}")
PY
echo
echo "-- identical UI/log claim lines appearing in 2+ documents --"
for doc in "${DOCS[@]}"; do
  grep -hoE '`[^`]*\|[^`]*`' "$doc" 2>/dev/null | sed "s|^|$doc\t|"
done | sort -t$'\t' -k2 | awk -F'\t' '
  { if ($2 == prev) { if (!printed) { print "  " prev; print "    " prevdoc; printed=1 } print "    " $1 }
    else { printed=0 }
    prev=$2; prevdoc=$1 }'
echo
echo "(advisory — exit 0 regardless of findings)"
exit 0
