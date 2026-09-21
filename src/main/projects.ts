import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ModelReport } from "../shared/cad.ts";
import type {
  EngineChoice, Pin, ProjectState, ProjectSummary, ReferenceImage, Revision, TranscriptEntry,
} from "../shared/project.ts";

interface StoredProject {
  summary: ProjectSummary;
  engine?: EngineChoice;
  revisions: Revision[];
  currentRevision?: number;
  images: ReferenceImage[];
  transcript: TranscriptEntry[];
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class ProjectStore {
  constructor(private root: string) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
  }

  private dir(id: string): string {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error(`invalid project id: ${id}`);
    return join(this.root, id);
  }

  private file(id: string): string {
    return join(this.dir(id), "project.json");
  }

  private read(id: string): StoredProject {
    const raw = readFileSync(this.file(id), "utf8");
    return JSON.parse(raw) as StoredProject;
  }

  private write(project: StoredProject): void {
    project.summary.updatedAt = new Date().toISOString();
    writeFileSync(this.file(project.summary.id), JSON.stringify(project, null, 2), { mode: 0o600 });
  }

  harnessDirectory(id: string): string {
    const directory = join(this.dir(id), "harness");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    return directory;
  }

  list(): ProjectSummary[] {
    if (!existsSync(this.root)) return [];
    return readdirSync(this.root)
      .filter((entry) => existsSync(join(this.root, entry, "project.json")))
      .map((entry) => this.read(entry).summary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  create(name: string): ProjectState {
    const id = randomUUID();
    for (const folder of ["revisions", "images", "renders"]) {
      mkdirSync(join(this.root, id, folder), { recursive: true, mode: 0o700 });
    }
    const now = new Date().toISOString();
    const project: StoredProject = {
      summary: { id, name, createdAt: now, updatedAt: now },
      revisions: [],
      images: [],
      transcript: [],
    };
    this.write(project);
    return this.state(id);
  }

  rename(id: string, name: string): ProjectState {
    const project = this.read(id);
    project.summary.name = name;
    this.write(project);
    return this.state(id);
  }

  setEngine(id: string, engine: EngineChoice): void {
    const project = this.read(id);
    project.engine = engine;
    this.write(project);
  }

  state(id: string): ProjectState {
    const project = this.read(id);
    const current = project.currentRevision;
    return {
      summary: project.summary,
      engine: project.engine,
      revisions: project.revisions,
      currentRevision: current,
      source: current === undefined ? undefined : this.source(id, current),
      images: project.images,
      transcript: project.transcript,
    };
  }

  source(id: string, revision: number): string {
    return readFileSync(join(this.dir(id), "revisions", `${revision}.js`), "utf8");
  }

  addRevision(
    id: string,
    source: string,
    note: string,
    report: ModelReport,
    thumbnail?: string,
  ): Revision {
    const project = this.read(id);
    const number = (project.revisions.at(-1)?.number ?? 0) + 1;
    writeFileSync(join(this.dir(id), "revisions", `${number}.js`), source, { mode: 0o600 });
    if (thumbnail) {
      writeFileSync(join(this.dir(id), "revisions", `${number}.png`), Buffer.from(thumbnail, "base64"), {
        mode: 0o600,
      });
    }
    const revision: Revision = {
      number,
      note,
      createdAt: new Date().toISOString(),
      report,
      ...(thumbnail ? { thumbnail: true } : {}),
    };
    project.revisions.push(revision);
    project.currentRevision = number;
    this.write(project);
    return revision;
  }

  selectRevision(id: string, number: number): string {
    const project = this.read(id);
    if (!project.revisions.some((revision) => revision.number === number)) {
      throw new Error(`project ${id} has no revision ${number}`);
    }
    project.currentRevision = number;
    this.write(project);
    return this.source(id, number);
  }

  addImage(id: string, name: string, mediaType: string, data: string): ReferenceImage {
    const extension = EXTENSIONS[mediaType];
    if (!extension) throw new Error(`unsupported image type: ${mediaType}`);
    const project = this.read(id);
    const imageId = randomUUID();
    writeFileSync(join(this.dir(id), "images", `${imageId}.${extension}`), Buffer.from(data, "base64"), {
      mode: 0o600,
    });
    const image: ReferenceImage = { id: imageId, name, mediaType, addedAt: new Date().toISOString() };
    project.images.push(image);
    this.write(project);
    return image;
  }

  imageBytes(id: string, imageId: string): { mediaType: string; data: Buffer } {
    const project = this.read(id);
    const image = project.images.find((entry) => entry.id === imageId);
    if (!image) throw new Error(`project ${id} has no image ${imageId}`);
    const extension = EXTENSIONS[image.mediaType];
    return {
      mediaType: image.mediaType,
      data: readFileSync(join(this.dir(id), "images", `${imageId}.${extension}`)),
    };
  }

  markImageSeen(id: string, imageId: string): void {
    const project = this.read(id);
    const image = project.images.find((entry) => entry.id === imageId);
    if (!image || image.seenAt) return;
    image.seenAt = new Date().toISOString();
    this.write(project);
  }

  removeImage(id: string, imageId: string): void {
    const project = this.read(id);
    const image = project.images.find((entry) => entry.id === imageId);
    if (!image) return;
    rmSync(join(this.dir(id), "images", `${imageId}.${EXTENSIONS[image.mediaType]}`), { force: true });
    project.images = project.images.filter((entry) => entry.id !== imageId);
    this.write(project);
  }

  append(id: string, entry: TranscriptEntry): void {
    const project = this.read(id);
    project.transcript.push(entry);
    this.write(project);
  }

  updateActivity(id: string, entryId: string, patch: Partial<TranscriptEntry & { kind: "activity" }>): void {
    const project = this.read(id);
    const entry = project.transcript.find((item) => item.id === entryId);
    if (!entry || entry.kind !== "activity") return;
    Object.assign(entry, patch);
    this.write(project);
  }

  /** The image an agent tool produced, kept so the user can see what it saw. */
  saveRender(id: string, renderId: string, base64: string): string {
    writeFileSync(join(this.dir(id), "renders", `${renderId}.png`), Buffer.from(base64, "base64"), {
      mode: 0o600,
    });
    return renderId;
  }

  asset(id: string, kind: "render" | "revision" | "image", name: string): { mediaType: string; data: Buffer } {
    if (!/^[\w.-]+$/.test(name)) throw new Error(`invalid asset name: ${name}`);
    if (kind === "image") return this.imageBytes(id, name);
    const folder = kind === "render" ? "renders" : "revisions";
    return { mediaType: "image/png", data: readFileSync(join(this.dir(id), folder, `${name}.png`)) };
  }

  lastPins(id: string): Pin[] {
    const project = this.read(id);
    for (let index = project.transcript.length - 1; index >= 0; index -= 1) {
      const entry = project.transcript[index];
      if (entry?.kind === "user") return entry.pins;
    }
    return [];
  }
}
