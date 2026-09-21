import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/renderer/styles/tokens.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`tokens.css has no ${selector} block`);
  const body = css.slice(start, css.indexOf("}", start));
  const values: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    values[name!] = value!.trim();
  }
  return values;
}

const dark = block(":root");
const light = { ...dark, ...block('[data-theme="light"]') };

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
  return 0.2126 * channel(red!) + 0.7152 * channel(green!) + 0.0722 * channel(blue!);
}

export function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

const SURFACES = ["--bench", "--panel", "--raised"] as const;
const RULES: [string, number][] = [["--text", 7], ["--text-2", 4.5], ["--text-3", 3]];

for (const [theme, tokens] of [["dark", dark], ["light", light]] as const) {
  for (const [token, minimum] of RULES) {
    for (const surface of SURFACES) {
      test(`${theme}: ${token} on ${surface} reaches ${minimum}:1`, () => {
        const ratio = contrast(tokens[token]!, tokens[surface]!);
        expect(Math.round(ratio * 100) / 100).toBeGreaterThanOrEqual(minimum);
      });
    }
  }

  test(`${theme}: the signal colour is legible on the panel`, () => {
    expect(contrast(tokens["--signal"]!, tokens["--panel"]!)).toBeGreaterThanOrEqual(3);
  });

  test(`${theme}: a balloon numeral is legible on the signal colour`, () => {
    expect(contrast(tokens["--signal-ink"]!, tokens["--signal"]!)).toBeGreaterThanOrEqual(4.5);
  });

  test(`${theme}: the error and success colours are legible on the panel`, () => {
    expect(contrast(tokens["--err"]!, tokens["--panel"]!)).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens["--ok"]!, tokens["--panel"]!)).toBeGreaterThanOrEqual(3);
  });
}

test("no font size in the stylesheets drops below 11.5 px", () => {
  const sheets = ["tokens.css", "app.css"].map((name) =>
    readFileSync(new URL(`../src/renderer/styles/${name}`, import.meta.url), "utf8"));
  const sizes = sheets
    .flatMap((sheet) => [...sheet.matchAll(/font-size:\s*([\d.]+)px/g)])
    .map((match) => Number(match[1]));
  expect(sizes.length).toBeGreaterThan(5);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11.5);
});

test("the narrow display faces are gone", () => {
  expect(css).not.toContain("Barlow");
});
