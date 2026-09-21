import type { Pin } from "../../shared/project.ts";

export const BALLOON_RADIUS = 13;
export const LEADER = { dx: 30, dy: -30 };

export interface Projected {
  x: number;
  y: number;
  behind: boolean;
}

export function balloonAnchor(point: Projected): { x: number; y: number } {
  return { x: point.x + LEADER.dx, y: point.y + LEADER.dy };
}

/** The agent must see the balloons the user sees, so they are burnt into the view. */
export function drawPinnedView(
  source: HTMLCanvasElement,
  pins: Pin[],
  project: (point: [number, number, number]) => Projected,
  cssWidth: number,
  cssHeight: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("the pin overlay canvas has no 2d context");
  context.drawImage(source, 0, 0);

  const scale = Math.min(source.width / cssWidth, source.height / cssHeight);
  const radius = BALLOON_RADIUS * scale;
  context.font = `600 ${Math.round(radius * 1.1)}px "IBM Plex Mono", ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const pin of pins) {
    const screen = project(pin.point);
    const alpha = screen.behind ? 0.4 : 1;
    const x = screen.x * (source.width / cssWidth);
    const y = screen.y * (source.height / cssHeight);
    const anchor = { x: x + LEADER.dx * scale, y: y + LEADER.dy * scale };
    context.globalAlpha = alpha;

    context.strokeStyle = "#ffb020";
    context.lineWidth = Math.max(1, scale);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(anchor.x, anchor.y);
    context.stroke();

    context.fillStyle = "#ffb020";
    context.beginPath();
    context.arc(x, y, 2.5 * scale, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#1a1204";
    context.fillText(`${pin.index}`, anchor.x, anchor.y + radius * 0.06);
  }
  context.globalAlpha = 1;
  return canvas.toDataURL("image/png");
}
