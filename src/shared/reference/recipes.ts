export const RECIPES = `# Recipes that work

## A countersunk screw hole

\`\`\`js
function countersunk(diameter, headDiameter, depth) {
  const shaft = makeCylinder(diameter / 2, depth + 20, [0, 0, -10]);
  const head = drawCircle(headDiameter / 2)
    .sketchOnPlane("XY", depth)
    .loftWith(drawCircle(diameter / 2).sketchOnPlane("XY", depth - (headDiameter - diameter) / 2));
  return shaft.fuse(head).fuse(makeCylinder(headDiameter / 2, 20, [0, 0, depth]));
}

export function main() {
  let plate = makeBaseBox(80, 30, 4);
  for (const x of [-25, 25]) plate = plate.cut(countersunk(3.4, 6.4, 4).translateX(x));
  return [{ name: "plate", shape: plate }];
}
\`\`\`

## A boss with a pilot hole

\`\`\`js
export function main() {
  const floor = makeBaseBox(70, 50, 3);
  let body = floor;
  for (const [x, y] of [[-28, -18], [28, -18], [-28, 18], [28, 18]]) {
    const boss = makeCylinder(3.2, 6, [x, y, 3]);
    body = body.fuse(boss).cut(makeCylinder(1.35, 10, [x, y, 1]));
  }
  return [{ name: "floor", shape: body }];
}
\`\`\`

## A rib

\`\`\`js
export function main() {
  const wall = makeBaseBox(60, 4, 40);
  const rib = draw([0, 0]).hLine(18).lineTo([0, 26]).close().sketchOnPlane("YZ").extrude(3);
  return [{ name: "wall", shape: wall.fuse(rib.translate([-1.5, 2, 0])) }];
}
\`\`\`

## Two parts that fit

Keep a clearance. 0.2 mm is tight, 0.4 mm slides.

\`\`\`js
export function main() {
  const shell = makeBaseBox(40, 40, 20).shell(2, (f) => f.inPlane("XY", 20));
  const lid = makeBaseBox(35.6, 35.6, 3).translateZ(22);
  return [
    { name: "shell", shape: shell, color: "#9fb2c4" },
    { name: "lid", shape: lid, color: "#c7a98b" },
  ];
}
\`\`\`

# Round a profile in 2D, not in 3D

A 3D fillet on an extruded L profile often fails, because the rounded edges
meet at the inner corner. Round the profile with \`customCorner\` instead. It
is faster and it never fails on adjacency.

\`\`\`js
export function main() {
  const profile = draw([0, 0])
    .hLine(60)
    .vLine(6)
    .customCorner(3)
    .hLine(-48)
    .vLine(42)
    .customCorner(3)
    .hLine(-12)
    .close();
  let bracket = profile.sketchOnPlane("XZ", -20).extrude(40);
  for (const y of [-12, 12]) bracket = bracket.cut(makeCylinder(2.2, 30, [40, y, -5]));
  return [{ name: "bracket", shape: bracket }];
}
\`\`\`

# What fails

- A fillet radius larger than the material. Halve it and build again.
- \`StdFail_NotDone: BRep_API: command not done\` is the kernel refusing the
  operation. Reduce the radius, or select fewer edges, or round in 2D.
- A fillet with no filter on a shape that already has fillets.
- \`cut\` with a tool that only touches a face. Overlap the tool.
- A revolve whose profile crosses the axis.
- \`shell\` with a face filter that matches no face: nothing is removed.
`;
