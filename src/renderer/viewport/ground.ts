import * as THREE from "three";
import type { Palette } from "./scene.ts";

const VERTEX = `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = `
uniform vec3 uColor;
uniform float uFade;
uniform vec2 uCenter;
uniform float uStrength;
varying vec3 vWorld;

float line(vec2 position, float spacing, float width) {
  vec2 grid = abs(fract(position / spacing - 0.5) - 0.5) / fwidth(position / spacing);
  return 1.0 - min(min(grid.x, grid.y) / width, 1.0);
}

void main() {
  float minor = line(vWorld.xy, 10.0, 1.0) * 0.45;
  float major = line(vWorld.xy, 50.0, 1.4) * 1.0;
  float strength = max(minor, major);
  float distance = length(vWorld.xy - uCenter);
  strength *= 1.0 - smoothstep(uFade * 0.35, uFade * 0.95, distance);
  if (strength < 0.002) discard;
  gl_FragColor = vec4(uColor, strength * uStrength);
}`;

/** A shader floor so 10 mm and 50 mm lines fade with distance instead of tiling forever. */
export function createGround(palette: Palette, extent: number): THREE.Group {
  const group = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(extent * 2, extent * 2),
    new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(palette.grid) },
        uFade: { value: extent },
        uCenter: { value: new THREE.Vector2() },
        uStrength: { value: palette.gridStrength },
      },
    }),
  );
  plane.renderOrder = -1;
  plane.name = "ground";
  group.add(plane);
  group.add(axis(new THREE.Vector3(1, 0, 0), 0xe5484d, extent, palette));
  group.add(axis(new THREE.Vector3(0, 1, 0), 0x46a758, extent, palette));
  group.add(axis(new THREE.Vector3(0, 0, 1), 0x3e63dd, extent * 0.4, palette));
  return group;
}

/** The bench follows the model so a part never floats; the axes keep the datum. */
export function setGroundHeight(ground: THREE.Group, z: number): void {
  const plane = ground.children.find((child) => child.name === "ground");
  if (plane) plane.position.z = z;
}

function axis(direction: THREE.Vector3, color: number, length: number, palette: Palette): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    direction.clone().multiplyScalar(length),
  ]);
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 * palette.gridStrength, depthWrite: false }),
  );
}

/**
 * A dark shadow cannot read on a near-black bench, so the dark theme uses a
 * tight contact core inside a faint pool of light instead.
 */
export function createContactShadow(palette: Palette): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("the shadow canvas has no 2d context");
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
  if (palette.gridStrength < 1) {
    gradient.addColorStop(0, "rgba(0,0,0,0.72)");
    gradient.addColorStop(0.5, "rgba(0,0,0,0.30)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    gradient.addColorStop(0, "rgba(0,0,0,0.85)");
    gradient.addColorStop(0.24, "rgba(0,0,0,0.35)");
    gradient.addColorStop(0.44, "rgba(214,226,240,0.14)");
    gradient.addColorStop(1, "rgba(214,226,240,0)");
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      opacity: palette.gridStrength < 1 ? 0.45 : 1,
    }),
  );
  mesh.renderOrder = -2;
  mesh.visible = false;
  return mesh;
}
