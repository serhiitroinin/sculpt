import { useCallback, useEffect, useRef, useState } from "react";
import { Viewport, type StandardView } from "../viewport/viewport.ts";
import { BALLOON_RADIUS, LEADER } from "../viewport/pin-overlay.ts";
import { session } from "../session.ts";
import type { Pin } from "../../shared/project.ts";

const VIEWS: StandardView[] = ["iso", "front", "top", "right"];

interface Screen {
  index: number;
  x: number;
  y: number;
  behind: boolean;
}

interface Props {
  pins: Pin[];
  pulsed: number | undefined;
  rebuilding: boolean;
  kernel: { ratio: number; ready: boolean };
  onPin(pin: Omit<Pin, "index">): void;
  onRemovePin(index: number): void;
  ready(): void;
}

export function ViewportCanvas(props: Props): React.JSX.Element {
  const { pins, pulsed, rebuilding, kernel, onPin, onRemovePin, ready } = props;
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen[]>([]);
  const [dimensions, setDimensions] = useState(false);
  const down = useRef<{ x: number; y: number } | null>(null);
  const onReady = useRef(ready);
  onReady.current = ready;

  useEffect(() => {
    if (!host.current || !canvas.current) return;
    const viewport = new Viewport(canvas.current, host.current);
    session.viewport = viewport;
    onReady.current();
    return () => {
      session.viewport = undefined;
      viewport.dispose();
    };
  }, []);

  const place = useCallback(() => {
    const viewport = session.viewport;
    if (!viewport) return;
    setScreen(pins.map((pin) => ({ index: pin.index, ...viewport.project(pin.point) })));
  }, [pins]);

  useEffect(() => {
    const viewport = session.viewport;
    if (!viewport) return;
    place();
    return viewport.onCameraChange(place);
  }, [place]);

  useEffect(() => {
    if (pulsed === undefined) return;
    const pin = pins.find((entry) => entry.index === pulsed);
    if (pin && session.viewport && !session.viewport.isVisible(pin.point)) {
      session.viewport.lookAtPoint(pin.point);
    }
  }, [pulsed, pins]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== "d" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      setDimensions(session.viewport?.toggleDimensions() ?? false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="viewport" ref={host}>
      <canvas
        ref={canvas}
        onPointerDown={(event) => { down.current = { x: event.clientX, y: event.clientY }; }}
        onPointerUp={(event) => {
          const start = down.current;
          down.current = null;
          if (!start) return;
          if (Math.abs(start.x - event.clientX) > 3 || Math.abs(start.y - event.clientY) > 3) return;
          const hit = session.viewport?.pick(event.clientX, event.clientY);
          if (hit) onPin(hit);
        }}
        onDoubleClick={(event) => {
          const hit = session.viewport?.pick(event.clientX, event.clientY);
          if (hit) session.viewport?.lookAtPoint(hit.point);
        }}
      />

      {rebuilding ? <div className="scan" /> : null}

      {!kernel.ready
        ? (
          <div className="kernel">
            <p>Starting the CAD kernel</p>
            <div className="kernel-bar"><span style={{ width: `${Math.round(kernel.ratio * 100)}%` }} /></div>
            <p className="mono">{Math.round(kernel.ratio * 100)}%</p>
          </div>
        )
        : null}

      <svg className="balloons">
        {screen.map((pin) => (
          <g key={pin.index} opacity={pin.behind ? 0.4 : 1}>
            <line
              className="leader"
              x1={pin.x}
              y1={pin.y}
              x2={pin.x + LEADER.dx}
              y2={pin.y + LEADER.dy}
              stroke="var(--signal)"
              strokeWidth="1"
            />
            <circle cx={pin.x} cy={pin.y} r="2.5" fill="var(--signal)" />
          </g>
        ))}
      </svg>
      <div className="balloon-layer">
        {screen.map((pin) => (
          <button
            key={pin.index}
            className={pulsed === pin.index ? "balloon pulsing" : "balloon"}
            style={{
              left: `${pin.x + LEADER.dx - BALLOON_RADIUS}px`,
              top: `${pin.y + LEADER.dy - BALLOON_RADIUS}px`,
              opacity: pin.behind ? 0.4 : 1,
            }}
            title="Remove this pin"
            onClick={() => onRemovePin(pin.index)}
          >
            {pin.index}
          </button>
        ))}
      </div>

      <div className="view-control">
        {VIEWS.map((view) => (
          <button key={view} onClick={() => session.viewport?.fit(view)}>{view}</button>
        ))}
        <button onClick={() => session.viewport?.fit()}>fit</button>
        <button
          className={dimensions ? "on" : ""}
          title="Toggle dimensions (D)"
          onClick={() => setDimensions(session.viewport?.toggleDimensions() ?? false)}
        >
          dim
        </button>
      </div>
    </div>
  );
}
