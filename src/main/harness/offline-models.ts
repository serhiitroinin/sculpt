/**
 * The scripted models of the offline engine. Each scenario is a list of
 * revisions. A test builds every source with the real kernel.
 */

export interface OfflineStep {
  note: string;
  thinking: string;
  /** Reference topics to read before the build. */
  reads: ("recipes" | "solids" | "finders" | "drawing")[];
  source: string;
  views: ("iso" | "front" | "top" | "right" | "back")[];
  measure?: { kind: "part-distance"; from: string; to: string } | { kind: "bounding-box"; part: string };
  reply: string;
}

export interface OfflineScenario {
  id: "bracket" | "enclosure" | "stand";
  /** The first prompt that matches selects the scenario. */
  match: RegExp;
  steps(turn: number): OfflineStep;
}

/** The foot follows the turn so a second revision has a real diff. */
function bracket(foot: number): string {
  return `export function main() {
  const profile = draw([0, 0])
    .hLine(60)
    .vLine(${foot})
    .customCorner(3)
    .hLine(-48)
    .vLine(${48 - foot})
    .customCorner(3)
    .hLine(-12)
    .close();
  let bracket = profile.sketchOnPlane("XZ", -20).extrude(40);
  for (const y of [-12, 12]) {
    bracket = bracket.cut(makeCylinder(2.2, 30, [40, y, -5]));
  }
  return [{ name: "bracket", shape: bracket, color: "#9fb2c4" }];
}
`;
}

interface EnclosureOptions {
  height: number;
  lid: boolean;
  vents: boolean;
  softEdges: boolean;
}

function enclosure(options: EnclosureOptions): string {
  const lid = options.lid
    ? `
  // The lid lies beside the body, top face down, as it prints.
  let lid = drawRoundedRectangle(LENGTH, WIDTH, CORNER).sketchOnPlane("XY").extrude(LID)${options.softEdges ? `
    .fillet(1.2, (e) => e.inPlane("XY", 0))` : ""};
  const lip = drawRoundedRectangle(LENGTH - 2 * WALL - 2 * FIT, WIDTH - 2 * WALL - 2 * FIT, CORNER - WALL)
    .sketchOnPlane("XY", LID)
    .extrude(3);
  const lipHollow = drawRoundedRectangle(LENGTH - 4 * WALL, WIDTH - 4 * WALL, CORNER - 2 * WALL)
    .sketchOnPlane("XY", LID)
    .extrude(4);
  lid = lid.fuse(lip).cut(lipHollow);
${options.vents ? `  for (let index = -3; index <= 3; index += 1) {
    const slot = drawRoundedRectangle(3, 30, 1.4).sketchOnPlane("XY", -1).extrude(LID + 2);
    lid = lid.cut(slot.translateX(index * 7));
  }
` : ""}  parts.push({ name: "lid", shape: lid.translateY(WIDTH + 14), color: "#c7a98b" });
`
    : "";
  return `const LENGTH = 82;   // outside, along X
const WIDTH = 62;    // outside, along Y
const HEIGHT = ${options.height};
const WALL = 2;
const CORNER = 7;
const LID = 2.4;
const FIT = 0.2;     // clearance between the lid lip and the wall
const PCB = { length: 70, width: 50, thickness: 1.6, holeInset: 4 };
const STANDOFF = 5;

export function main() {
  let body = drawRoundedRectangle(LENGTH, WIDTH, CORNER).sketchOnPlane("XY").extrude(HEIGHT)
    .shell(WALL, (f) => f.inPlane("XY", HEIGHT))${options.softEdges ? `
    .fillet(1.6, (e) => e.inPlane("XY", 0))` : ""};

  // Four standoffs under the PCB holes, each with an M3 pilot hole.
  const x = PCB.length / 2 - PCB.holeInset;
  const y = PCB.width / 2 - PCB.holeInset;
  for (const [sx, sy] of [[-x, -y], [x, -y], [-x, y], [x, y]]) {
    body = body
      .fuse(makeCylinder(3.4, STANDOFF, [sx, sy, WALL - 0.2]))
      .cut(makeCylinder(1.25, STANDOFF + 1, [sx, sy, WALL + 0.6]));
  }

  // A USB-C opening in the -X wall, level with the top of the PCB.
  const port = drawRoundedRectangle(10, 4.2, 1.6)
    .sketchOnPlane("YZ", -LENGTH / 2 - 1)
    .extrude(WALL + 2)
    .translateZ(WALL + STANDOFF + PCB.thickness + 2.1);
  body = body.cut(port);

  let board = makeBaseBox(PCB.length, PCB.width, PCB.thickness).translateZ(WALL + STANDOFF);
  for (const [sx, sy] of [[-x, -y], [x, -y], [-x, y], [x, y]]) {
    board = board.cut(makeCylinder(1.6, 6, [sx, sy, WALL + STANDOFF - 2]));
  }

  const parts = [
    { name: "body", shape: body, color: "#9fb2c4" },
    { name: "pcb", shape: board, color: "#5f8f6b" },
  ];
${lid}  return parts;
}
`;
}

function stand(angle: number, cable: boolean): string {
  return `const WIDTH = 72;
const BASE = 5;        // base thickness
const ANGLE = ${angle};      // degrees from the table
const REST = 84;       // length of the back rest
const THICK = 5;

export function main() {
  const lean = (ANGLE * Math.PI) / 180;
  const foot = [70, BASE];
  const top = [foot[0] - REST * Math.cos(lean), foot[1] + REST * Math.sin(lean)];
  const back = [top[0] - THICK * Math.sin(lean), top[1] - THICK * Math.cos(lean)];
  const heel = [back[0] + (back[1] - BASE) / Math.tan(lean), BASE];

  const profile = draw([0, 0])
    .hLine(92)
    .vLine(15)
    .customCorner(2.5)
    .hLine(-7)
    .customCorner(2.5)
    .vLine(-(15 - BASE))
    .hLine(-(85 - foot[0]))
    .lineTo(top)
    .lineTo(back)
    .customCorner(2)
    .lineTo(heel)
    .lineTo([0, BASE])
    .customCorner(2)
    .close();
  let body = profile.sketchOnPlane("XZ", -WIDTH / 2).extrude(WIDTH);

  // A window in the back rest saves material and lets the phone cool.
  const window = drawRoundedRectangle(40, 44, 8)
    .sketchOnPlane("XY")
    .extrude(40)
    .translateZ(-20)
    .rotate(90 - ANGLE, [0, 0, 0], [0, 1, 0])
    .translate([(foot[0] + top[0]) / 2, 0, (foot[1] + top[1]) / 2 + 4]);
  body = body.cut(window);
${cable ? `
  // The charging cable passes through the lip and under the phone.
  const slot = makeBaseBox(30, 14, 30).translate([82, 0, BASE]);
  body = body.cut(slot).cut(makeCylinder(5, 20, [77, 0, -5]));
` : ""}
  const pads = [-1, 1].map((side) => ({
    name: side < 0 ? "pad-left" : "pad-right",
    shape: makeBaseBox(80, 8, 1.2).translate([46, side * (WIDTH / 2 - 9), -1.2]),
    color: "#3b4148",
  }));
  return [{ name: "stand", shape: body, color: "#c7a98b" }, ...pads];
}
`;
}

const ENCLOSURE_STEPS: OfflineStep[] = [
  {
    note: "Enclosure body with four standoffs and the PCB",
    thinking: "Sizing the cavity from the 70 × 50 mm board",
    reads: ["recipes", "solids"],
    source: enclosure({ height: 24, lid: false, vents: false, softEdges: false }),
    views: ["iso", "top"],
    measure: { kind: "part-distance", from: "body", to: "pcb" },
    reply: "Built the body around the board.\n\n- outside 82 × 62 × 24 mm, 2 mm walls, 7 mm corners\n"
      + "- four standoffs, 5 mm tall, 2.5 mm pilot holes for M3 thread-forming screws\n"
      + "- USB-C opening in the left wall\n\nThe board is a separate part so you can check the fit. Do you want a lid?",
  },
  {
    note: "Add a lid with a 0.2 mm fit and seven vent slots",
    thinking: "The lid needs a lip that locates inside the wall",
    reads: ["recipes"],
    source: enclosure({ height: 24, lid: true, vents: true, softEdges: false }),
    views: ["iso", "top", "front"],
    measure: { kind: "bounding-box", part: "lid" },
    reply: "Added the lid. It lies beside the body, top face down, as it prints.\n\n"
      + "- 2.4 mm plate with a 3 mm lip, 0.2 mm clearance to the wall\n"
      + "- seven 3 × 30 mm vent slots above the board\n\nOverall **82 × 138 × 24 mm** on the print plate.",
  },
  {
    note: "Round the outside edges and raise the body to 28 mm",
    thinking: "A 1.6 mm radius stays inside the 2 mm wall",
    reads: ["finders"],
    source: enclosure({ height: 28, lid: true, vents: true, softEdges: true }),
    views: ["iso", "front"],
    reply: "Rounded the bottom edge of the body (1.6 mm) and the top edge of the lid (1.2 mm), "
      + "and raised the body to **28 mm**.\n\nThe radius is smaller than the 2 mm wall, so the floor keeps its thickness at the edge.",
  },
];

const STAND_STEPS: OfflineStep[] = [
  {
    note: "Phone stand at 60° with a window in the back rest",
    thinking: "One profile in XZ gives the base, the lip and the back rest",
    reads: ["drawing"],
    source: stand(60, false),
    views: ["iso", "right"],
    reply: "Built the stand from one extruded profile.\n\n- back rest at 60°, 84 mm long, 5 mm thick\n"
      + "- 15 mm lip with rounded corners\n- two rubber pads as separate parts\n\nOverall **92 × 72 × 79 mm**.",
  },
  {
    note: "Lean the rest to 68° and add a cable slot",
    thinking: "The cable must pass the lip and leave under the phone",
    reads: ["solids"],
    source: stand(68, true),
    views: ["iso", "front", "top"],
    reply: "Changed the angle to **68°** and cut a 14 mm cable slot through the lip, "
      + "with a 10 mm hole in the base under the connector.",
  },
];

export const OFFLINE_SCENARIOS: OfflineScenario[] = [
  {
    id: "enclosure",
    match: /enclosure|pcb|case\b|housing/i,
    steps: (turn) => ENCLOSURE_STEPS[Math.min(turn, ENCLOSURE_STEPS.length - 1)]!,
  },
  {
    id: "stand",
    match: /stand|phone/i,
    steps: (turn) => STAND_STEPS[Math.min(turn, STAND_STEPS.length - 1)]!,
  },
  {
    id: "bracket",
    match: /.*/,
    steps: (turn) => {
      const foot = 4 + (turn % 5);
      return {
        note: `Offline bracket, ${foot} mm foot`,
        thinking: "Choosing a construction",
        reads: [],
        source: bracket(foot),
        views: ["front", "top"],
        reply: `Built the bracket.\n\n- foot 60 × 40 × ${foot} mm\n- wall ${48 - foot} mm tall\n`
          + "- two 4.4 mm holes\n\nOverall **60 × 40 × 48 mm**.",
      };
    },
  },
];

/** Every source the offline engine can send, for the build test. */
export function offlineSources(): { name: string; source: string }[] {
  return [
    ...ENCLOSURE_STEPS.map((step, index) => ({ name: `enclosure ${index + 1}`, source: step.source })),
    ...STAND_STEPS.map((step, index) => ({ name: `stand ${index + 1}`, source: step.source })),
    { name: "bracket", source: bracket(6) },
  ];
}
