# GrowEasy CSV Importer

An AI-powered CSV importer that ingests lead exports in **any column layout**
(Facebook Lead Ads, Google Ads, Excel sheets, real-estate CRMs, sales
reports, manually-made spreadsheets, ...) and intelligently maps them into
the standardized **GrowEasy CRM** JSON schema using a local LLM served by
[Ollama](https://ollama.com), model **`gemma3:12b-it-q4_K_M`**.

## How it works

1. **Upload** — drag & drop (or pick) any `.csv` file. Nothing is sent to
   the backend yet.
2. **Preview** — the file is parsed client-side/server-side purely for
   display: a responsive, sticky-header, scrollable table shows the raw
   rows exactly as they exist in the file. No AI runs at this step.
3. **Confirm** — clicking "Confirm & Import" is what actually triggers the
   backend AI pipeline.
4. **AI Extraction** — the backend batches rows (default 10/request) and
   asks the LLM to map each row's fields — whatever they're called — into
   the fixed GrowEasy schema, following strict rules (allowed status/source
   enums, date format, note consolidation, skip rules). Progress streams
   back to the UI via Server-Sent Events.
5. **Result** — a second table shows successfully imported records plus a
   separate tab for skipped rows (with the reason), along with summary
   stats (total imported / skipped / success rate).

## Tech stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **AI:** Ollama running `gemma3:12b-it-q4_K_M` locally (swappable via env var)

## Project structure

```
groweasy-importer/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app entrypoint
│   │   ├── routes/import.ts      # /api/import/preview and /confirm (SSE)
│   │   ├── services/
│   │   │   ├── csvParser.ts      # header-agnostic CSV -> row objects
│   │   │   └── aiExtractor.ts    # batching, prompting, retries, validation
│   │   └── types/crm.ts          # CRM schema + enums
│   └── Dockerfile
├── frontend/
│   ├── app/page.tsx              # 4-step import wizard
│   ├── components/               # UploadStep, DataTable, Stepper, DarkModeToggle
│   ├── lib/{api,types}.ts
│   └── Dockerfile
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) installed and running locally, with the model pulled:

  ```bash
  ollama pull gemma3:12b-it-q4_K_M
  ollama serve
  ```

## Running locally

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev        # http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev         # http://localhost:3000
```

Open http://localhost:3000, upload a CSV, preview it, confirm, and watch the
AI-mapped results come back.

## Running with Docker

```bash
docker compose up --build
```

This starts the backend on `:4000` and frontend on `:3000`. The backend
container talks to Ollama running on your host machine via
`host.docker.internal`. Make sure `ollama serve` is running on the host and
the model is pulled before starting the containers.

## Backend API

### `POST /api/import/preview`
`multipart/form-data`, field `file`. Parses the CSV (no AI) and returns:

```json
{ "headers": ["Name", "Email", "..."], "rows": [{ "Name": "John", "Email": "..." }], "rowCount": 42 }
```

### `POST /api/import/confirm`
`multipart/form-data`, field `file`. Streams **Server-Sent Events**:

- `event: start` — `{ total }`
- `event: progress` — `{ done, total }` after each AI batch completes
- `event: result` — final `{ imported, skipped, totalImported, totalSkipped }`
- `event: error` — `{ error }` if the pipeline fails

## AI extraction rules (enforced in `aiExtractor.ts`)

- `crm_status` restricted to `GOOD_LEAD_FOLLOW_UP | DID_NOT_CONNECT | BAD_LEAD | SALE_DONE` (else `""`)
- `data_source` restricted to `leads_on_demand | meridian_tower | eden_park | varah_swamy | sarjapur_plots` (else `""`)
- `created_at` must be parseable by `new Date(created_at)`
- Extra emails/phone numbers beyond the first are appended to `crm_note`
- Rows with neither an email nor a mobile number are **skipped**, with the reason recorded
- Batch failures retry up to `AI_MAX_RETRIES` times with backoff before the whole batch is marked skipped, so one bad batch never fails the entire import

## Configuration

| Variable | Location | Default | Purpose |
|---|---|---|---|
| `OLLAMA_HOST` | backend | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | backend | `gemma3:12b-it-q4_K_M` | Model used for extraction |
| `AI_BATCH_SIZE` | backend | `10` | Rows sent to the AI per request |
| `AI_MAX_RETRIES` | backend | `3` | Retries per batch on failure |
| `NEXT_PUBLIC_API_URL` | frontend | `http://localhost:4000` | Backend base URL |

## Testing

```bash
cd backend
npm test
```

## Notes on design choices

- **Column-name agnostic by design:** the CSV parser never assumes fixed
  headers — whatever the file has is passed straight through, and the LLM
  (not string-matching) does the semantic mapping. This is what lets
  Facebook exports, Google Ads exports, and hand-made spreadsheets all work
  through the same pipeline.
- **Batching + retries:** large files are chunked so the model handles a
  manageable number of rows per call and a single malformed batch doesn't
  take down the whole import.
- **SSE for progress:** avoids polling and gives the frontend real
  batch-by-batch progress without WebSocket infrastructure.
