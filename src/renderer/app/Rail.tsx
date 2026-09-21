import { useEffect, useState } from "react";
import { bridge } from "../bridge.ts";
import { session } from "../session.ts";
import { Icon } from "./Icon.tsx";
import type { ReferenceImage, Revision } from "../../shared/project.ts";

interface Props {
  projectId: string | undefined;
  revision: Revision | undefined;
  images: ReferenceImage[];
  onRemoveImage(id: string): void;
}

const number = (value: number): string => `${Math.round(value * 10) / 10}`;

export function Rail({ projectId, revision, images, onRemoveImage }: Props): React.JSX.Element {
  const [hidden, setHidden] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<string>();

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      const api = bridge();
      const entries = await Promise.all(images.map(async (image) => [
        image.id,
        await api.call("images.read", { projectId, imageId: image.id }),
      ] as const));
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [projectId, images]);

  return (
    <nav className="rail">
      <section>
        <p className="label">Parts</p>
        {revision
          ? (
            <ul className="part-list">
              {revision.report.parts.map((part) => (
                <li
                  key={part.name}
                  onMouseEnter={() => session.viewport?.highlight(part.name)}
                  onMouseLeave={() => session.viewport?.highlight(undefined)}
                >
                  <button
                    className="swatch"
                    style={{ background: part.color, opacity: hidden.includes(part.name) ? 0.2 : 1 }}
                    title={hidden.includes(part.name) ? "Show part" : "Hide part"}
                    onClick={() => {
                      const next = hidden.includes(part.name)
                        ? hidden.filter((name) => name !== part.name)
                        : [...hidden, part.name];
                      setHidden(next);
                      session.viewport?.setVisibility(part.name, !next.includes(part.name));
                    }}
                  />
                  <span className="part-name">{part.name}</span>
                  <span className="mono part-volume">{number(part.volume / 1000)} cm³</span>
                </li>
              ))}
            </ul>
          )
          : <p className="rail-empty">No model yet.</p>}
      </section>

      <section>
        <p className="label">References</p>
        {images.length === 0
          ? <p className="rail-empty">Drop an image anywhere.</p>
          : (
            <div className="thumbs">
              {images.map((image) => (
                <div key={image.id} className={image.seenAt ? "thumb seen" : "thumb"} title={image.seenAt ? "The agent has looked at this" : image.name}>
                  <img src={urls[image.id]} alt={image.name} onClick={() => setZoom(urls[image.id])} />
                  <button className="remove" title="Remove" onClick={() => onRemoveImage(image.id)}><Icon name="x" size={12} /></button>
                </div>
              ))}
            </div>
          )}
      </section>

      {zoom
        ? <div className="lightbox" onClick={() => setZoom(undefined)}><img src={zoom} alt="" /></div>
        : null}
    </nav>
  );
}
