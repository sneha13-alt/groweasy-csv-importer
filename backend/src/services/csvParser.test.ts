import { describe, it, expect } from "vitest";
import { parseCsv } from "./csvParser";

describe("parseCsv", () => {
  it("parses a simple CSV with headers", () => {
    const csv = `Name,Email,Phone\nJohn Doe,john@example.com,9876543210`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].Name).toBe("John Doe");
    expect(rows[0].Email).toBe("john@example.com");
  });

  it("does not assume fixed column names", () => {
    const csv = `Lead Name,Lead Email,Contact No\nJane,jane@example.com,555`;
    const rows = parseCsv(csv);
    expect(Object.keys(rows[0])).toEqual(["Lead Name", "Lead Email", "Contact No"]);
  });

  it("skips fully empty rows", () => {
    const csv = `Name,Email\nJohn,john@example.com\n,\n`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
  });

  it("strips a UTF-8 BOM if present", () => {
    const csv = `\uFEFFName,Email\nJohn,john@example.com`;
    const rows = parseCsv(csv);
    expect(rows[0].Name).toBe("John");
  });
});
