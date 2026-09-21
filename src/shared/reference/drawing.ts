export const DRAWING = `# Drawing a 2D profile

A drawing is a closed 2D outline. Put it on a plane to get a sketch, then
give the sketch depth.

\`\`\`
drawRectangle(width, height, radius?)        // same function as drawRoundedRectangle
drawRoundedRectangle(width, height, radius?) // radius: number or { rx, ry }
drawCircle(radius)
drawEllipse(majorRadius, minorRadius)
drawPolysides(radius, sidesCount, sagitta?)  // regular polygon
draw(startPoint?)                            // a pen, see below
\`\`\`

Drawings combine in 2D and return new drawings:

\`\`\`
drawing.cut(other)   drawing.fuse(other)   drawing.intersect(other)
drawing.offset(distance)      // positive grows, negative shrinks
drawing.fillet(radius)        drawing.chamfer(radius)
drawing.translate(x, y)       drawing.rotate(angle, center?)
drawing.mirror(centerOrDirection, origin?, mode?)
\`\`\`

# The pen

\`draw([x, y])\` starts a pen. Every method returns the pen. Close it with
\`close()\`, \`closeWithMirror()\` or \`done()\`.

\`\`\`
hLine(dx)   vLine(dy)   line(dx, dy)   lineTo([x, y])
hLineTo(x)  vLineTo(y)  polarLine(distance, angleDegrees)
tangentArc(dx, dy)          tangentArcTo([x, y])
sagittaArc(dx, dy, sagitta) sagittaArcTo([x, y], sagitta)
threePointsArc(dx, dy, viaDx, viaDy)
bulgeArc(dx, dy, bulge)
smoothSplineTo([x, y], config?)
customCorner(radius, mode?)   // "fillet" (default), "chamfer" or "dogbone"
\`\`\`

\`\`\`js
export function main() {
  const profile = draw([0, 0])
    .hLine(40)
    .vLine(6)
    .customCorner(2)
    .hLine(-30)
    .vLine(24)
    .customCorner(2)
    .hLine(-10)
    .close();
  const hook = profile.sketchOnPlane("XZ").extrude(18);
  return [{ name: "hook", shape: hook }];
}
\`\`\`

# Putting a drawing on a plane

\`\`\`
drawing.sketchOnPlane(planeName, origin?)  // "XY" "XZ" "YZ" "front" "top" ...
drawing.sketchOnFace(face, "original" | "bounds" | "native")
\`\`\`

\`origin\` may be a number. On \`"XY"\` that number is the Z height, which is
the quickest way to build a profile at a height.

\`\`\`js
export function main() {
  const base = drawRoundedRectangle(60, 40, 6).sketchOnPlane("XY").extrude(4);
  const boss = drawCircle(9).sketchOnPlane("XY", 4).extrude(10);
  return [{ name: "bracket", shape: base.fuse(boss) }];
}
\`\`\`
`;
