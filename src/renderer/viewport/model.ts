import * as THREE from "three";
import type { PartMesh } from "../../shared/cad.ts";
import { edgeMaterial, partMaterial, type Palette } from "./scene.ts";

export interface PartObject {
  name: string;
  color: string;
  group: THREE.Group;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  faceGroups: PartMesh["faceGroups"];
  normals: Float32Array;
  triangles: Uint32Array;
}

export function createParts(meshes: PartMesh[], palette: Palette): PartObject[] {
  return meshes.map((part) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(part.vertices, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(part.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(part.triangles, 1));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, partMaterial(part.color, palette));
    mesh.name = part.name;

    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.BufferAttribute(part.edges, 3));
    const edges = new THREE.LineSegments(lines, edgeMaterial(palette));

    const group = new THREE.Group();
    group.name = part.name;
    group.add(mesh, edges);
    return {
      name: part.name,
      color: part.color,
      group,
      mesh,
      edges,
      faceGroups: part.faceGroups,
      normals: part.normals,
      triangles: part.triangles,
    };
  });
}

export function disposeParts(parts: PartObject[]): void {
  for (const part of parts) {
    part.mesh.geometry.dispose();
    (part.mesh.material as THREE.Material).dispose();
    part.edges.geometry.dispose();
    (part.edges.material as THREE.Material).dispose();
    part.group.removeFromParent();
  }
}

export function frameObjects(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  objects: THREE.Object3D[],
  direction?: THREE.Vector3,
): void {
  const box = new THREE.Box3();
  for (const object of objects) box.expandByObject(object);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const distance = (radius * 1.45) / Math.sin((camera.fov * Math.PI) / 360);
  const offset = (direction ?? camera.position.clone().sub(target)).normalize().multiplyScalar(distance);
  target.copy(center);
  camera.position.copy(center).add(offset);
  camera.near = Math.max(distance / 2000, 0.05);
  camera.far = distance * 60;
  camera.updateProjectionMatrix();
}

/** True when the model no longer fits the frame, which is the only reason to re-frame. */
export function outsideFrame(camera: THREE.PerspectiveCamera, model: THREE.Object3D): boolean {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return false;
  camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
  return !frustum.intersectsBox(box);
}
