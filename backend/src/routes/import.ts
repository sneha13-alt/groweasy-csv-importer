import { Router, Request, Response } from "express";
import multer from "multer";
import { parseCsv } from "../services/csvParser";
import { extractCrmRecords } from "../services/aiExtractor";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    const okType =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv");
    cb(okType ? null : new Error("Only .csv files are supported"), okType);
  },
});

export const importRouter = Router();

/**
 * POST /api/import/preview
 * Parses the CSV and returns raw rows + headers. No AI processing here.
 */
importRouter.post("/preview", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const rows = parseCsv(req.file.buffer.toString("utf-8"));
    if (rows.length === 0) {
      return res.status(400).json({ error: "CSV has no data rows" });
    }
    const headers = Object.keys(rows[0]);
    return res.json({ headers, rows, rowCount: rows.length });
  } catch (err) {
    return res.status(400).json({
      error: `Failed to parse CSV: ${err instanceof Error ? err.message : "unknown error"}`,
    });
  }
});

/**
 * POST /api/import/confirm (streaming, Server-Sent Events)
 * Body: multipart/form-data with the same CSV file.
 * Streams progress events, then a final "result" event with the
 * structured CRM JSON.
 */
importRouter.post("/confirm", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  let rows;
  try {
    rows = parseCsv(req.file.buffer.toString("utf-8"));
  } catch (err) {
    return res.status(400).json({
      error: `Failed to parse CSV: ${err instanceof Error ? err.message : "unknown error"}`,
    });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: "CSV has no data rows" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("start", { total: rows.length });

  try {
    const result = await extractCrmRecords(rows, (done, total) => {
      send("progress", { done, total });
    });
    send("result", result);
  } catch (err) {
    send("error", {
      error: err instanceof Error ? err.message : "AI extraction failed",
    });
  } finally {
    res.end();
  }
});
