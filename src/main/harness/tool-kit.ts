import type { HarnessToolDefinition, HarnessToolResult, JsonSchema } from "reins";

export const text = (value: string): HarnessToolResult => ({ content: [{ type: "text", text: value }] });

export const failed = (value: string): HarnessToolResult => ({
  content: [{ type: "text", text: value }],
  isError: true,
});

export interface ToolSpec<T> {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  parse(input: unknown): T;
  run(input: T): Promise<HarnessToolResult> | HarnessToolResult;
}

/**
 * The runtime replaces a thrown validation or execution error with a generic
 * sentence, so both are caught here and returned as the tool result the model
 * actually needs to read.
 */
export function defineTool<T>(spec: ToolSpec<T>): HarnessToolDefinition {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    async execute(input) {
      let parsed: T;
      try {
        parsed = spec.parse(input);
      } catch (error) {
        return failed(error instanceof Error ? error.message : String(error));
      }
      try {
        return await spec.run(parsed);
      } catch (error) {
        return failed(`${spec.name} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
