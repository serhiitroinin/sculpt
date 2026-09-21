import * as THREE from "three";
import type { RenderedView, ViewName } from "../../shared/ipc.ts";
import { createCamera, createRenderer, type Palette } from "./scene.ts";
import { frameObjects } from "./model.ts";

export type ViewSpec = ViewName | { azimuth: number; elevation: number };

const NAMED: Record<Exclude<ViewName, "current">, THREE.Vector3> = {
  iso: new THREE.Vector3(1, -1.25, 0.9),
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 0, 1),
  bottom: new THREE.Vector3(0, 0, -1),
};

export function directionFor(view: ViewSpec, current: THREE.Vector3): THREE.Vector3 {
  if (view === "current") return current.clone();
  if (typeof view === "string") return NAMED[view].clone();
  const azimuth = (view.azimuth * Math.PI) / 180;
  const elevation = (view.elevation * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
  );
}

export function labelFor(view: ViewSpec): string {
  return typeof view === "string" ? view : `azimuth ${view.azimuth}°, elevation ${view.elevation}°`;
}

/** A second renderer so a tool render never disturbs the user's viewport. */
export class OffscreenRenderer {
  private canvas = document.createElement("canvas");
  private renderer = createRenderer(this.canvas, true);
  private camera = createCamera();

  render(
    scene: THREE.Scene,
    model: THREE.Object3D,
    view: ViewSpec,
    size: number,
    current: THREE.Vector3,
    palette: Palette,
    plain = false,
  ): RenderedView {
    this.canvas.width = size;
    this.canvas.height = size;
    this.renderer.setSize(size, size, false);
    this.camera.aspect = 1;
    frameObjects(this.camera, new THREE.Vector3(), [model], directionFor(view, current));
    this.camera.lookAt(boxCenter(model));
    const background = scene.background;
    // A thumbnail outlives the theme it was rendered in, so it carries no
    // backdrop: the tile behind it is CSS and follows the theme.
    if (plain) scene.background = null;
    this.renderer.setClearColor(0x000000, plain ? 0 : 1);
    this.renderer.render(scene, this.camera);
    if (plain) scene.background = background;
    if (plain) return { label: labelFor(view), data: this.canvas.toDataURL("image/png").split(",")[1] ?? "" };
    return {
      label: labelFor(view),
      data: annotate(this.canvas, model, labelFor(view), palette).split(",")[1] ?? "",
    };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

function boxCenter(model: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
}

function annotate(source: HTMLCanvasElement, model: THREE.Object3D, label: string, palette: Palette): string {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("the annotation canvas has no 2d context");
  context.drawImage(source, 0, 0);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  const scale = source.width / 640;
  context.font = `500 ${Math.round(14 * scale)}px "IBM Plex Mono", ui-monospace, monospace`;
  context.fillStyle = palette.text;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(label, 12 * scale, 10 * scale);
  context.fillText(
    `${round(size.x)} × ${round(size.y)} × ${round(size.z)} mm`,
    12 * scale,
    30 * scale,
  );
  drawTriad(context, source.width, source.height, scale);
  return canvas.toDataURL("image/png");
}

function round(value: number): string {
  return `${Math.round(value * 10) / 10}`;
}

function drawTriad(context: CanvasRenderingContext2D, width: number, height: number, scale: number): void {
  const originX = width - 58 * scale;
  const originY = height - 40 * scale;
  const arm = 26 * scale;
  const axes: [string, number, number, string][] = [
    ["X", arm, arm * 0.45, "#e5484d"],
    ["Y", arm * 0.95, -arm * 0.4, "#46a758"],
    ["Z", 0, -arm, "#3e63dd"],
  ];
  context.lineWidth = 2 * scale;
  for (const [name, dx, dy, color] of axes) {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(originX, originY);
    context.lineTo(originX + dx, originY + dy);
    context.stroke();
    context.fillText(name, originX + dx * 1.15, originY + dy * 1.15 - 6 * scale);
  }
}
