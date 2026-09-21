import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.tsx";
import { Asset } from "./Asset.tsx";
import { Markdown } from "./Markdown.tsx";
import { ActivityRow } from "./ActivityRow.tsx";
import { RevisionCard } from "./RevisionCard.tsx";
import { collapseSteps, turnHeader, type Turn } from "../../shared/turns.ts";
import type { Revision } from "../../shared/project.ts";
import { plural } from "../../shared/plural.ts";

interface Props {
  turn: Turn;
  projectId: string | undefined;
  revisions: Revision[];
  currentRevision: number | undefined;
  streaming: string;
  thinkingMs: number;
  running: boolean;
  onRevision(revision: number): void;
  onPreview(revision: number | undefined): void;
  onZoom(url: string): void;
  onEdit(text: string): void;
}

function Timer({ from }: { from: number }): React.JSX.Element {
  const node = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = (): void => {
      if (!node.current) return;
      const seconds = Math.floor((Date.now() - from) / 1000);
      node.current.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [from]);
  return <span className="mono" ref={node} />;
}

function Sent({ turn, projectId, onZoom, onEdit }: {
  turn: Turn;
  projectId: string | undefined;
  onZoom(url: string): void;
  onEdit(text: string): void;
}): React.JSX.Element | null {
  const user = turn.user;
  if (!user) return null;
  return (
    <div className="sent">
      <div className="bubble">
        {user.view || user.images.length > 0
          ? (
            <div className="sent-thumbs">
              {user.view
                ? <Asset projectId={projectId} kind="render" id={user.view} alt="the view you sent" className="view" onClick={onZoom} />
                : null}
              {user.images.map((id) => (
                <Asset key={id} projectId={projectId} kind="image" id={id} alt="reference" className="small" onClick={onZoom} />
              ))}
            </div>
          )
          : null}
        <p>{user.text}</p>
        {user.pins.length > 0
          ? (
            <div className="sent-chips">
              {user.pins.map((pin) => (
                <span key={pin.index} className="sent-balloon" data-pin={pin.index}>
                  <span className="balloon small">{pin.index}</span>
                  {pin.part}
                </span>
              ))}
            </div>
          )
          : null}
      </div>
      <div className="sent-meta">
        <span className="mono">{new Date(user.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <button className="quiet" onClick={() => void navigator.clipboard.writeText(user.text)}>Copy</button>
        <button className="quiet" onClick={() => onEdit(user.text)}>Edit and resend</button>
      </div>
    </div>
  );
}

export function TurnView(props: Props): React.JSX.Element {
  const turn = props.running ? { ...props.turn, running: true } : props.turn;
  const [open, setOpen] = useState(turn.running);
  const [started] = useState(() => Date.now());
  useEffect(() => {
    setOpen(turn.running);
  }, [turn.running]);

  const { shown, hidden } = collapseSteps(turn.steps);
  const [all, setAll] = useState(false);
  const steps = all ? turn.steps : shown;
  const builds = turn.steps
    .flatMap((step) => (step.detail?.kind === "build" ? [step.detail.revision] : []));

  return (
    <article className="turn">
      <Sent turn={turn} projectId={props.projectId} onZoom={props.onZoom} onEdit={props.onEdit} />

      {turn.steps.length > 0 || turn.running
        ? (
          <>
            <button className="work-header" onClick={() => setOpen(!open)} aria-expanded={open}>
              {turn.running
                ? <><span className="pulse" /> Working for <Timer from={started} /></>
                : (
                  <>
                    <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />
                    {turnHeader(turn, 0)}
                    <span className="work-count mono">{turn.steps.length}</span>
                  </>
                )}
            </button>
            {open
              ? (
                <div className="work-body">
                  {!turn.running && (turn.answer?.thinkingMs ?? 0) >= 1000
                    ? <Thought ms={turn.answer!.thinkingMs!} />
                    : null}
                  {props.thinkingMs > 0 && turn.running
                    ? <div className="step running"><span className="step-line"><span className="step-icon"><Icon name="brain" size={16} /></span><span className="step-text shine">Thinking</span></span></div>
                    : null}
                  {steps.map((step) => (
                    <ActivityRow key={step.id} entry={step} projectId={props.projectId} onZoom={props.onZoom} />
                  ))}
                  {hidden > 0 && !all
                    ? <button className="step-more" onClick={() => setAll(true)}>{plural(hidden, "more step")}</button>
                    : null}
                </div>
              )
              : null}
          </>
        )
        : null}

      {turn.answer ? <Markdown text={turn.answer.text} /> : null}
      {props.streaming
        ? <div className="markdown streaming"><Markdown text={props.streaming} /><span className="caret-blink" /></div>
        : null}

      {builds.map((number) => {
        const revision = props.revisions.find((entry) => entry.number === number);
        return revision
          ? (
            <RevisionCard
              key={number}
              revision={revision}
              projectId={props.projectId}
              current={props.currentRevision === number}
              onOpen={() => props.onRevision(number)}
              onPreview={props.onPreview}
            />
          )
          : null;
      })}

      {turn.answer ? <Footer answer={turn.answer} /> : null}
    </article>
  );
}

function Thought({ ms }: { ms: number }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="step done">
      <button className="step-line" onClick={() => setOpen(!open)}>
        <span className="step-icon"><Icon name="brain" size={16} /></span>
        <span className="step-text">Thought for {Math.round(ms / 1000)} s</span>
      </button>
      {open ? <p className="thought">The engine reported {Math.round(ms / 1000)} s of thinking in this turn.</p> : null}
    </div>
  );
}

function Footer({ answer }: { answer: NonNullable<Turn["answer"]> }): React.JSX.Element {
  const usage = answer.usage;
  const tokens = usage?.totalTokens;
  return (
    <div className="turn-footer mono">
      {answer.model ? <span>{answer.model}</span> : null}
      {tokens !== undefined
        ? <span title="Reported by the engine for this turn">{tokens >= 10_000 ? `${(tokens / 1000).toFixed(1)}k context` : plural(tokens, "token")}</span>
        : null}
      {answer.durationMs !== undefined ? <span>{(answer.durationMs / 1000).toFixed(1)} s</span> : null}
      <button className="quiet" onClick={() => void navigator.clipboard.writeText(answer.text)}>
        <Icon name="copy" size={12} />
      </button>
    </div>
  );
}
