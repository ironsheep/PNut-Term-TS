/** @format */

// displayNameRules.ts
//
// What a user may name a DEBUG display — the Pascal/PNut rule, verbatim.
//
// AUTHORITY: p2com.asm, `parse_debug_string` (line 19502) and the `debug_symbols` table
// (line 19335). NOT DebugDisplayUnit.pas — the display unit consumes an ALREADY-TOKENIZED
// stream (P2.DebugDisplayType/Value), and the tokenizer is the assembly routine reached
// through GlobalUnit.pas's `procedure P2ParseDebugString; external`.
//
// The grammar is stated in the source's own comment above parse_debug_string:
//
//     Instance:  dd_dis
//                dd_unk   (unknown symbol, assigned dd_nam and debug_display_new)
//                dd_key | dd_num | dd_str
//                dd_end
//     Command:   dd_nam
//                dd_key | dd_num | dd_str
//                dd_end
//
// and enforced by four instructions:
//
//     @@newinstance:  call    enter_dd_record
//                     call    get_dd_element      ;check for unique instance name
//                     cmp     al,dd_unk
//                     jne     @@abort
//
// i.e. the name token must resolve to dd_unk — "not a symbol I already know". A display
// type (dd_dis), a directive keyword (dd_key), an open display's name (dd_nam), a number
// (dd_num) or a string (dd_str) all fail. On failure PNut sets debug_display_type[0] = 0,
// which DebugUnit.pas:224/231 matches against neither 1 (create) nor 2 (update), so the
// WHOLE debug display statement is discarded — silently, with no window and no message.
//
// WHY THE RULE EXISTS: the DEBUG wire protocol addresses displays by NAME ONLY. A name
// that is also a keyword is genuinely ambiguous — and it is ambiguous for us too: our
// router's multi-window fan-out consumes consecutive tokens that match a registered
// window name, so a display called `trace` silently eats the TRACE directive out of an
// unrelated window's update (BITMAP and SPECTRO both take TRACE). Same reason, same bug.

/**
 * The 103 words that may not be used as a display name.
 *
 * Transcribed from the `debug_symbols` table (p2com.asm:19335), which
 * `reset_debug_symbols` loads into `ddsymbols_auto` before every parse. This is the
 * DEBUG-DISPLAY symbol table and nothing else: it is NOT the Spin2 language's reserved
 * words, which is why a display may legally be called `spin2` — that word is simply not a
 * display directive.
 */
export const DEBUG_DISPLAY_RESERVED_WORDS: ReadonlySet<string> = new Set([
  // display types (dd_dis)
  'LOGIC', 'SCOPE', 'SCOPE_XY', 'FFT', 'SPECTRO', 'PLOT', 'TERM', 'BITMAP', 'MIDI',
  // color group
  'BLACK', 'WHITE', 'ORANGE', 'BLUE', 'GREEN', 'CYAN', 'RED', 'MAGENTA', 'YELLOW',
  'GRAY', 'GREY', // both spellings are reserved — the table maps them to one key
  // color-mode group
  'LUT1', 'LUT2', 'LUT4', 'LUT8',
  'LUMA8', 'LUMA8W', 'LUMA8X',
  'HSV8', 'HSV8W', 'HSV8X',
  'RGBI8', 'RGBI8W', 'RGBI8X',
  'RGB8',
  'HSV16', 'HSV16W', 'HSV16X',
  'RGB16', 'RGB24',
  // packed-data group
  'LONGS_1BIT', 'LONGS_2BIT', 'LONGS_4BIT', 'LONGS_8BIT', 'LONGS_16BIT',
  'WORDS_1BIT', 'WORDS_2BIT', 'WORDS_4BIT', 'WORDS_8BIT',
  'BYTES_1BIT', 'BYTES_2BIT', 'BYTES_4BIT',
  // keywords
  'ALT', 'AUTO', 'BACKCOLOR', 'BOX', 'CARTESIAN', 'CHANNEL', 'CIRCLE', 'CLEAR', 'CLOSE',
  'COLOR', 'CROP', 'DEPTH', 'DOT', 'DOTSIZE', 'HIDEXY', 'HOLDOFF', 'LAYER', 'LINE',
  'LINESIZE', 'LOGSCALE', 'LUTCOLORS', 'MAG', 'OBOX', 'OPACITY', 'ORIGIN', 'OVAL',
  'PC_KEY', 'PC_MOUSE', 'POLAR', 'POS', 'PRECISE', 'RANGE', 'RATE', 'SAMPLES', 'SAVE',
  'SCROLL', 'SET', 'SIGNED', 'SIZE', 'SPACING', 'SPARSE', 'SPRITE', 'SPRITEDEF', 'TEXT',
  'TEXTANGLE', 'TEXTSIZE', 'TEXTSTYLE', 'TITLE', 'TRACE', 'TRIGGER', 'UPDATE', 'WINDOW'
]);

/**
 * `symbol_size_limit = 30` (p2com.asm:61). check_dd_sym keeps CONSUMING beyond the limit
 * but stops STORING ("if symbol length at limit, ignore extra chrs"), so a longer name is
 * silently truncated — it is not an error in PNut.
 */
export const MAX_DISPLAY_NAME_LENGTH = 30;

export type DisplayNameCheck =
  | { ok: true; name: string; truncated: boolean }
  | { ok: false; reason: string };

/**
 * A legal name starts with a letter or underscore, then letters/digits/underscores.
 *
 * check_word_chr_initial (p2com.asm:8893) accepts '_' or a letter; check_word_chr also
 * accepts digits. A name that starts with a digit never reaches the symbol path at all —
 * check_dd_num claims it and the element becomes dd_num, which aborts the statement.
 */
const LEGAL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Validate a user-supplied DEBUG display name against the PNut rule.
 *
 * Case-insensitive: check_word_chr calls `uppercase` before the symbol is stored, so
 * `Trace`, `TRACE` and `trace` are one symbol. The name a display SHOWS keeps the user's
 * original casing — parse_debug_string copies "original non-uppercased symbol to dd_name"
 * — so this returns the caller's spelling, only length-clipped.
 *
 * Not checked here: whether the name is already taken by an open display. That is the
 * dd_nam case, and we already detect it downstream in WindowRouter.registerWindow (which
 * stops the run — our documented deviation from PNut's index-keyed displays).
 */
export function validateDisplayName(rawName: string | undefined): DisplayNameCheck {
  if (rawName === undefined || rawName.length === 0) {
    return { ok: false, reason: 'a display name is required after the display type' };
  }

  if (!LEGAL_NAME.test(rawName)) {
    const startsWithDigit = /^[0-9]/.test(rawName);
    return {
      ok: false,
      reason: startsWithDigit
        ? `'${rawName}' starts with a digit — a display name must start with a letter or underscore`
        : `'${rawName}' contains characters that are not allowed — a display name may use only letters, digits and underscore, and must start with a letter or underscore`
    };
  }

  if (DEBUG_DISPLAY_RESERVED_WORDS.has(rawName.toUpperCase())) {
    return {
      ok: false,
      reason:
        `'${rawName}' is a reserved DEBUG display word (matching is case-insensitive), so it cannot be used as a display name`
    };
  }

  // Pascal truncates rather than rejecting; mirror that, and let the caller say so.
  const truncated = rawName.length > MAX_DISPLAY_NAME_LENGTH;
  return {
    ok: true,
    name: truncated ? rawName.substring(0, MAX_DISPLAY_NAME_LENGTH) : rawName,
    truncated
  };
}
