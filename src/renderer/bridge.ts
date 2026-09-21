import type { Bridge } from "../shared/ipc.ts";

declare global {
  interface Window {
    sculpt?: Bridge;
  }
}

export function bridge(): Bridge {
  const value = window.sculpt;
  if (!value) throw new Error("the preload bridge is missing");
  return value;
}
