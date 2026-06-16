import { expect, test } from "vitest";
import { nextIndex } from "@/lib/rotation";

test("wraps to 0 at end", () => {
  expect(nextIndex(2, 3)).toBe(0);
});

test("advances", () => {
  expect(nextIndex(0, 3)).toBe(1);
});

test("single item stays", () => {
  expect(nextIndex(0, 1)).toBe(0);
});
