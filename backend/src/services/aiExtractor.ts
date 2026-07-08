import {
  CRM_FIELDS,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  CrmRecord,
  ExtractionResult,
  RawRow,
} from "../types/crm";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:12b-it-q4_K_M";
const BATCH_SIZE = Number(process.env.AI_BATCH_SIZE || 10);
const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES || 3);

const SYSTEM_PROMPT = `You are a data-mapping engine for a CRM called GrowEasy.

You will be given an array of raw lead rows extracted from an arbitrary CSV file.
Column names are NOT standardized — they may come from Facebook Lead Ads,
Google Ads, Excel exports, real-estate CRMs, sales reports, or manually made
spreadsheets. Your job is to intelligently map whatever fields are present
into the fixed GrowEasy CRM schema below, using semantic understanding of the
column names AND the values themselves (e.g. a column called "Phone",
"Contact No", "Mobile", "WhatsApp Number" all mean the same thing; a value
that looks like an email is an email even if the column is named "Contact").

Return ONLY a JSON array (no markdown fences, no commentary) with one object
per input row, in the SAME ORDER as the input. Each object must have exactly
these keys:

${CRM_FIELDS.map((f) => `- ${f}`).join("\n")}

Rules:
1. crm_status must be one of exactly: ${CRM_STATUS_VALUES.join(", ")}, or "" if unclear.
2. data_source must be one of exactly: ${DATA_SOURCE_VALUES.join(", ")}, or "" if none match confidently.
3. created_at must be a string parseable by JavaScript's "new Date(created_at)". If no date is present, use "".
4. country_code should be the phone country code including a leading "+" (e.g. "+91"). Infer from the phone number or country if possible, otherwise "".
5. mobile_without_country_code must NOT include the country code or a leading "+".
6. If multiple emails exist for a row, use the first as "email" and append the rest into crm_note (e.g. "Additional email: x@y.com").
7. If multiple phone numbers exist for a row, use the first as "mobile_without_country_code" and append the rest into crm_note.
8. Put any remarks, notes, follow-up comments, or unmapped-but-useful info into crm_note. Keep crm_note as a single line — replace any internal line breaks with " | ".
9. Every value must be a plain string (use "" for missing/unknown, never null).
10. Do not invent data that is not present or reasonably inferable from the row.

Respond with the JSON array only.`;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callOllama(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error("Ollama returned an empty response");
  return content;
}

function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function coerceRecord(obj: Record<string, unknown>): CrmRecord {
  const rec: Partial<CrmRecord> = {};
  for (const field of CRM_FIELDS) {
    const value = obj[field];
    rec[field] = value === null || value === undefined ? "" : String(value).trim();
  }

  if (!(CRM_STATUS_VALUES as readonly string[]).includes(rec.crm_status || "")) {
    rec.crm_status = "";
  }
  if (!(DATA_SOURCE_VALUES as readonly string[]).includes(rec.data_source || "")) {
    rec.data_source = "";
  }

  // Normalize country_code to always start with "+" if non-empty
  if (rec.country_code && !rec.country_code.startsWith("+")) {
    rec.country_code = `+${rec.country_code.replace(/\D/g, "")}`;
  }
  // Strip stray "+" / spaces from the mobile part
  if (rec.mobile_without_country_code) {
    rec.mobile_without_country_code = rec.mobile_without_country_code.replace(/[^\d]/g, "");
  }
  // Collapse any accidental newlines to keep the record a single CSV row
  rec.crm_note = (rec.crm_note || "").replace(/\r?\n/g, " | ");
  rec.description = (rec.description || "").replace(/\r?\n/g, " | ");

  return rec as CrmRecord;
}

function hasContactInfo(rec: CrmRecord): boolean {
  return Boolean(rec.email.trim() || rec.mobile_without_country_code.trim());
}

async function extractBatch(rows: RawRow[]): Promise<CrmRecord[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const userPrompt = `Input rows (JSON array, ${rows.length} items):\n${JSON.stringify(
        rows
      )}\n\nReturn the mapped JSON array now.`;

      const raw = await callOllama([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);

      const cleaned = stripCodeFences(raw);
      const parsed = JSON.parse(cleaned);

      const arr: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { records?: unknown[] })?.records)
        ? (parsed as { records: unknown[] }).records
        : [];

      if (arr.length !== rows.length) {
        throw new Error(
          `AI returned ${arr.length} records for a batch of ${rows.length}`
        );
      }

      return arr.map((item) => coerceRecord(item as Record<string, unknown>));
    } catch (err) {
      lastError = err;
      // brief backoff before retrying
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI extraction failed after retries");
}

export async function extractCrmRecords(
  rows: RawRow[],
  onProgress?: (done: number, total: number) => void
): Promise<ExtractionResult> {
  const imported: CrmRecord[] = [];
  const skipped: ExtractionResult["skipped"] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    try {
      const mapped = await extractBatch(batch);
      mapped.forEach((rec, idx) => {
        if (hasContactInfo(rec)) {
          imported.push(rec);
        } else {
          skipped.push({ row: batch[idx], reason: "No email or mobile number found" });
        }
      });
    } catch (err) {
      // If a batch fails after all retries, skip the whole batch rather
      // than failing the entire import.
      batch.forEach((row) =>
        skipped.push({
          row,
          reason: `AI extraction failed: ${
            err instanceof Error ? err.message : "unknown error"
          }`,
        })
      );
    }

    onProgress?.(Math.min(i + BATCH_SIZE, rows.length), rows.length);
  }

  return {
    imported,
    skipped,
    totalImported: imported.length,
    totalSkipped: skipped.length,
  };
}
