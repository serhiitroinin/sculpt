export const PRIMITIVES = `# Primitives and transforms

\`\`\`
makeBaseBox(xLength, yLength, zLength)   // centred in X and Y, sits on Z = 0
makeBox(corner1, corner2)                // two opposite corners
makeCylinder(radius, height, origin?, direction?)
makeSphere(radius)
makeEllipsoid(aLength, bLength, cLength)
makeCompound([shape, ...])
\`\`\`

A point is \`[x, y, z]\`. A direction is a point or one of
\`"X" "Y" "Z" "-X" "-Y" "-Z"\`.

Transforms return a NEW shape and never change the receiver:

\`\`\`
shape.translate(x, y, z)      shape.translate([x, y, z])
shape.translateX(d)           shape.translateY(d)      shape.translateZ(d)
shape.rotate(angleDegrees, origin?, direction?)
shape.mirror(planeOrDirection?, origin?)
shape.scale(factor, center?)
shape.clone()
\`\`\`

\`\`\`js
export function main() {
  const post = makeCylinder(4, 30);
  const base = makeBaseBox(40, 40, 6);
  const tilted = makeBaseBox(20, 10, 4).rotate(30, [0, 0, 0], "X").translateZ(36);
  return [
    { name: "base", shape: base.fuse(post) },
    { name: "flag", shape: tilted, color: "#c7a98b" },
  ];
}
\`\`\`

# Repetition

There is no pattern function. Build an array and fuse it.

\`\`\`js
export function main() {
  let plate = makeBaseBox(90, 30, 6);
  for (let i = 0; i < 4; i += 1) {
    const hole = makeCylinder(2.5, 20, [-33 + i * 22, 0, -5]);
    plate = plate.cut(hole);
  }
  return [{ name: "rail", shape: plate }];
}
\`\`\`

For a circular pattern rotate a clone around the Z axis:

\`\`\`js
export function main() {
  let hub = makeCylinder(30, 8);
  for (let i = 0; i < 6; i += 1) {
    const hole = makeCylinder(3, 20, [20, 0, -5]).rotate(i * 60, [0, 0, 0], "Z");
    hub = hub.cut(hole);
  }
  return [{ name: "hub", shape: hub }];
}
\`\`\`
`;
