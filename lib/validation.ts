/** Pragmatic email shape check — not RFC-exhaustive, just "looks like an email". */
export const isValidEmail = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
