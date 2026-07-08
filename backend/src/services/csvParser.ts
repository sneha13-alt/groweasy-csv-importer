import { parse } from "csv-parse/sync";
import { RawRow } from "../types/crm";

/**
 * Parses raw CSV text into an array of row objects keyed by the
 * original (untouched) column headers. We deliberately do NOT assume
 * any fixed set of column names — whatever headers the file has are
 * passed straight through to the AI extraction layer.
 */
export function parseCsv(csvText: string): RawRow[] {
  const cleaned = csvText.replace(/^\uFEFF/, ""); // strip BOM if present

  const records: RawRow[] = parse(cleaned, {
    columns: (header: string[]) =>
      header.map((h) => (h ?? "").trim()).map((h) => (h === "" ? "column" : h)),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });

  // Drop fully-empty rows (all values blank)
  return records.filter((row) =>
    Object.values(row).some((v) => (v ?? "").toString().trim() !== "")
  );
}
