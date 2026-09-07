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
      # 1. Bracketed log/diagnostic prefixes, anywhere on the line.
      s = $0
      while (match(s, /\[[A-Z][A-Z0-9 ]{2,}\]/)) {
        print NR "\t" substr(s, RSTART, RLENGTH)
        s = substr(s, RSTART + RLENGTH)
      }
      # 2. Pipe-separated UI strings, taken ONLY from genuine inline-code spans.
      #    Splitting on the backtick makes the EVEN fields the spans. The old
      #    combined regex could begin matching at a CLOSING backtick and run
      #    through prose into the next span, manufacturing a pipe present in no
      #    string — which is what produced eleven of the fifteen standing
      #    false positives (FFT/PLOT prose, `(byte_count << 20)`, `echo $PATH`).
      #    An unbalanced trailing backtick opens no span, hence k < n.
      n = split($0, seg, "`")
      for (k = 2; k < n; k += 2)
        if (index(seg[k], " | ") > 0) print NR "\t`" seg[k] "`"
    }' "$doc" 2>/dev/null \
  | while IFS=$'\t' read -r line claim; do
      needle=$(printf '%s' "$claim" | sed -E 's/^`//; s/`$//')
      # Match on the most distinctive fragment: the text before the first pipe
      # for UI strings, the whole bracketed token otherwise.
      frag=$(printf '%s' "$needle" | cut -d'|' -f1 | sed -E 's/[[:space:]]+$//')
      [ ${#frag} -lt 6 ] && continue
      # A Pascal constant expression quoted in the parity-reference tree is not
      # one of our UI strings — `TA_LEFT | TA_TOP` is Delphi's, and those docs
      # quote it precisely BECAUSE it is Pascal. Deliberately narrow: a BARE
      # identifier only. Anything containing a space is still a real candidate
      # and is still reported, so this cannot hide a genuine orphan.
      case "$doc" in
        DOCs/pascal-REF/*)
          printf '%s' "$frag" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*$' && continue ;;
      esac
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

# Two populations, and only ONE of them can actually drift.
#
#   OURS      — prose, ASCII layout diagrams, sample output. Two copies are two
#               things somebody maintains, so they diverge; this is the finding
#               the DUPLICATE half exists to report.
#   CITED     — a ```pascal excerpt of /pascal-source/P2_PNut_Public/, which is
#               the v55 PARITY BASELINE: version-pinned, bind-mounted read-only,
#               and by definition frozen. A verbatim quote of an unchanging file
#               cannot drift from its source, and two verbatim quotes of the same
#               frozen lines cannot drift from each other. These documents quote
#               the same procedure beside two different arguments ON PURPOSE —
#               the reader verifying a claim about the code needs it inline, and
#               a cross-reference makes the argument harder to check, not easier.
#               Reported separately, and quietly, so it does not bury the
#               population that needs a decision.
ours   = collections.defaultdict(list)
cited  = collections.defaultdict(list)
for path in sys.argv[1:]:
    try:
        lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
    except OSError:
        continue
    inside, buf, start, lang = False, [], 0, ''
    for i, ln in enumerate(lines, 1):
        if ln.lstrip().startswith('```'):
            if inside:
                body = '\n'.join(s.rstrip() for s in buf).strip()
                # Ignore trivial blocks: a one-line command is not a transcript.
                if len(body.split('\n')) >= 3 and len(body) >= 60:
                    bucket = cited if lang == 'pascal' else ours
                    bucket[hashlib.sha1(body.encode()).hexdigest()].append((path, start, body))
                inside, buf = False, []
            else:
                inside, start = True, i
                lang = ln.lstrip()[3:].strip().lower()
        elif inside:
            buf.append(ln)

def report(blocks):
    n = 0
    for h, hits in blocks.items():
        if len({p for p, _, _ in hits}) > 1:
            n += 1
            first = hits[0][2].split('\n')[0][:70]
            print(f"  block starting '{first}'")
            for p, ln, _ in hits:
                print(f"    {p}:{ln}")
    return n

n_ours = report(ours)
if n_ours == 0:
    print("  (none)")
n_cited = sum(1 for h, hits in cited.items() if len({p for p, _, _ in hits}) > 1)
print()
print(f"  [{n_cited} further duplicate(s) are ```pascal excerpts of the FROZEN v55")
print("   baseline, quoted beside separate arguments. A verbatim quote of an")
print("   unchanging source cannot drift — not a finding. Run with SHOW_CITED=1")
print("   to list them.]")
import os
if os.environ.get('SHOW_CITED'):
    print()
    report(cited)
PY
echo
echo "-- identical UI/log claim lines appearing in 2+ documents --"
python3 - "${DOCS[@]}" <<'PY'
import sys, re, collections
# A claim is an inline-code span carrying a pipe-separated UI string. Two guards,
# both learned from this section's own output:
#   * BOTH sides of the pipe must carry real content. Without this the markdown
#     table alignment padding in the directive matrix ('`  |  `') registers as a
#     claim, which is how this section came to emit whitespace as a finding.
#   * The finding is the same claim in 2+ DISTINCT documents. The old comparison
#     walked adjacent sorted lines without checking the path, so one document
#     containing a claim three times reported itself three times as a duplicate.
SPAN = re.compile(r'`([^`\n]+)`')   # single line: a span never crosses a newline
claims = collections.defaultdict(set)
for path in sys.argv[1:]:
    try:
        text = open(path, encoding='utf-8', errors='replace').read()
    except OSError:
        continue
    for span in SPAN.findall(text):
        if ' | ' not in span:
            continue
        left, _, right = span.partition(' | ')
        if len(left.strip()) < 3 or len(right.strip()) < 3:
            continue
        # A span whose every part is a bare identifier is a constant EXPRESSION,
        # not one of our UI strings — `TA_LEFT | TA_TOP` is Delphi's, and the
        # pipe is its OR operator. Same narrow rule the ORPHAN half applies, for
        # the same reason: a quote of the frozen baseline cannot drift, so
        # consolidating its four copies would buy nothing.
        if all(re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', part.strip())
               for part in span.split('|')):
            continue
        claims[span.strip()].add(path)
found = 0
for claim, paths in sorted(claims.items()):
    if len(paths) > 1:
        found += 1
        print(f"  `{claim}`")
        for p in sorted(paths):
            print(f"    {p}")
if not found:
    print("  (none)")
PY
echo
echo "(advisory — exit 0 regardless of findings)"
exit 0
