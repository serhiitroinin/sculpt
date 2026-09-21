import * as THREE from "three";

export interface Palette {
  backdropTop: string;
  backdropBottom: string;
  clay: string;
  edge: string;
  grid: string;
  dim: string;
  text: string;
  panel: string;
  gridStrength: number;
}

export const DARK: Palette = {
  backdropTop: "#1b2128",
  backdropBottom: "#0b0e11",
  clay: "#c9c3b8",
  edge: "#1a1e23",
  grid: "#4a5663",
  dim: "#6fc3ff",
  text: "#d9e0e7",
  panel: "#13171b",
  gridStrength: 1,
};

export const LIGHT: Palette = {
  backdropTop: "#f3f5f6",
  backdropBottom: "#e4e8eb",
  clay: "#d6cfc2",
  edge: "#2b3138",
  grid: "#d3d8dd",
  dim: "#0b6fb8",
  text: "#161a1e",
  panel: "#f5f6f7",
  gridStrength: 0.5,
};

export function createRenderer(canvas: HTMLCanvasElement, alpha = false): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100_000);
  camera.up.set(0, 0, 1);
  camera.position.set(150, -210, 140);
  return camera;
}

/** A studio backdrop, the one gradient the design allows. */
export function createBackdrop(palette: Palette): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("the backdrop canvas has no 2d context");
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, palette.backdropTop);
  gradient.addColorStop(1, palette.backdropBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLights(): THREE.Object3D[] {
  const key = new THREE.DirectionalLight(0xfff6e8, 2.4);
  key.position.set(1, -1.3, 1.7);
  const fill = new THREE.DirectionalLight(0xdce7f4, 1.0);
  fill.position.set(-1.7, 0.5, 0.6);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(0.1, 1.8, -0.5);
  const ambient = new THREE.HemisphereLight(0xd8e3ef, 0x2c3238, 0.9);
  return [key, fill, rim, ambient];
}

/** Part colours are pulled toward clay so the model reads as one material study. */
export function partMaterial(color: string, palette: Palette): THREE.MeshStandardMaterial {
  const clay = new THREE.Color(palette.clay);
  const tint = new THREE.Color(color).lerp(clay, 0.72);
  return new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.75,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 1,
    side: THREE.DoubleSide,
  });
}

export function edgeMaterial(palette: Palette): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color: new THREE.Color(palette.edge), transparent: true, opacity: 0.9 });
}
