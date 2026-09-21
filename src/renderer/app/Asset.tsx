import { useEffect, useState } from "react";
import { bridge } from "../bridge.ts";

type Kind = "render" | "revision" | "image";

const cache = new Map<string, string>();

export function useAsset(projectId: string | undefined, kind: Kind, id: string | undefined): string | undefined {
  const key = `${projectId}:${kind}:${id}`;
  const [url, setUrl] = useState<string | undefined>(cache.get(key));

  useEffect(() => {
    if (!projectId || !id || cache.has(key)) return;
    let cancelled = false;
    void bridge().call("assets.read", { projectId, kind, id })
      .then((value) => {
        cache.set(key, value);
        if (!cancelled) setUrl(value);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId, kind, id, key]);

  return url;
}

interface Props {
  projectId: string | undefined;
  kind: Kind;
  id: string | undefined;
  alt: string;
  className?: string;
  onClick?(url: string): void;
}

/** An 8 px blurred placeholder holds the space until the file decodes. */
export function Asset({ projectId, kind, id, alt, className, onClick }: Props): React.JSX.Element {
  const url = useAsset(projectId, kind, id);
  return (
    <span className={`asset${url ? " ready" : ""}${className ? ` ${className}` : ""}`}>
      {url
        ? (
          <img
            src={url}
            alt={alt}
            onClick={onClick ? () => onClick(url) : undefined}
            style={onClick ? { cursor: "zoom-in" } : undefined}
          />
        )
        : null}
    </span>
  );
}
