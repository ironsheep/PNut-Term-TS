/** @format */

// displayNameRules.test.ts
//
// Pins the PNut rule for what a user may name a DEBUG display.
//
// PROVENANCE (why these expectations are what they are): p2com.asm's parse_debug_string
// (line 19502) requires the name token to resolve to dd_unk — "not a symbol I already
// know" — and the debug_symbols table (line 19335) is the list of symbols it knows. This
// is the DEBUG-DISPLAY table, NOT the Spin2 language's reserved words, which is the whole
// reason `spin2` is a legal display name and `trace` is not.
//
// Found the hard way on hardware 2026-07-27: a display named `trace` "didn't work" while
// `spin2` did, with no error either way — because PNut's failure mode is to discard the
// statement silently (debug_display_type[0] = 0 matches neither create nor update in
// DebugUnit.pas:224/231).

import {
  validateDisplayName,
  DEBUG_DISPLAY_RESERVED_WORDS,
  MAX_DISPLAY_NAME_LENGTH
} from '../src/classes/shared/displayNameRules';

describe('DEBUG display name rules (p2com.asm parse_debug_string)', () => {
  describe('the reserved table matches debug_symbols exactly', () => {
    it('holds all 103 entries', () => {
      // 9 display types + 94 keywords (GRAY and GREY are separate entries mapping to one key).
      expect(DEBUG_DISPLAY_RESERVED_WORDS.size).toBe(103);
    });

    it('includes every display type', () => {
      for (const type of ['LOGIC', 'SCOPE', 'SCOPE_XY', 'FFT', 'SPECTRO', 'PLOT', 'TERM', 'BITMAP', 'MIDI']) {
        expect(DEBUG_DISPLAY_RESERVED_WORDS.has(type)).toBe(true);
      }
    });

    it('reserves BOTH spellings of gray', () => {
      // The table has two entries for one key: sym dd_key, dd_key_gray, 'GRAY' / 'GREY'.
      expect(DEBUG_DISPLAY_RESERVED_WORDS.has('GRAY')).toBe(true);
      expect(DEBUG_DISPLAY_RESERVED_WORDS.has('GREY')).toBe(true);
    });

    it('is uppercase throughout, since lookups uppercase first', () => {
      for (const word of DEBUG_DISPLAY_RESERVED_WORDS) {
        expect(word).toBe(word.toUpperCase());
      }
    });
  });

  describe('the two names actually observed on hardware', () => {
    it("rejects 'trace' — it is dd_key_trace", () => {
      const result = validateDisplayName('trace');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('reserved');
    });

    it("accepts 'spin2' — the debug-display table is not the Spin2 keyword list", () => {
      const result = validateDisplayName('spin2');
      expect(result.ok).toBe(true);
    });
  });

  describe('reserved-word matching is case-insensitive', () => {
    // check_word_chr calls `uppercase` before storing the symbol, so all spellings collide.
    it.each(['TRACE', 'Trace', 'tRaCe', 'trace'])('rejects %s', (name) => {
      expect(validateDisplayName(name).ok).toBe(false);
    });

    it('rejects a lowercase display type just as firmly', () => {
      expect(validateDisplayName('plot').ok).toBe(false);
      expect(validateDisplayName('scope_xy').ok).toBe(false);
    });
  });

  describe('character rules (check_word_chr / check_word_chr_initial)', () => {
    it.each(['MyPlot', '_private', 'a', 'A1', 'trace_2', 'X_1_Y', 'spin2'])('accepts %s', (name) => {
      expect(validateDisplayName(name).ok).toBe(true);
    });

    it('rejects a leading digit — check_dd_num claims it and the statement aborts', () => {
      const result = validateDisplayName('2fast');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('starts with a digit');
    });

    it.each(['my-plot', 'my plot', 'plot!', 'café', 'a.b'])('rejects %s', (name) => {
      expect(validateDisplayName(name).ok).toBe(false);
    });

    it('rejects an empty or missing name', () => {
      expect(validateDisplayName('').ok).toBe(false);
      expect(validateDisplayName(undefined).ok).toBe(false);
    });
  });

  describe('length: PNut truncates, it does not reject', () => {
    it(`passes a name of exactly ${MAX_DISPLAY_NAME_LENGTH} characters unchanged`, () => {
      const name = 'a'.repeat(MAX_DISPLAY_NAME_LENGTH);
      const result = validateDisplayName(name);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.name).toBe(name);
        expect(result.truncated).toBe(false);
      }
    });

    it('truncates a longer name and flags it, matching symbol_size_limit = 30', () => {
      const result = validateDisplayName('a'.repeat(40));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.name).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
        expect(result.truncated).toBe(true);
      }
    });

    it('two names differing only past character 30 truncate to the SAME name', () => {
      // This is why truncation is worth warning about: the collision then surfaces as our
      // duplicate-display-name fatal, which would otherwise look inexplicable.
      const a = validateDisplayName('x'.repeat(30) + 'ALPHA');
      const b = validateDisplayName('x'.repeat(30) + 'BETA');
      expect(a.ok && b.ok && a.name === b.name).toBe(true);
    });
  });

  describe('the name keeps the user spelling (dd_name is the non-uppercased copy)', () => {
    it('returns the original casing, not the uppercased symbol', () => {
      const result = validateDisplayName('MyMixedCaseName');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.name).toBe('MyMixedCaseName');
    });
  });

  describe('every reserved word is rejected, none of them by accident', () => {
    it('rejects all 103', () => {
      const accepted = [...DEBUG_DISPLAY_RESERVED_WORDS].filter((w) => validateDisplayName(w).ok);
      expect(accepted).toEqual([]);
    });

    it('accepts near-misses that are NOT in the table', () => {
      // Guard against an over-broad check (e.g. substring or prefix matching): these all
      // contain or extend a reserved word but are themselves legal names.
      for (const name of ['traces', 'my_trace', 'TRACE_1', 'plotter', 'setpoint', 'window2', 'greyish']) {
        expect(validateDisplayName(name).ok).toBe(true);
      }
    });
  });
});
