import { expect, test } from "vitest";
import { isValidEmail } from "@/lib/validation";

test.each(["a@b.co", "finn5581@gmail.com"])("valid: %s", (e) =>
  expect(isValidEmail(e)).toBe(true),
);

test.each(["", "nope", "a@", "a@b", "a b@c.co"])("invalid: %s", (e) =>
  expect(isValidEmail(e)).toBe(false),
);
