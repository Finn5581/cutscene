import { expect, test } from "vitest";
import { resolveAt, NOISE_GLYPHS } from "@/lib/scramble";

test("fully revealed equals target", () => {
  expect(resolveAt("HELLO", 5, () => 0).text).toBe("HELLO");
});

test("zero revealed is all noise, same length, from glyph set", () => {
  const { text } = resolveAt("HELLO", 0, () => 0);
  expect(text).toHaveLength(5);
  for (const ch of text) expect(NOISE_GLYPHS).toContain(ch);
});

test("spaces always pass through", () => {
  expect(resolveAt("A B", 0, () => 0).text[1]).toBe(" ");
});

test("marks which indices are resolved", () => {
  expect(resolveAt("HELLO", 2, () => 0).resolved).toEqual([
    true,
    true,
    false,
    false,
    false,
  ]);
});
