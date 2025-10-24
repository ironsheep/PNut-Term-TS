/** @format */

'use strict';

/**
 * Tokenize a command string, preserving quoted strings
 * Handles both single and double quotes
 * Treats commas as separate tokens outside of quotes
 *
 * @param command The command string to tokenize
 * @returns Array of tokens with quotes preserved
 *
 * @example
 * tokenizeCommand("title 'Binary LEDS' size 100")
 * // Returns: ["title", "'Binary LEDS'", "size", "100"]
 */
export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null; // null, '"', or "'"

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (inQuote) {
      // Inside quoted string - add everything until closing quote
      current += ch;
      if (ch === inQuote) {
        inQuote = null;
      }
    } else {
      // Outside quoted string
      if (ch === '"' || ch === "'") {
        // Starting quoted string
        current += ch;
        inQuote = ch;
      } else if (ch === ',') {
        // Comma outside quotes - finish current token and add comma as separate token
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        tokens.push(',');
      } else if (ch === ' ' || ch === '\t') {
        // Whitespace outside quotes - finish current token
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += ch;
      }
    }
  }

  // Add final token if any
  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}
