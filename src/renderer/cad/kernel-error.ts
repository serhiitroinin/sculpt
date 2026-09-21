import { getOC } from "replicad";

/**
 * OpenCascade throws a `WebAssembly.Exception` whose default text is
 * "[object WebAssembly.Exception]". Emscripten can translate it, which is the
 * difference between a useless message and a usable one for the agent.
 */
export function describeKernelError(error: unknown): string | undefined {
  const exception = (WebAssembly as { Exception?: Function }).Exception;
  if (typeof exception !== "function" || !(error instanceof exception)) return undefined;
  const oc = getOC() as unknown as { getExceptionMessage?(value: unknown): unknown };
  if (typeof oc.getExceptionMessage !== "function") return undefined;
  const message = oc.getExceptionMessage(error);
  const parts = Array.isArray(message) ? message.filter((part) => typeof part === "string") : [message];
  const text = parts.filter((part) => typeof part === "string" && part.trim() !== "").join(": ");
  return text === "" ? undefined : text;
}
