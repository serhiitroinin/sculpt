import * as replicad from "replicad";
import type { ExportFormat } from "../../shared/cad.ts";
import type { BuiltPart } from "./build.ts";

const STL_OPTIONS = { binary: true, tolerance: 0.02, angularTolerance: 0.2 };

export async function exportParts(parts: BuiltPart[], format: ExportFormat): Promise<Uint8Array> {
  if (parts.length === 0) throw new Error("There is no model to export.");
  if (format === "step") {
    const blob = replicad.exportSTEP(
      parts.map((part) => ({ shape: part.shape, name: part.name, color: part.color })),
      { unit: "mm" },
    );
    return new Uint8Array(await blob.arrayBuffer());
  }
  const shape = parts.length === 1
    ? parts[0]!.shape
    : replicad.makeCompound(parts.map((part) => part.shape));
  return new Uint8Array(await shape.blobSTL(STL_OPTIONS).arrayBuffer());
}
