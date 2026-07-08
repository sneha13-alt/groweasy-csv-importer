import { ExtractionResult, PreviewResponse } from "./types";

const BASE = "/api/backend";

export async function previewCsv(file: File): Promise<PreviewResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE}/import/preview`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to preview CSV" }));
    throw new Error(err.error || "Failed to preview CSV");
  }

  return res.json();
}

/**
 * Streams the confirm/import endpoint (Server-Sent Events) so the UI can
 * show batch-by-batch progress while the AI model works through the file.
 */
export async function confirmImport(
  file: File,
  onProgress: (done: number, total: number) => void
): Promise<ExtractionResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE}/import/confirm`, {
    method: "POST",
    body: form,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: "Failed to start import" }));
    throw new Error(err.error || "Failed to start import");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new Promise<ExtractionResult>((resolve, reject) => {
    function pump(): Promise<void> {
      return reader.read().then(({ done, value }) => {
        if (done) return;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const chunk of events) {
          const lines = chunk.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.replace("event:", "").trim();
          const data = JSON.parse(dataLine.replace("data:", "").trim());

          if (eventName === "progress") {
            onProgress(data.done, data.total);
          } else if (eventName === "result") {
            resolve(data as ExtractionResult);
          } else if (eventName === "error") {
            reject(new Error(data.error || "AI extraction failed"));
          }
        }

        return pump();
      });
    }

    pump().catch(reject);
  });
}
