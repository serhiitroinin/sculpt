import type { BrowserWindow } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import type { SculptApp } from "./app.ts";
import { Driver, exportDirectory, finish, readFile, record, recordEqual } from "./e2e.ts";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** A 1x1 PNG, enough to prove the drop path and one image input part. */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const DROP_IMAGE = `
  const bytes = Uint8Array.from(atob(${JSON.stringify(PNG)}), (c) => c.charCodeAt(0));
  const file = new File([bytes], "dropped.png", { type: "image/png" });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  window.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
  return true;
`;

async function firstRun(driver: Driver): Promise<void> {
  process.stdout.write("\nsteering and stopping\n");
  await driver.type("A bracket");
  await wait(400);
  await driver.type("Make the foot 8 mm");
  await driver.settled();
  const transcript = await driver.text(".chat");
  record("the steering message reached the same turn", transcript.includes("Noted while running: Make the foot 8 mm"));
  recordEqual("steering started no second turn", driver.stats().turns, 1);
  recordEqual("the turn completed", driver.stats().lastStatus, "completed");
  record("the composer is idle again", (await driver.count(".activity-line")) === 0);

  await driver.type("A bracket again");
  await wait(500);
  await driver.click(".send.stop");
  await driver.settled();
  recordEqual("stop interrupted the turn", driver.stats().lastStatus, "interrupted");
  record("the interrupted turn kept its user message", (await driver.text(".chat")).includes("A bracket again"));
  record("the composer returned to idle", (await driver.count(".activity-line")) === 0);

  process.stdout.write("\na turn after a stop\n");
  await driver.type("One more bracket");
  await driver.settled();
  recordEqual("the next turn completed", driver.stats().lastStatus, "completed");
  record("the interrupted turn built nothing and the next one did", (await driver.text(".title-block")).includes("REV 02"));

  process.stdout.write("\npins, revisions and the build row\n");
  driver.clickViewport(600, 560);
  await wait(500);
  const pinned = await driver.count(".balloon-layer .balloon");
  record("a click on the model places a balloon", pinned > 0, `${pinned} balloons`);
  await driver.click(".title-block .rev button", 0);
  await wait(1500);
  record("the stepper moved to the earlier revision", (await driver.text(".title-block")).includes("REV 01"));
  recordEqual("the revision change cleared the pins", await driver.count(".balloon-layer .balloon"), 0);
  const buildRows = await driver.count(".revision-card");
  await driver.click(".revision-card", buildRows - 1);
  await wait(1500);
  record("a revision card jumps back to its revision", (await driver.text(".title-block")).includes("REV 02"));

  process.stdout.write("\nthe chat\n");
  record("a turn is folded once it is done", (await driver.text(".work-header")).includes("Worked for"));
  recordEqual("a folded turn hides its steps", await driver.count(".step"), 0);
  await openFolds(driver);
  record("the fold opens to the steps", (await driver.count(".step")) > 0);
  const labels = await driver.run(
    `return [...document.querySelectorAll(".step-text")].map((n) => n.textContent).join(" | ")`,
  ) as string;
  record("a step reads verb first", labels.includes("Built REV"), labels);
  await driver.run(
    `[...document.querySelectorAll(".step")].find((n) => n.textContent.includes("Built REV 02"))
      ?.querySelector(".step-line").click(); return true`,
  );
  await wait(500);
  record("a set_model row expands to a diff", (await driver.count(".diff-row.added")) > 0);
  record("the diff sits under a structural report", (await driver.count(".report tbody tr")) > 0);
  record("the revision card is in the prose flow", (await driver.count(".revision-card")) > 0);
  const cards = await driver.count(".revision-card");
  await driver.click(".revision-card", cards - 1);
  await wait(1500);
  record("the revision card jumps to its revision", (await driver.text(".title-block")).includes("REV 02"));

  process.stdout.write("\nreference images\n");
  await driver.run(DROP_IMAGE);
  await wait(900);
  record("the dropped image appears in the rail", (await driver.count(".thumbs .thumb")) === 1);
  await driver.click(".chips .chip", 0);
  await driver.type("Use this photo");
  await driver.settled();
  record(
    "the turn carried an image input part",
    driver.stats().lastInputKinds.includes("image"),
    driver.stats().lastInputKinds.join(","),
  );
  record("the image is marked as seen", (await driver.count(".thumb.seen")) === 1);

  process.stdout.write("\nrenders and themes\n");
  await openFolds(driver);
  const opened = await driver.run(
    `const row = [...document.querySelectorAll(".step")].find((n) => n.textContent.includes("Looked at"));
     if (!row) return "none";
     row.querySelector(".step-line").click();
     return "clicked";`,
  );
  await wait(900);
  record(
    "a render_views row expands to the image the agent saw",
    opened === "clicked" && (await driver.count(".render-tiles img")) > 0,
    String(opened),
  );

  for (const mode of ["light", "dark", "system"]) {
    await driver.click(".topbar-right .export button", 1);
    await wait(250);
    const index = ["system", "light", "dark"].indexOf(mode);
    await driver.click(".topbar-right .menu .menu-item", index);
    await wait(500);
    const theme = await driver.run(`return document.documentElement.dataset.theme`);
    record(`the theme menu selects ${mode}`, theme === "light" || theme === "dark", String(theme));
  }

  process.stdout.write("\nexport\n");
  await driver.click(".export button", 0);
  await wait(300);
  await driver.click(".export .menu-item", 0);
  await wait(2500);
  await driver.click(".export button", 0);
  await wait(300);
  await driver.click(".export .menu-item", 1);
  await wait(2500);
  const step = readFile(join(exportDirectory(), `${await projectName(driver)}.step`));
  const stl = readFile(join(exportDirectory(), `${await projectName(driver)}.stl`));
  record("the STEP file has the ISO header", step.toString("utf8", 0, 13) === "ISO-10303-21;");
  record("the STEP file is complete", step.toString("utf8").includes("END-ISO-10303-21;"));
  const triangles = stl.readUInt32LE(80);
  recordEqual("the STL length matches its triangle count", stl.byteLength, 84 + triangles * 50);

  process.stdout.write("\nprojects\n");
  const working = await projectName(driver);
  const before = (await driver.text(".title-block")).trim();
  writeFileSync(join(app.getPath("userData"), "e2e-project.txt"), `${working}\n${before}`);
  await driver.click(".topbar-left .project");
  await wait(200);
  const items = await driver.count(".topbar-left .menu-item");
  await driver.click(".topbar-left .menu-item", items - 1);
  await wait(2000);
  record("a new project starts empty", (await driver.text(".title-block")).includes("REV —"));
  recordEqual("a new project has no references", await driver.count(".thumbs .thumb"), 0);
  await openNamed(driver, working);
  recordEqual("switching back restores the model", (await driver.text(".title-block")).trim(), before);
  record("switching back restores the chat", (await driver.text(".chat")).includes("A bracket"));
  recordEqual("switching back restores the references", await driver.count(".thumbs .thumb"), 1);
}

async function openFolds(driver: Driver): Promise<void> {
  await driver.run(
    `document.querySelectorAll('.work-header[aria-expanded="false"]').forEach((node) => node.click()); return true`,
  );
  await wait(500);
}

async function projectName(driver: Driver): Promise<string> {
  return (await driver.text(".topbar-left .project")).trim();
}

async function openNamed(driver: Driver, name: string): Promise<void> {
  await driver.click(".topbar-left .project");
  await wait(250);
  const labels = await driver.run(
    `return [...document.querySelectorAll(".topbar-left .menu-item")].map((node) => node.textContent.trim())`,
  ) as string[];
  const index = labels.indexOf(name);
  if (index < 0) throw new Error(`the project menu has no "${name}": ${labels.join(", ")}`);
  await driver.click(".topbar-left .menu-item", index);
  await wait(3000);
}

async function secondRun(driver: Driver): Promise<void> {
  process.stdout.write("\nafter a restart\n");
  await wait(2000);
  const [name = "", title = ""] = readFileSync(join(app.getPath("userData"), "e2e-project.txt"), "utf8").split("\n");
  await openNamed(driver, name);
  recordEqual("the model returns after a restart", (await driver.text(".title-block")).trim(), title);
  record("the chat returns after a restart", (await driver.text(".chat")).includes("A bracket"));
  record("the references return after a restart", (await driver.count(".thumbs .thumb")) === 1);
  record("the engine choice is remembered", (await driver.text(".pill")).toLowerCase().includes("offline"));
}

export function runChecks(window: BrowserWindow, sculpt: SculptApp): void {
  window.webContents.once("did-finish-load", () => {
    void (async () => {
      const driver = new Driver(window, sculpt);
      try {
        await wait(Number(process.env.SCULPT_E2E_WARMUP ?? 12_000));
        if (process.env.SCULPT_E2E === "restart") await secondRun(driver);
        else await firstRun(driver);
      } catch (error) {
        record("the check script ran to the end", false, error instanceof Error ? error.message : String(error));
      }
      finish();
    })();
  });
}
