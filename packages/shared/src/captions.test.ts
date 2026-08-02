import { describe, expect, it } from "vitest";
import { generateCaption } from "./captions.js";
import type { ElementMeta } from "./types.js";

function meta(over: Partial<ElementMeta>): ElementMeta {
  return {
    selector: "button",
    tagName: "button",
    text: null,
    role: null,
    boundingRect: { x: 0, y: 0, w: 0.1, h: 0.05 },
    ...over,
  };
}

describe("generateCaption", () => {
  it("captions a labelled button as a click", () => {
    expect(generateCaption(meta({ tagName: "button", text: "Submit" }))).toBe(
      'Click the "Submit" button',
    );
  });

  it("uses 'Type into' for inputs", () => {
    expect(
      generateCaption(meta({ tagName: "input", role: "textbox", text: "Email" })),
    ).toBe('Type into the "Email" field');
  });

  it("uses 'Open' for links", () => {
    expect(generateCaption(meta({ tagName: "a", text: "Settings" }))).toBe(
      'Open the "Settings" link',
    );
  });

  it("falls back gracefully when there is no label", () => {
    expect(generateCaption(meta({ tagName: "button", text: null }))).toBe(
      "Click the button",
    );
  });

  it("prefixes the step number when order is provided", () => {
    expect(generateCaption(meta({ text: "Save" }), 0)).toBe(
      'Step 1: Click the "Save" button',
    );
  });

  it("truncates very long labels", () => {
    const long = "a".repeat(100);
    const caption = generateCaption(meta({ text: long }));
    expect(caption).toContain("…");
    expect(caption.length).toBeLessThan(80);
  });

  it("selects from dropdowns", () => {
    expect(
      generateCaption(meta({ tagName: "select", role: "combobox", text: "Country" })),
    ).toBe('Select from the "Country" dropdown');
  });
});
