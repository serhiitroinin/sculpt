import { CadClient } from "./cad/client.ts";
import type { Viewport } from "./viewport/viewport.ts";
import type { ModelReport } from "../shared/cad.ts";
import "./bridge.ts";

/** One kernel worker and one viewport per window, shared by every component. */
export const session = {
  client: new CadClient(),
  viewport: undefined as Viewport | undefined,
  report: undefined as ModelReport | undefined,
};

/** The main process decides, through the preload bridge, never the page URL. */
if (window.sculpt?.debug === true) {
  (window as unknown as Record<string, unknown>).__sculpt = session;
}
