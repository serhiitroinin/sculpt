export const CONTRACT = `# The model script

One revision is one complete JavaScript module. Sculpt evaluates it from
scratch every time. There is no patching and no state between revisions.

Rules:

- Export a function called \`main\`. It returns an array of parts.
- A part is \`{ name, shape, color }\`. \`name\` is required and unique.
  \`color\` is a CSS hex string and is optional.
- Every shape must be a 3D shape (a solid, a shell or a compound).
- Units are millimetres. Z points up. The build plate is the XY plane.
- Do not write \`import\`. Every replicad export is a global. The whole
  namespace is also available as \`replicad\`.
- \`main\` may be \`async\`, but nothing in replicad needs \`await\`.

\`\`\`js
export function main() {
  const plate = makeBaseBox(60, 40, 8);
  const hole = makeCylinder(3, 40, [0, 0, -10]);
  return [{ name: "plate", shape: plate.cut(hole), color: "#9fb2c4" }];
}
\`\`\`

\`makeBaseBox(x, y, z)\` is centred on the Z axis and stands on Z = 0.
\`makeCylinder(radius, height, origin, direction)\` grows along +Z from its
origin, so a cutting cylinder should start below the part and be longer than
the material it crosses.

# Reading the report

After every build Sculpt returns a structural report: per part the volume,
the surface area, the face count, the edge count and the bounding box, plus
the overall bounding box. Trust those numbers over a picture. A fillet that
did not apply shows up as an unchanged face count.
`;
