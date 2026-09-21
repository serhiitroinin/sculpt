export const SOLIDS = `# From a sketch to a solid

\`\`\`
sketch.extrude(distance, { extrusionDirection?, extrusionProfile?, twistAngle?, origin? })
sketch.revolve(axis?, { origin?, angle? })       // axis defaults to Z, angle in degrees
sketch.loftWith(otherSketch | [sketches], { ruled?, startPoint?, endPoint? })
sketch.sweepSketch((plane, origin) => profileSketch, { frenet?, transitionMode? })
\`\`\`

\`extrusionProfile\` is \`{ profile: "s-curve" | "linear", endFactor: number }\`
and tapers the extrusion. \`twistAngle\` is in degrees.

\`\`\`js
export function main() {
  const body = drawRoundedRectangle(50, 30, 5).sketchOnPlane("XY").extrude(20, {
    extrusionProfile: { profile: "linear", endFactor: 0.6 },
  });
  return [{ name: "taper", shape: body }];
}
\`\`\`

A revolve turns a profile around an axis. Keep the profile on one side of
the axis or the kernel fails.

\`\`\`js
export function main() {
  const profile = draw([10, 0])
    .hLine(14)
    .vLine(4)
    .hLine(-6)
    .vLine(26)
    .hLine(-8)
    .close();
  return [{ name: "knob", shape: profile.sketchOnPlane("XZ").revolve() }];
}
\`\`\`

A loft joins profiles at different heights.

\`\`\`js
export function main() {
  const bottom = drawRoundedRectangle(60, 40, 8).sketchOnPlane("XY");
  const top = drawCircle(12).sketchOnPlane("XY", 45);
  return [{ name: "funnel", shape: bottom.loftWith(top, { ruled: false }) }];
}
\`\`\`

# Booleans

\`\`\`
solid.fuse(other)        // union
solid.cut(tool)          // subtract
solid.intersect(tool)    // common volume
\`\`\`

Each one returns a new shape. Chain them, or reassign:

\`\`\`js
export function main() {
  const block = makeBaseBox(70, 40, 25);
  const pocket = makeBaseBox(56, 26, 20).translateZ(8);
  const bore = makeCylinder(6, 60, [0, 0, -10]);
  return [{ name: "housing", shape: block.cut(pocket).cut(bore) }];
}
\`\`\`

# Hollowing

\`shell\` removes one or more faces and gives the rest a thickness. A positive
thickness keeps the outside size and grows inwards, which is what an enclosure
wants. A negative thickness grows outwards.

\`\`\`js
export function main() {
  const box = makeBaseBox(80, 60, 30);
  const open = box.shell(2, (f) => f.inPlane("XY", 30));
  return [{ name: "case", shape: open }];
}
\`\`\`
`;
