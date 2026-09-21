import { CONTRACT } from "./contract.ts";
import { PRIMITIVES } from "./primitives.ts";
import { DRAWING } from "./drawing.ts";
import { SOLIDS } from "./solids.ts";
import { FINDERS } from "./finders.ts";
import { RECIPES } from "./recipes.ts";

export const REFERENCE_TOPICS = {
  contract: { title: "The model script contract", body: CONTRACT },
  primitives: { title: "Primitives, transforms and repetition", body: PRIMITIVES },
  drawing: { title: "2D drawings, the pen, and planes", body: DRAWING },
  solids: { title: "Extrude, revolve, loft, booleans, shell", body: SOLIDS },
  finders: { title: "Fillets, chamfers, edge and face finders", body: FINDERS },
  recipes: { title: "Working recipes and common failures", body: RECIPES },
} as const;

export type ReferenceTopic = keyof typeof REFERENCE_TOPICS;

export const REFERENCE_TOPIC_IDS = Object.keys(REFERENCE_TOPICS) as ReferenceTopic[];

export function referenceIndex(): string {
  return REFERENCE_TOPIC_IDS
    .map((id) => `- ${id}: ${REFERENCE_TOPICS[id].title}`)
    .join("\n");
}

export function isReferenceTopic(value: unknown): value is ReferenceTopic {
  return typeof value === "string" && value in REFERENCE_TOPICS;
}

/** Every fenced `js` block in the reference is a complete, runnable script. */
export function referenceExamples(): { topic: ReferenceTopic; index: number; source: string }[] {
  const examples: { topic: ReferenceTopic; index: number; source: string }[] = [];
  for (const topic of REFERENCE_TOPIC_IDS) {
    const blocks = REFERENCE_TOPICS[topic].body.matchAll(/```js\n([\s\S]*?)```/g);
    let index = 0;
    for (const block of blocks) {
      examples.push({ topic, index, source: block[1] ?? "" });
      index += 1;
    }
  }
  return examples;
}
