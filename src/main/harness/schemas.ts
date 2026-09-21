import type { JsonSchema } from "reins";
import { REFERENCE_TOPIC_IDS } from "../../shared/reference/index.ts";

const object = (properties: Record<string, unknown>, required: string[]): JsonSchema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export const SET_MODEL = object({
  source: { type: "string", description: "The complete ES module for this revision, with export function main()." },
  note: { type: "string", description: "One short line describing what changed." },
}, ["source", "note"]);

export const GET_MODEL = object({}, []);

export const VIEW_NAMES = [
  "iso", "front", "back", "left", "right", "top", "bottom", "current",
] as const;

export const RENDER_VIEWS = object({
  views: {
    type: "array",
    minItems: 1,
    maxItems: 4,
    items: {
      oneOf: [
        { type: "string", enum: [...VIEW_NAMES] },
        object({ azimuth: { type: "number" }, elevation: { type: "number" } }, ["azimuth", "elevation"]),
      ],
    },
  },
  size: { type: "integer", minimum: 256, maximum: 1024 },
}, ["views"]);

export const MEASURE = object({
  kind: { type: "string", enum: ["bounding-box", "distance", "part-distance"] },
  part: { type: "string" },
  from: { oneOf: [{ type: "string" }, { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 }] },
  to: { oneOf: [{ type: "string" }, { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 }] },
}, ["kind"]);

export const READ_REFERENCE = object({
  topic: { type: "string", enum: [...REFERENCE_TOPIC_IDS] },
}, ["topic"]);

export const VIEW_REFERENCE_IMAGE = object({
  id: { type: "string", description: "The reference image id from the model context." },
}, ["id"]);

export const LIST_PINS = object({}, []);

export function requireObject(input: unknown, tool: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(`${tool} takes a JSON object.`);
  }
  return input as Record<string, unknown>;
}

export function requireString(value: unknown, field: string, tool: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${tool} needs a non-empty string for "${field}".`);
  }
  return value;
}

export function requirePoint(value: unknown, field: string, tool: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => typeof entry !== "number")) {
    throw new Error(`${tool} needs three numbers for "${field}", for example [10, 0, 5].`);
  }
  return value as [number, number, number];
}
