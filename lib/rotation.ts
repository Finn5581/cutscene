/** Advance an index through a ring of `len` items, wrapping at the end. */
export const nextIndex = (i: number, len: number) => (i + 1) % len;
