# doc_prose.awk — the ONE definition of "what a document asserts".
#
# Shared by both halves of the documentation-drift instrument
# (check_doc_counts.sh and check_doc_claims.sh) so they read a document the
# same way. They did not, and the split showed: the COUNT half grepped raw
# file text, so it read `12 window types` inside DOCs/PUNCH_LIST.md -- a
# backticked quotation of a claim that same sentence goes on to CORRECT --
# as a live assertion, and reported the document that fixed the error as the
# document containing it. The ORPHAN half had learned about fenced blocks and
# backtick spans months earlier. One instrument, two reading rules, and only
# one of them right.
#
# Emits:  LINENO <TAB> TEXT   for each line carrying prose.
#
# Options
#   -v keep_code=1    keep inline code spans intact. The ORPHAN half MINES
#                     those spans (a UI string is quoted, not narrated), so it
#                     needs them; the COUNT half must not see them, because a
#                     backticked number is a quotation and quoting a number is
#                     not asserting it.
#   -v skip_tables=1  drop markdown table rows. A naive backtick span across
#                     two cells manufactures a pipe present in no string.
#   -v claim_re=RE    emit LINENO<TAB>MATCH for every match of RE in the prose,
#                     instead of the whole line -- grep -o semantics, done here
#                     so a caller never has to spawn a process per line. The
#                     first version did, and a full audit of 47 documents took
#                     over two minutes; a gate that slow gets moved out of the
#                     pre-tag path, which is the same as deleting it.
#
# Fenced blocks are ALWAYS dropped. They are diagrams, transcripts and Pascal
# excerpts -- illustrations, never assertions about current behavior.

/^[[:space:]]*```/ { fence = !fence; next }
fence             { next }

skip_tables && /^[[:space:]]*\|/ { next }

{
  line = $0

  if (!keep_code) {
    # Splitting on the backtick makes the EVEN fields the span interiors.
    # Blank those; keep the odd (prose) fields. An unbalanced trailing
    # backtick opens no span, so when the field count is even the final
    # field is unterminated and stays prose rather than being eaten.
    n = split(line, seg, "`")
    out = ""
    for (i = 1; i <= n; i++) {
      if (i % 2 == 1)            out = out seg[i]
      else if (i == n)           out = out "`" seg[i]
      else                       out = out " "
    }
    line = out
  }

  if (line !~ /[^[:space:]]/) next

  if (claim_re == "") { print NR "\t" line; next }

  # grep -o, in-process: walk every match on the line.
  rest = line
  while (match(rest, claim_re)) {
    print NR "\t" substr(rest, RSTART, RLENGTH)
    rest = substr(rest, RSTART + RLENGTH)
    if (RLENGTH == 0) break
  }
}
