import express from "express";
import cors from "cors";
import { importRouter } from "./routes/import";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", model: process.env.OLLAMA_MODEL || "gemma3:12b-it-q4_K_M" });
});

app.use("/api/import", importRouter);

// Central error handler (e.g. multer file-type / size errors)
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(400).json({ error: err.message || "Unexpected error" });
  }
);

app.listen(PORT, () => {
  console.log(`GrowEasy CSV Importer backend listening on port ${PORT}`);
});
