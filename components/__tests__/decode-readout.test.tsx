import { render, screen } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import { DecodeReadout } from "@/components/decode-readout";

beforeEach(() => {
  // Force prefers-reduced-motion: the component must show final text immediately.
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: true,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

const LINES = [{ label: "FORMAT", value: "deadpan reaction" }];

test("reduced motion shows final value immediately", async () => {
  render(<DecodeReadout lines={LINES} />);
  expect(await screen.findByText("deadpan reaction")).toBeInTheDocument();
});

test("exposes full readout to screen readers, hides animation", () => {
  const { container } = render(<DecodeReadout lines={LINES} />);
  expect(
    container.querySelector('[aria-label*="deadpan reaction"]'),
  ).toBeTruthy();
  expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
});
