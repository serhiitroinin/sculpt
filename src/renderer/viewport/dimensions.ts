import * as THREE from "three";
import type { Palette } from "./scene.ts";

function label(value: number, palette: Palette): THREE.Sprite {
  const text = `${Math.round(value * 10) / 10} mm`;
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = 150 * scale;
  canvas.height = 36 * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("the dimension label canvas has no 2d context");
  context.scale(scale, scale);
  context.fillStyle = palette.panel;
  context.fillRect(0, 0, 150, 36);
  context.strokeStyle = palette.grid;
  context.strokeRect(0.5, 0.5, 149, 35);
  context.fillStyle = palette.dim;
  context.font = "500 20px 'IBM Plex Mono', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 75, 19);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.renderOrder = 10;
  return sprite;
}

function segments(points: THREE.Vector3[], palette: Palette): THREE.LineSegments {
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: new THREE.Color(palette.dim), transparent: true, opacity: 0.8, depthTest: false }),
  );
}

/** Real dimension lines with tick ends, the way a drawing states a size. */
export function createDimensions(box: THREE.Box3, palette: Palette): THREE.Group {
  const group = new THREE.Group();
  if (box.isEmpty()) return group;
  const size = box.getSize(new THREE.Vector3());
  const gap = Math.max(size.length() * 0.06, 4);
  const tick = gap * 0.35;
  const points: THREE.Vector3[] = [];

  const add = (
    from: THREE.Vector3,
    to: THREE.Vector3,
    tickDirection: THREE.Vector3,
    value: number,
  ): void => {
    points.push(from.clone(), to.clone());
    for (const end of [from, to]) {
      points.push(
        end.clone().addScaledVector(tickDirection, -tick / 2),
        end.clone().addScaledVector(tickDirection, tick / 2),
      );
    }
    const sprite = label(value, palette);
    sprite.position.copy(from.clone().add(to).multiplyScalar(0.5)).addScaledVector(tickDirection, tick * 1.6);
    sprite.scale.set(gap * 3.4, gap * 0.82, 1);
    group.add(sprite);
  };

  const y = box.min.y - gap;
  const z = box.min.z;
  add(
    new THREE.Vector3(box.min.x, y, z),
    new THREE.Vector3(box.max.x, y, z),
    new THREE.Vector3(0, -1, 0),
    size.x,
  );
  const x = box.max.x + gap;
  add(
    new THREE.Vector3(x, box.min.y, z),
    new THREE.Vector3(x, box.max.y, z),
    new THREE.Vector3(1, 0, 0),
    size.y,
  );
  add(
    new THREE.Vector3(x, box.max.y + gap, box.min.z),
    new THREE.Vector3(x, box.max.y + gap, box.max.z),
    new THREE.Vector3(1, 0, 0),
    size.z,
  );

  group.add(segments(points, palette));
  return group;
}
