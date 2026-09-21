const DOCUMENT = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "frame-src 'none'",
];

/**
 * Only the CAD worker may import a blob module or evaluate a string. Emscripten
 * embind generates its glue with `new Function`, so the OpenCascade build
 * cannot start without `unsafe-eval`. The document policy never gets either.
 */
const WORKER = [
  "default-src 'none'",
  "script-src 'self' blob: 'wasm-unsafe-eval' 'unsafe-eval'",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
];

export const DOCUMENT_CSP = DOCUMENT.join("; ");
export const WORKER_CSP = WORKER.join("; ");

export const DEV_DOCUMENT_CSP = DOCUMENT
  .map((rule) => {
    if (rule.startsWith("script-src")) return `${rule} 'unsafe-inline'`;
    if (rule.startsWith("connect-src")) return `${rule} ws://localhost:* http://localhost:*`;
    return rule;
  })
  .join("; ");

export const DEV_WORKER_CSP = WORKER
  .map((rule) => (rule.startsWith("connect-src") ? `${rule} http://localhost:*` : rule))
  .join("; ");
