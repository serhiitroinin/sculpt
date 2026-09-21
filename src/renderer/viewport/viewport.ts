import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PartMesh } from "../../shared/cad.ts";
import type { RenderedView } from "../../shared/ipc.ts";
import type { Pin } from "../../shared/project.ts";
import {
  createBackdrop, createCamera, createLights, createRenderer, DARK, LIGHT, type Palette,
} from "./scene.ts";
import { createContactShadow, createGround, setGroundHeight } from "./ground.ts";
import { createDimensions } from "./dimensions.ts";
import { createParts, disposeParts, frameObjects, outsideFrame, type PartObject } from "./model.ts";
import { classifyFace } from "./surface-hint.ts";
import { OffscreenRenderer, type ViewSpec } from "./offscreen.ts";
import { drawPinnedView } from "./pin-overlay.ts";

export interface PinHit {
  point: [number, number, number];
  normal: [number, number, number];
  part: string;
  surface: string;
}

export type StandardView = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";

const DIRECTIONS: Record<StandardView, THREE.Vector3> = {
  iso: new THREE.Vector3(1, -1.25, 0.9),
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 0, 1),
  bottom: new THREE.Vector3(0, 0, -1),
};

const GROUND_EXTENT = 420;

export class Viewport {
  readonly scene = new THREE.Scene();
  readonly camera = createCamera();
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private ground: THREE.Group;
  private shadow: THREE.Mesh;
  private dimensions: THREE.Group | undefined;
  private showDimensions = false;
  private parts: PartObject[] = [];
  private lastMeshes: PartMesh[] = [];
  private modelRoot = new THREE.Group();
  private observer: ResizeObserver;
  private frame = 0;
  private palette: Palette = DARK;
  private offscreen: OffscreenRenderer | undefined;
  private listeners = new Set<() => void>();
  private fallback: ReturnType<typeof setTimeout> | undefined;

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement) {
    this.renderer = createRenderer(canvas);
    this.scene.background = createBackdrop(this.palette);
    for (const light of createLights()) this.scene.add(light);
    this.ground = createGround(this.palette, GROUND_EXTENT);
    this.shadow = createContactShadow(this.palette);
    this.scene.add(this.ground, this.shadow, this.modelRoot);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.9;
    this.controls.addEventListener("change", () => this.changed());

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  setTheme(theme: "dark" | "light"): void {
    this.palette = theme === "dark" ? DARK : LIGHT;
    this.scene.background = createBackdrop(this.palette);
    this.ground.removeFromParent();
    this.ground = createGround(this.palette, GROUND_EXTENT);
    this.shadow.removeFromParent();
    this.shadow = createContactShadow(this.palette);
    this.scene.add(this.ground, this.shadow);
    this.setModel(this.lastMeshes, true);
  }

  setModel(meshes: PartMesh[], keepCamera: boolean): void {
    const replacing = this.parts.length > 0 && meshes.length > 0;
    disposeParts(this.parts);
    this.lastMeshes = meshes;
    this.parts = createParts(meshes, this.palette);
    for (const part of this.parts) this.modelRoot.add(part.group);
    this.placeShadow();
    this.refreshDimensions();
    if (!keepCamera || outsideFrame(this.camera, this.modelRoot)) this.fit();
    if (replacing) this.crossFade();
    this.changed();
  }

  /** Edges first, then faces: the drawing appears before the material does. */
  private crossFade(): void {
    if (this.reduceMotion()) return;
    const edges = this.parts.map((part) => part.edges.material as THREE.Material);
    const faces = this.parts.map((part) => part.mesh.material as THREE.Material);
    for (const material of [...edges, ...faces]) {
      material.transparent = true;
      material.opacity = 0;
    }
    const started = performance.now();
    const step = (): void => {
      const elapsed = performance.now() - started;
      for (const material of edges) material.opacity = Math.min(elapsed / 120, 1) * 0.9;
      for (const material of faces) material.opacity = Math.max(0, Math.min((elapsed - 120) / 180, 1));
      this.requestRender();
      if (elapsed < 300) requestAnimationFrame(step);
      else for (const material of faces) material.transparent = false;
    };
    requestAnimationFrame(step);
  }

  private placeShadow(): void {
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    if (box.isEmpty()) {
      this.shadow.visible = false;
      setGroundHeight(this.ground, 0);
      return;
    }
    setGroundHeight(this.ground, Math.abs(box.min.z) < 0.5 ? 0 : box.min.z);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.shadow.visible = true;
    this.shadow.scale.set(Math.max(size.x, 1) * 2.2, Math.max(size.y, 1) * 2.2, 1);
    this.shadow.position.set(center.x, center.y, box.min.z + 0.05);
  }

  private refreshDimensions(): void {
    this.dimensions?.removeFromParent();
    this.dimensions = undefined;
    if (!this.showDimensions || this.parts.length === 0) return;
    this.dimensions = createDimensions(new THREE.Box3().setFromObject(this.modelRoot), this.palette);
    this.scene.add(this.dimensions);
  }

  toggleDimensions(): boolean {
    this.showDimensions = !this.showDimensions;
    this.refreshDimensions();
    this.changed();
    return this.showDimensions;
  }

  /** Hiding a part fades it rather than popping it out of the scene. */
  setVisibility(name: string, visible: boolean): void {
    const part = this.parts.find((entry) => entry.name === name);
    if (!part) return;
    if (this.reduceMotion()) {
      part.group.visible = visible;
      this.changed();
      return;
    }
    part.group.visible = true;
    const materials = [part.mesh.material, part.edges.material] as THREE.Material[];
    for (const material of materials) material.transparent = true;
    const from = materials[0]!.opacity;
    const to = visible ? 1 : 0;
    const started = performance.now();
    const step = (): void => {
      const ratio = Math.min((performance.now() - started) / 180, 1);
      for (const material of materials) material.opacity = from + (to - from) * ratio;
      this.requestRender();
      if (ratio < 1) requestAnimationFrame(step);
      else part.group.visible = visible;
    };
    requestAnimationFrame(step);
  }

  highlight(name: string | undefined): void {
    for (const part of this.parts) {
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      material.emissive.set(part.name === name ? 0x3a2606 : 0x000000);
      (part.edges.material as THREE.LineBasicMaterial).opacity = part.name === name ? 1 : 0.9;
    }
    this.changed();
  }

  fit(view?: StandardView, tween = true): void {
    const target = this.controls.target.clone();
    const position = this.camera.position.clone();
    const direction = view ? DIRECTIONS[view].clone() : undefined;
    frameObjects(this.camera, this.controls.target, [this.modelRoot], direction);
    if (!tween || this.reduceMotion()) {
      this.controls.update();
      this.changed();
      return;
    }
    const to = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.tween(to);
  }

  private reduceMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** Camera moves are read as motion of the bench, so they are tweened. */
  private tween(to: { position: THREE.Vector3; target: THREE.Vector3 }): void {
    const from = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    const started = performance.now();
    const step = (): void => {
      const ratio = Math.min((performance.now() - started) / 320, 1);
      const eased = 1 - (1 - ratio) ** 3;
      this.camera.position.lerpVectors(from.position, to.position, eased);
      this.controls.target.lerpVectors(from.target, to.target, eased);
      this.controls.update();
      this.changed();
      if (ratio < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Bring a pinned point into view without changing the distance. */
  lookAtPoint(point: [number, number, number]): void {
    const target = new THREE.Vector3(...point);
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.tween({ position: target.clone().add(offset), target });
  }

  isVisible(point: [number, number, number]): boolean {
    const screen = this.project(point);
    return !screen.behind
      && screen.x > 0 && screen.x < this.host.clientWidth
      && screen.y > 0 && screen.y < this.host.clientHeight;
  }

  /** Keep the previous model on screen, dimmed, while a new one builds. */
  setRebuilding(active: boolean): void {
    for (const part of this.parts) {
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      material.transparent = active;
      material.opacity = active ? 0.55 : 1;
    }
    this.changed();
  }

  pick(clientX: number, clientY: number): PinHit | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const meshes = this.parts.filter((part) => part.group.visible).map((part) => part.mesh);
    const [hit] = raycaster.intersectObjects(meshes, false);
    if (!hit || typeof hit.faceIndex !== "number" || !hit.face) return undefined;
    const part = this.parts.find((entry) => entry.mesh === hit.object);
    if (!part) return undefined;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    const round = (value: number): number => Math.round(value * 100) / 100;
    return {
      point: [round(hit.point.x), round(hit.point.y), round(hit.point.z)],
      normal: [round(normal.x), round(normal.y), round(normal.z)],
      part: part.name,
      surface: classifyFace(part, hit.faceIndex),
    };
  }

  project(point: [number, number, number]): { x: number; y: number; behind: boolean } {
    const vector = new THREE.Vector3(...point);
    const distance = vector.distanceTo(this.camera.position);
    const projected = vector.clone().project(this.camera);
    return {
      x: (projected.x * 0.5 + 0.5) * this.host.clientWidth,
      y: (-projected.y * 0.5 + 0.5) * this.host.clientHeight,
      behind: projected.z > 1 || this.occluded(vector, distance),
    };
  }

  private occluded(point: THREE.Vector3, distance: number): boolean {
    const raycaster = new THREE.Raycaster();
    raycaster.set(this.camera.position, point.clone().sub(this.camera.position).normalize());
    const meshes = this.parts.filter((part) => part.group.visible).map((part) => part.mesh);
    const [hit] = raycaster.intersectObjects(meshes, false);
    return hit !== undefined && hit.distance < distance - 0.3;
  }

  cameraPose(): { position: [number, number, number]; target: [number, number, number] } {
    return {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
    };
  }

  /** The bench pool would blow out a small tile, so a tool render drops it. */
  renderViews(views: ViewSpec[], size: number, plain = false): RenderedView[] {
    this.offscreen ??= new OffscreenRenderer();
    const current = this.camera.position.clone().sub(this.controls.target);
    const shadow = this.shadow.visible;
    const ground = this.ground.visible;
    this.shadow.visible = false;
    if (plain) this.ground.visible = false;
    // A build is rendered while its cross-fade still runs; the picture must not be.
    const fading = this.parts.filter((part) => part.group.visible).flatMap((part) => [
      { material: part.mesh.material as THREE.Material, solid: 1 },
      { material: part.edges.material as THREE.Material, solid: 0.9 },
    ]).map((entry) => ({ ...entry, opacity: entry.material.opacity }));
    for (const entry of fading) entry.material.opacity = entry.solid;
    try {
      return views.map((view) =>
        this.offscreen!.render(this.scene, this.modelRoot, view, size, current, this.palette, plain));
    } finally {
      for (const { material, opacity } of fading) material.opacity = opacity;
      this.shadow.visible = shadow;
      this.ground.visible = ground;
    }
  }

  hasModel(): boolean {
    return this.parts.length > 0;
  }

  snapshot(pins: Pin[]): string {
    this.renderer.render(this.scene, this.camera);
    return drawPinnedView(
      this.canvas,
      pins,
      (point) => this.project(point),
      this.host.clientWidth,
      this.host.clientHeight,
    );
  }

  onCameraChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
    this.requestRender();
  }

  /** A hidden window never runs an animation frame, so a timer also paints. */
  requestRender(): void {
    if (this.frame !== 0) return;
    this.frame = requestAnimationFrame(() => this.paint());
    this.fallback = setTimeout(() => this.paint(), 150);
  }

  private paint(): void {
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    if (this.fallback !== undefined) clearTimeout(this.fallback);
    this.frame = 0;
    this.fallback = undefined;
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.changed();
  }

  dispose(): void {
    this.observer.disconnect();
    this.controls.dispose();
    this.offscreen?.dispose();
    disposeParts(this.parts);
    this.renderer.dispose();
  }
}

export { LIGHT, DARK };
