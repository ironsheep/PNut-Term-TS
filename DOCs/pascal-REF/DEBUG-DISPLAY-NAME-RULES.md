# DEBUG display names — what is legal, and why

**Authority:** `p2com.asm` — `parse_debug_string` (line 19502) and the `debug_symbols`
table (line 19335), reached from Pascal through `GlobalUnit.pas:159`
(`procedure P2ParseDebugString; external`).
**Version:** PNut v55. **Written:** 2026-07-27.

> **Read this before looking in `DebugDisplayUnit.pas`.** The display unit does *not* parse
> names. It consumes an already-tokenized stream (`P2.DebugDisplayType[]` /
> `DebugDisplayValue[]`, elements `ele_key` / `ele_num` / `ele_str` / `ele_end`). The
> tokenizer — and therefore the whole naming rule — lives in the assembly routine above.

## The grammar, from the source's own comment

```
Instance:   dd_dis
            dd_unk   (unknown symbol, assigned dd_nam and debug_display_new)
            dd_key | dd_num | dd_str
            dd_end

Command:    dd_nam
            dd_key | dd_num | dd_str
            dd_end
```

A **creation** statement is a display type followed by a name that must be `dd_unk` —
"a symbol I do not already know". Enforced in four instructions:

```asm
@@newinstance:  call    enter_dd_record
                call    get_dd_element      ;check for unique instance name
                cmp     al,dd_unk
                jne     @@abort
```

Everything else the tokenizer can produce fails: a display type (`dd_dis`), a directive
keyword (`dd_key`), the name of an open display (`dd_nam`), a number (`dd_num`) or a
string (`dd_str`).

## The failure mode is SILENCE (this is the important part)

`@@abort` sets `debug_display_type[0] = 0`. `DebugUnit.pas:224/231` dispatches only on
`= 1` (create) and `= 2` (update), so the entire debug display statement is dropped: **no
window, no error, no clue.** A user who names a display `trace` sees nothing happen and
has nothing to search for.

**PNut-Term-TS deliberately deviates here.** We refuse the name *loudly* — the reason is
logged and the run stops with `ExitCode.DisplayError` (4) — mirroring what we already do
for a duplicate display name. Rationale: a silent no-window is the worst outcome for the
person debugging, and the condition is a program bug that will not fix itself.
Implementation: `src/classes/shared/displayNameRules.ts`, enforced in
`MainWindow.handleWindowCommand`.

## The rule

A display name is legal if and only if:

1. **It starts with a letter or `_`, and continues with letters, digits or `_`.**
   `check_word_chr_initial` accepts `_` or a letter; `check_word_chr` also accepts digits
   (`p2com.asm:8888`). A name starting with a digit never reaches the symbol path —
   `check_dd_num` claims it, the element becomes `dd_num`, and the statement aborts.
2. **It is not one of the 103 reserved words** listed below.
3. **It is not the name of a display that is currently open.** That resolves to `dd_nam`.
   A `CLOSE` returns the name to `dd_unk` (`parse_debug_string` rewrites the symbol type),
   so names are reusable after closing.
4. **Matching is case-insensitive.** `check_word_chr` calls `uppercase` before the symbol
   is stored, so `Trace`, `TRACE` and `trace` are one symbol. The name a window *displays*
   keeps the user's spelling — the parser copies the "original non-uppercased symbol to
   `dd_name`".
5. **It is truncated to 30 characters** (`symbol_size_limit = 30`, `p2com.asm:61`).
   `check_dd_sym` keeps consuming past the limit but stops storing, so a longer name is
   silently shortened — **not** an error. Consequence worth knowing: two names that differ
   only after character 30 become the same name, and then collide as a duplicate.

Also bounded by the format, though not by the name rule: **at most 32 displays** exist at
once (the id search in `parse_debug_string` aborts at 32), and an update statement may
address up to 32 target names.

## The 103 reserved words

They come from `debug_symbols`, which `reset_debug_symbols` loads into `ddsymbols_auto`
before every parse. **This is the debug-display symbol table and nothing else — it is not
the Spin2 language's keyword list.** That distinction is the answer to the question that
prompted this document: `spin2` is a perfectly legal display name because it is not a
display directive, while `trace` is not, because it is `dd_key_trace`.

| Group | Words |
|---|---|
| Display types (9) | `LOGIC` `SCOPE` `SCOPE_XY` `FFT` `SPECTRO` `PLOT` `TERM` `BITMAP` `MIDI` |
| Colors (11) | `BLACK` `WHITE` `ORANGE` `BLUE` `GREEN` `CYAN` `RED` `MAGENTA` `YELLOW` `GRAY` `GREY` |
| Color modes (19) | `LUT1` `LUT2` `LUT4` `LUT8` `LUMA8` `LUMA8W` `LUMA8X` `HSV8` `HSV8W` `HSV8X` `RGBI8` `RGBI8W` `RGBI8X` `RGB8` `HSV16` `HSV16W` `HSV16X` `RGB16` `RGB24` |
| Packed data (12) | `LONGS_1BIT` `LONGS_2BIT` `LONGS_4BIT` `LONGS_8BIT` `LONGS_16BIT` `WORDS_1BIT` `WORDS_2BIT` `WORDS_4BIT` `WORDS_8BIT` `BYTES_1BIT` `BYTES_2BIT` `BYTES_4BIT` |
| Directives (52) | `ALT` `AUTO` `BACKCOLOR` `BOX` `CARTESIAN` `CHANNEL` `CIRCLE` `CLEAR` `CLOSE` `COLOR` `CROP` `DEPTH` `DOT` `DOTSIZE` `HIDEXY` `HOLDOFF` `LAYER` `LINE` `LINESIZE` `LOGSCALE` `LUTCOLORS` `MAG` `OBOX` `OPACITY` `ORIGIN` `OVAL` `PC_KEY` `PC_MOUSE` `POLAR` `POS` `PRECISE` `RANGE` `RATE` `SAMPLES` `SAVE` `SCROLL` `SET` `SIGNED` `SIZE` `SPACING` `SPARSE` `SPRITE` `SPRITEDEF` `TEXT` `TEXTANGLE` `TEXTSIZE` `TEXTSTYLE` `TITLE` `TRACE` `TRIGGER` `UPDATE` `WINDOW` |

`GRAY` and `GREY` are two table entries mapping to one key — the source comment says
"(allow both spellings)" — so both are reserved.

The transcription in `displayNameRules.ts` was diffed against the assembly table
programmatically and is identical, set for set. `tests/displayNameRules.test.ts` pins the
count at 103 so a partial edit cannot pass unnoticed.

## Why the rule has to exist — it bites us too

The DEBUG wire protocol addresses displays **by name only**; there is no instance id on
the wire. A name that is also a keyword is therefore genuinely ambiguous, and not only for
PNut: our own `WindowRouter.routeBacktickCommand` implements multi-window fan-out by
consuming *consecutive tokens that match a registered window name*. With a display called
`trace` registered, an unrelated update such as

```
`MyBitmap TRACE 5
```

has its `TRACE` **directive** eaten as a second routing target — the directive is lost and
`5` is delivered to both windows. `BITMAP` and `SPECTRO` both take `TRACE` as a real
directive, so this was live, not theoretical, before the name check was added.

## Where this is implemented

| Concern | Location |
|---|---|
| The rule + reserved table | `src/classes/shared/displayNameRules.ts` |
| Enforcement (creation) | `MainWindow.handleWindowCommand` — before any window object exists |
| Duplicate name (rule 3) | `WindowRouter.registerWindow` — pre-existing, same fatal path |
| Rule tests | `tests/displayNameRules.test.ts` (31) |
| Wiring tests | `tests/displayNameEnforcement.test.ts` (7) |
