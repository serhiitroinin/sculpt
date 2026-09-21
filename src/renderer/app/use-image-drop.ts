import { useEffect, useState } from "react";
import { bridge } from "../bridge.ts";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

async function add(projectId: string, file: File): Promise<void> {
  if (!ACCEPTED.includes(file.type)) throw new Error(`Sculpt does not accept ${file.type} images.`);
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < buffer.length; index += 1) binary += String.fromCharCode(buffer[index]!);
  await bridge().call("images.add", {
    projectId,
    name: file.name === "" ? "pasted image" : file.name,
    mediaType: file.type,
    data: btoa(binary),
  });
}

/** Drop or paste an image anywhere in the window to add it to the project. */
export function useImageDrop(projectId: string | undefined): boolean {
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const onDragOver = (event: DragEvent): void => {
      event.preventDefault();
      setOver(true);
    };
    const onDragLeave = (): void => setOver(false);
    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      setOver(false);
      for (const file of Array.from(event.dataTransfer?.files ?? [])) {
        if (ACCEPTED.includes(file.type)) void add(projectId, file);
      }
    };
    const onPaste = (event: ClipboardEvent): void => {
      for (const item of Array.from(event.clipboardData?.items ?? [])) {
        const file = item.getAsFile();
        if (file && ACCEPTED.includes(file.type)) void add(projectId, file);
      }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [projectId]);

  return over;
}
