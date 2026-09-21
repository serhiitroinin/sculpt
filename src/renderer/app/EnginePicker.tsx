import { useEffect, useRef, useState } from "react";
import type { EngineInfo } from "../../shared/ipc.ts";
import type { EngineChoice } from "../../shared/project.ts";
import { limitPercent, limitResets, limitValue, withModel } from "../../shared/engines.ts";
import { Icon } from "./Icon.tsx";

interface Props {
  engines: EngineInfo[];
  choice: EngineChoice | undefined;
  notice: string | undefined;
  onChange(choice: EngineChoice): void;
  /** The menu opened: a good moment to read the models and the limits again. */
  onOpen(): void;
}

/** "Default" sends no effort, so the engine decides. */
const ENGINE_DEFAULT_EFFORT = "";

function effortLabel(option: { id: string; label: string }): string {
  return option.id === "xhigh" && option.label === "Xhigh" ? "Extra high" : option.label;
}

/** The plan, then one metered row for every window the account reports. */
function Limits({ limits }: { limits: EngineInfo["limits"] | undefined }): React.JSX.Element {
  if (!limits) return <p className="menu-note limits">Reading the usage limits…</p>;
  if (limits.status !== "available") {
    return <p className="menu-note limits">{limits.message || `Usage limits are ${limits.status}.`}</p>;
  }
  if (limits.windows.length === 0) {
    return <p className="menu-note limits">{limits.planLabel ? `${limits.planLabel} plan` : "No account limit is in force."}</p>;
  }
  return (
    <div className="limit-rows">
      <p className="menu-label">{limits.planLabel ? `${limits.planLabel} plan` : "Usage"}</p>
      {limits.windows.map((entry) => {
        const percent = limitPercent(entry);
        const resets = limitResets(entry, Date.now());
        return (
          <div key={entry.id} className="limit-row" title={entry.resetsAt ? `Resets ${new Date(entry.resetsAt).toLocaleString()}` : undefined}>
            <span className="limit-name">{entry.label}</span>
            <span className="limit-meter">
              {percent !== undefined
                ? <span className={percent >= 90 ? "hot" : ""} style={{ width: `${percent}%` }} />
                : null}
            </span>
            <span className="limit-value mono">{limitValue(entry)}</span>
            <span className="limit-resets">{resets ?? ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function modelLabel(engine: EngineInfo | undefined, choice: EngineChoice | undefined): string {
  if (!engine) return "no engine";
  if (engine.models.status !== "available") return engine.models.status;
  const id = choice?.model ?? engine.models.defaultModelId;
  return engine.models.models.find((model) => model.id === id)?.label ?? id ?? "default";
}

export function EnginePicker({ engines, choice, notice, onChange, onOpen }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const engine = engines.find((entry) => entry.id === choice?.adapterId) ?? engines[0];

  const close = (): void => {
    setOpen(false);
    const composer = document.querySelector<HTMLTextAreaElement>(".composer textarea");
    composer?.focus();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (open) {
      input.current?.focus();
      onOpen();
    } else setFilter("");
    setActive(0);
    // onOpen is a stable callback; the effect is about the menu opening.
  }, [open]);

  const models = engine?.models.status === "available"
    ? engine.models.models.filter((model) => model.label.toLowerCase().includes(filter.toLowerCase()))
    : [];
  const current = engine?.models.models.find((model) => model.id === (choice?.model ?? engine.models.defaultModelId));
  const efforts = current?.efforts ?? [];
  const effortOptions = efforts.length === 0 || (current?.defaultEffort && efforts.some((option) => option.id === current.defaultEffort))
    ? efforts
    : [{ id: ENGINE_DEFAULT_EFFORT, label: "Default" }, ...efforts];
  const effortValue = effortOptions.find((option) => option.id === (choice?.effort ?? current?.defaultEffort))?.id
    ?? effortOptions[0]?.id;

  const setEffort = (id: string): void => {
    if (!engine) return;
    const { effort: _dropped, ...rest } = choice ?? { adapterId: engine.id };
    onChange(id === ENGINE_DEFAULT_EFFORT ? rest : { ...rest, effort: id });
  };

  return (
    <div className="picker">
      <button className="pill" onClick={() => setOpen(!open)} title="Engine and model (⌘K)">
        <span className="pill-engine">{engine?.label ?? "Engine"}</span>
        <span className="pill-sep" />
        <span className="pill-model">{modelLabel(engine, choice)}</span>
      </button>
      {open
        ? (
          <div className="menu right wide" onMouseLeave={() => setOpen(false)}>
            {notice ? <p className="menu-note notice">{notice}</p> : null}
            <div className="engine-marks">
              {engines.map((entry) => (
                <button
                  key={entry.id}
                  className={entry.id === engine?.id ? "mark on" : "mark"}
                  onClick={() => onChange({
                    adapterId: entry.id,
                    ...(entry.models.defaultModelId ? { model: entry.models.defaultModelId } : {}),
                  })}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <input
              ref={input}
              className="filter"
              placeholder="Filter models"
              value={filter}
              onChange={(event) => { setFilter(event.target.value); setActive(0); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setActive((value) => (value + step + models.length) % Math.max(models.length, 1));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const model = models[active];
                  if (model && engine) {
                    onChange(withModel(choice, engine.id, model));
                    close();
                  }
                }
              }}
            />

            <div className="menu-rule" />

            {engine?.models.status === "available"
              ? models.map((model) => {
                const selected = model.id === (choice?.model ?? engine.models.defaultModelId);
                return (
                  <button
                    key={model.id}
                    className={`menu-item${selected ? " on" : ""}${models[active]?.id === model.id ? " active" : ""}`}
                    onClick={() => {
                      onChange(withModel(choice, engine.id, model));
                      close();
                    }}
                  >
                    <span className="check">{selected ? <Icon name="check" size={12} /> : null}</span>
                    <span className="model-name">{model.label}</span>
                    {model.description ? <span className="model-note">{model.description}</span> : null}
                  </button>
                );
              })
              : (
                <p className="menu-note">
                  Models are {engine?.models.status}. {engine?.models.message}
                </p>
              )}

            {effortOptions.length > 0
              ? (
                <div>
                  <div className="menu-rule" />
                  <p className="menu-label">Effort</p>
                  <div className="segmented" data-control="effort">
                    {effortOptions.map((option) => (
                      <button
                        key={option.id}
                        className={option.id === effortValue ? "on" : ""}
                        onClick={() => setEffort(option.id)}
                      >
                        {effortLabel(option)}
                      </button>
                    ))}
                  </div>
                </div>
              )
              : null}

            {engine?.controls.map((control) => (
              <div key={control.id}>
                <div className="menu-rule" />
                <p className="menu-label">{control.label}</p>
                <div className="segmented">
                  {control.options.map((option) => (
                    <button
                      key={option.id}
                      className={(choice?.controls?.[control.id] ?? control.defaultValue) === option.id ? "on" : ""}
                      onClick={() => onChange({
                        ...(choice ?? { adapterId: engine.id }),
                        adapterId: engine.id,
                        controls: { ...choice?.controls, [control.id]: option.id },
                      })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="menu-rule" />
            <Limits limits={engine?.limits} />
          </div>
        )
        : null}
    </div>
  );
}
