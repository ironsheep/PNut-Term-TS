/** @format */

// Common file-system operations shares by classes in Pnut-TS.

// src/utils/htmlUtils.ts

'use strict';

// Utility function to escape HTML special characters
export function escapeHtml(unsafe: string): string {
  return unsafe.replace(/[&<>"']/g, (match) => {
    const escapeMap: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return escapeMap[match];
  });
}
