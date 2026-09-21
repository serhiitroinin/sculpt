import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon.tsx";
import { ActivityDetail } from "./ActivityDetail.tsx";
import { buildRowText, formatDuration, type ActivityEntry } from "../../shared/turns.ts";

const ICONS: Record<string, IconName> = {
  set_model: "cube",
  get_model: "file-code",
  render_views: "camera",
  measure: "ruler",
  read_reference: "book-open",
  view_reference_image: "image",
  list_pins: "map-pin",
  thinking: "brain",
};

/** The shine is the loading state, so it must stop when the row scrolls away. */
function useVisible<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

interface Props {
  entry: ActivityEntry;
  projectId: string | undefined;
  onZoom(url: string): void;
}

export function ActivityRow({ entry, projectId, onZoom }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [ref, visible] = useVisible<HTMLDivElement>();
  const live = entry.status === "running";
  const expandable = entry.detail !== undefined;
  const built = entry.detail?.kind === "build" ? buildRowText(entry.detail) : undefined;

  return (
    <div className={`step ${entry.status}`} ref={ref}>
      <button
        className="step-line"
        title={entry.text}
        disabled={!expandable}
        aria-expanded={open}
        onClick={() => expandable && setOpen(!open)}
      >
        <span className="step-icon"><Icon name={ICONS[entry.tool] ?? "cube"} size={16} /></span>
        <span
          className={live ? "step-text shine" : "step-text"}
          style={live && !visible ? { animationPlayState: "paused" } : undefined}
        >
          {built ? built.label : entry.text}
        </span>
        {built ? <span className="step-size mono">{built.size}</span> : null}
        {live ? <span className="step-dots">…</span> : null}
        {entry.durationMs !== undefined && !live
          ? <span className="step-time mono">{formatDuration(entry.durationMs)}</span>
          : null}
        {expandable ? <span className="step-chevron"><Icon name={open ? "chevron-down" : "chevron-right"} size={13} /></span> : null}
      </button>
      {open && entry.detail
        ? (
          <div className="step-detail">
            <ActivityDetail detail={entry.detail} projectId={projectId} onZoom={onZoom} />
          </div>
        )
        : null}
    </div>
  );
}
