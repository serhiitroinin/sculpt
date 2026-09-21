import type { BuildFailure, ModelReport } from "../../shared/cad.ts";
import { plural } from "../../shared/plural.ts";

const mm = (value: number): string => `${Math.round(value * 100) / 100}`;

export function reportText(report: ModelReport, revision: number): string {
  const lines = [
    `Revision ${revision} built. Units: mm.`,
    `Overall ${mm(report.boundingBox.size[0])} x ${mm(report.boundingBox.size[1])} x ${mm(report.boundingBox.size[2])} mm,`
      + ` from [${report.boundingBox.min.map(mm).join(", ")}] to [${report.boundingBox.max.map(mm).join(", ")}].`,
    "",
  ];
  for (const part of report.parts) {
    lines.push(
      `${part.name}: ${mm(part.boundingBox.size[0])} x ${mm(part.boundingBox.size[1])} x ${mm(part.boundingBox.size[2])} mm`
        + ` at [${part.boundingBox.center.map(mm).join(", ")}], volume ${mm(part.volume / 1000)} cm3,`
        + ` area ${mm(part.surfaceArea / 100)} cm2, ${plural(part.faceCount, "face")}, ${plural(part.edgeCount, "edge")}.`,
    );
  }
  return lines.join("\n");
}

export function failureText(failure: BuildFailure): string {
  const lines = [`The build failed (${failure.phase}): ${failure.message}`];
  if (failure.line !== undefined) {
    lines.push(`Line ${failure.line}${failure.column === undefined ? "" : `, column ${failure.column}`}.`);
  }
  if (failure.sourceLine !== undefined) lines.push(`> ${failure.sourceLine}`);
  if (failure.message.includes("BRep_API: command not done")) {
    lines.push(
      "The kernel refused the operation. Common causes: a fillet or chamfer that is larger than the material"
      + " or that meets another rounded edge, a boolean whose tool only touches a face, and a revolve whose"
      + " profile crosses the axis. Round a profile with customCorner in 2D before you extrude it.",
    );
  }
  lines.push("Fix the script and call set_model again with the whole module.");
  return lines.join("\n");
}
