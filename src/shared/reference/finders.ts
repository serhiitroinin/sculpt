export const FINDERS = `# Fillets, chamfers and edge finders

\`\`\`
solid.fillet(radius, (edgeFinder, shape) => edgeFinder)
solid.chamfer(size, (edgeFinder, shape) => edgeFinder)
solid.draft(angleDegrees, (faceFinder, shape) => faceFinder, neutralPlane?)
\`\`\`

Without a filter every edge is filleted. That often fails on a shape with
short edges, so select the edges you mean.

\`\`\`js
export function main() {
  const plate = makeBaseBox(80, 50, 10);
  const rounded = plate.fillet(6, (e) => e.inDirection("Z"));
  const eased = rounded.chamfer(1, (e) => e.inPlane("XY", 10));
  return [{ name: "plate", shape: eased }];
}
\`\`\`

The radius may also vary per edge. Return \`null\` to skip an edge:

\`\`\`js
export function main() {
  const plate = makeBaseBox(80, 50, 10);
  return [{ name: "plate", shape: plate.fillet((edge) => (edge.length > 40 ? 4 : null)) }];
}
\`\`\`

# EdgeFinder

\`\`\`
e.inDirection("Z" | "X" | "Y" | [x, y, z])   // the edge runs along it
e.inPlane("XY", height)                      // the edge lies in that plane
e.ofLength(number | (length) => boolean)
e.ofCurveType("LINE" | "CIRCLE" | "ELLIPSE" | "BSPLINE_CURVE" | ...)
e.parallelTo("XY" | "XZ" | "YZ" | plane | face)
e.inBox(corner1, corner2)
e.containsPoint([x, y, z])
e.atDistance(distance, point?)
e.atAngleWith(direction?, angleDegrees?)
e.inList([edge, ...])
\`\`\`

# FaceFinder

\`\`\`
f.inPlane("XY", height)
f.parallelTo("XY" | "XZ" | "YZ" | plane | face)
f.ofSurfaceType("PLANE" | "CYLINDRE" | "CONE" | "SPHERE" | "TORUS" | ...)
f.containsPoint([x, y, z])
f.inBox(corner1, corner2)
f.atAngleWith(direction?, angleDegrees?)
\`\`\`

The cylinder surface type is spelled \`"CYLINDRE"\`.

# Combining

\`\`\`
finder.and([(f) => f.inPlane("XY", 10), (f) => f.ofLength(30)])
finder.not((f) => f.inPlane("XY", 0))
finder.either([(f) => f.inPlane("XY", 0), (f) => f.inPlane("XY", 20)])
\`\`\`

\`\`\`js
export function main() {
  const block = makeBaseBox(60, 60, 20);
  const top = block.fillet(3, (e) => e.inPlane("XY", 20).not((f) => f.inDirection("X")));
  return [{ name: "block", shape: top }];
}
\`\`\`

# Choosing the point of a pin

A pin gives a world point, a normal and a surface hint. Turn it into a
selection with \`containsPoint\` or \`inBox\` around that point, and check the
face or edge count in the report to confirm the change landed.

\`\`\`js
export function main() {
  const block = makeBaseBox(60, 40, 16);
  return [{ name: "block", shape: block.fillet(3, (e) => e.containsPoint([30, 20, 8])) }];
}
\`\`\`
`;
