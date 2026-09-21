import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.tsx";
import { session } from "../session.ts";
import { Asset } from "./Asset.tsx";
import { EnginePicker } from "./EnginePicker.tsx";
import type { EngineInfo } from "../../shared/ipc.ts";
import type { EngineChoice, Pin, ReferenceImage } from "../../shared/project.ts";

interface Props {
  pins: Pin[];
  images: ReferenceImage[];
  projectId: string | undefined;
  running: boolean;
  elapsed: number;
  activity: string | undefined;
  attachView: boolean;
  hasModel: boolean;
  engines: EngineInfo[];
  engine: EngineChoice | undefined;
  notice: string | undefined;
  onEngine(choice: EngineChoice): void;
  /** Called when the engine menu opens, so the models and the limits are read again. */
  onEngineMenu(): void;
  draft: string;
  dragging: boolean;
  error: string | undefined;
  onDraft(text: string): void;
  onAttachView(value: boolean): void;
  onRemovePin(index: number): void;
  onHoverPin(index: number | undefined): void;
  onSend(text: string, imageIds: string[]): void;
  onFollowUp(text: string): void;
  onStop(): void;
  onDismissError(): void;
}

const MAX_ROWS = 8;

export function Composer(props: Props): React.JSX.Element {
  const [selected, setSelected] = useState<string[]>([]);
  const [viewThumb, setViewThumb] = useState<string>();
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = area.current;
    if (!node) return;
    node.style.height = "auto";
    const lineHeight = 19;
    node.style.height = `${Math.min(node.scrollHeight, lineHeight * MAX_ROWS + 14)}px`;
  }, [props.draft]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && props.running) props.onStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  const attaching = props.attachView || props.pins.length > 0;
  useEffect(() => {
    if (!attaching || !props.hasModel) {
      setViewThumb(undefined);
      return;
    }
    const timer = setTimeout(() => {
      setViewThumb(session.viewport?.snapshot(props.pins));
    }, 120);
    return () => clearTimeout(timer);
  }, [attaching, props.hasModel, props.pins]);

  const send = (): void => {
    const value = props.draft.trim();
    if (value === "") return;
    props.onDraft("");
    if (props.running) props.onFollowUp(value);
    else {
      props.onSend(value, selected);
      setSelected([]);
    }
  };

  const chips = props.pins.length > 0 || props.images.length > 0;

  return (
    <div className="composer-wrap">
      {props.error
        ? (
          <div className="banner">
            <Icon name="alert" size={14} />
            <span>{props.error}</span>
            <button className="quiet" onClick={props.onDismissError}>Dismiss</button>
          </div>
        )
        : null}

      {props.running
        ? (
          <div className="activity-line">
            <span className="pulse" />
            <span className="mono shine">{props.activity ?? "Thinking"}</span>
            <span className="mono elapsed">{props.elapsed}s</span>
          </div>
        )
        : null}

      <div className={props.dragging ? "composer dragging" : "composer"}>
        {props.dragging ? <div className="drop-hint">Drop to add as a reference</div> : null}
        {chips
          ? (
            <div className="chips">
              {props.pins.map((pin) => (
                <button
                  key={pin.index}
                  className="chip balloon-chip"
                  title={`${pin.part} · ${pin.surface} · [${pin.point.join(", ")}] mm`}
                  onMouseEnter={() => props.onHoverPin(pin.index)}
                  onMouseLeave={() => props.onHoverPin(undefined)}
                  onClick={() => props.onRemovePin(pin.index)}
                >
                  <span className="balloon small">{pin.index}</span>
                  <span>{pin.part}</span>
                  <span className="chip-x"><Icon name="x" size={11} /></span>
                </button>
              ))}
              {props.images.map((image) => (
                <button
                  key={image.id}
                  className={selected.includes(image.id) ? "chip image-chip on" : "chip image-chip"}
                  onClick={() => setSelected((current) => current.includes(image.id)
                    ? current.filter((id) => id !== image.id)
                    : [...current, image.id])}
                >
                  <Asset projectId={props.projectId} kind="image" id={image.id} alt="" className="chip-thumb" />
                  {image.name}
                </button>
              ))}
            </div>
          )
          : null}

        <textarea
          ref={area}
          value={props.draft}
          rows={2}
          placeholder={props.running
            ? "Steer the running turn…"
            : "Describe the part, or point at what to change…"}
          onChange={(event) => props.onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />

        <div className="composer-row">
          <button
            className={attaching ? "quiet-pill on" : "quiet-pill"}
            disabled={!props.hasModel || props.pins.length > 0}
            title="Send a picture of the current view"
            onClick={() => props.onAttachView(!props.attachView)}
          >
            view
          </button>
          {viewThumb ? <img className="view-thumb" src={viewThumb} alt="what will be sent" /> : null}
          <EnginePicker
            engines={props.engines}
            choice={props.engine}
            notice={props.notice}
            onChange={props.onEngine}
            onOpen={props.onEngineMenu}
          />
          <span className="grow" />
          {props.running
            ? (
              <button className="send stop" onClick={props.onStop} title="Stop the turn">
                <span className="stop-square" />
                Stop
              </button>
            )
            : (
              <button className="send" onClick={send} disabled={props.draft.trim() === ""}>
                Send
                <kbd>⏎</kbd>
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
