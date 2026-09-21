import { useEffect, useRef, useState } from "react";
import { TurnView } from "./TurnView.tsx";
import { Icon } from "./Icon.tsx";
import { groupTurns } from "../../shared/turns.ts";
import type { ProjectState } from "../../shared/project.ts";
import type { TurnText } from "../../shared/transcript.ts";

interface Props {
  project: ProjectState | undefined;
  turn: TurnText;
  running: boolean;
  onRevision(revision: number): void;
  onPreview(revision: number | undefined): void;
  onZoom(url: string): void;
  onEdit(text: string): void;
  emptyLine: string;
}

export function Chat(props: Props): React.JSX.Element {
  const list = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);
  const turns = groupTurns(props.project?.transcript ?? []);

  useEffect(() => {
    const node = list.current;
    if (!node) return;
    const onScroll = (): void => {
      setStuck(node.scrollHeight - node.scrollTop - node.clientHeight < 60);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  // A thumbnail that loads or a turn that collapses changes the height without a new message.
  const stuckNow = useRef(stuck);
  stuckNow.current = stuck;
  useEffect(() => {
    const node = list.current;
    const content = node?.firstElementChild;
    if (!node || !content) return;
    const observer = new ResizeObserver(() => {
      if (stuckNow.current) node.scrollTop = node.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stuck || !list.current) return;
    list.current.scrollTop = list.current.scrollHeight;
  }, [turns.length, props.turn.text, stuck, props.project?.transcript.length]);

  return (
    <div className="chat-wrap">
      <div className="chat" ref={list}>
        <div className="chat-content">
          {turns.length === 0
            ? <p className="chat-empty">{props.emptyLine}</p>
            : null}
          {turns.map((turn, index) => (
            <TurnView
              key={turn.id}
              turn={turn}
              projectId={props.project?.summary.id}
              revisions={props.project?.revisions ?? []}
              currentRevision={props.project?.currentRevision}
              streaming={index === turns.length - 1 && props.running ? props.turn.text : ""}
              thinkingMs={index === turns.length - 1 ? props.turn.thinkingMs || 1 : 0}
              running={props.running && index === turns.length - 1}
              onRevision={props.onRevision}
              onPreview={props.onPreview}
              onZoom={props.onZoom}
              onEdit={props.onEdit}
            />
          ))}
        </div>
      </div>
      {stuck
        ? null
        : (
          <button
            className="jump"
            onClick={() => {
              setStuck(true);
              if (list.current) list.current.scrollTop = list.current.scrollHeight;
            }}
          >
            Jump to latest <Icon name="arrow-down" size={13} />
          </button>
        )}
    </div>
  );
}
