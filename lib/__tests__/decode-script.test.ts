import { expect, test } from "vitest";
import { DECODES } from "@/lib/decode-script";

test("2-3 decodes of distinct formats", () => {
  expect(DECODES.length).toBeGreaterThanOrEqual(2);
  expect(DECODES.length).toBeLessThanOrEqual(3);
  const formats = new Set(DECODES.map((d) => d.format));
  expect(formats.size).toBe(DECODES.length);
});

test("every decode has the 5 readout fields", () => {
  for (const d of DECODES) {
    for (const k of ["format", "beat", "sound", "reference", "whySpread"] as const) {
      expect(typeof d[k]).toBe("string");
      expect(d[k].length).toBeGreaterThan(0);
    }
  }
});

test("WHY-IT-SPREAD stays under-promised (grounded, short, no fake metrics)", () => {
  for (const d of DECODES) {
    expect(d.whySpread.length).toBeLessThanOrEqual(60);
    expect(d.whySpread).not.toMatch(/\d+\s*%|\d+[KMB]\s*views|viral|guaranteed/i);
  }
});
