"use client";

import { useMemo, useState } from "react";
import UploadStep from "@/components/UploadStep";
import DataTable from "@/components/DataTable";
import Stepper from "@/components/Stepper";
import DarkModeToggle from "@/components/DarkModeToggle";
import { confirmImport, previewCsv } from "@/lib/api";
import { CRM_FIELDS, ExtractionResult, ImportStep, PreviewResponse } from "@/lib/types";

export default function Home() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState<"imported" | "skipped">("imported");

  async function handleFileSelected(selected: File) {
    setError(null);

    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a valid .csv file.");
      return;
    }

    setFile(selected);
    try {
      const data = await previewCsv(selected);
      setPreview(data);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read CSV file");
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setStep("processing");
    setProgress({ done: 0, total: preview?.rowCount || 0 });
    setError(null);

    try {
      const res = await confirmImport(file, (done, total) => setProgress({ done, total }));
      setResult(res);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI extraction failed");
      setStep("preview");
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
  }

  const percent = useMemo(
    () => (progress.total ? Math.round((progress.done / progress.total) * 100) : 0),
    [progress]
  );

  const skippedColumns = useMemo(() => {
    if (!result?.skipped.length) return [];
    return Array.from(new Set(result.skipped.flatMap((s) => Object.keys(s.row))));
  }, [result]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GrowEasy CSV Importer</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload any lead CSV — AI maps it to the GrowEasy CRM format automatically.
          </p>
        </div>
        <DarkModeToggle />
      </header>

      <Stepper current={step} />

      {step === "upload" && <UploadStep onFileSelected={handleFileSelected} error={error} />}

      {step === "preview" && preview && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Preview</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {preview.rowCount} row{preview.rowCount === 1 ? "" : "s"} detected in{" "}
                <span className="font-medium">{file?.name}</span>. No AI processing has run yet.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Choose a different file
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Confirm & Import
              </button>
            </div>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <DataTable columns={preview.headers} rows={preview.rows} />
        </section>
      )}

      {step === "processing" && (
        <section className="mx-auto max-w-xl text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-500" />
            <p className="font-medium">AI is mapping your leads into GrowEasy CRM format…</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {progress.done} of {progress.total} rows processed
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {step === "result" && result && (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Rows" value={result.totalImported + result.totalSkipped} />
            <StatCard label="Imported" value={result.totalImported} accent="text-emerald-600 dark:text-emerald-400" />
            <StatCard label="Skipped" value={result.totalSkipped} accent="text-amber-600 dark:text-amber-400" />
            <StatCard
              label="Success Rate"
              value={`${
                result.totalImported + result.totalSkipped
                  ? Math.round(
                      (result.totalImported / (result.totalImported + result.totalSkipped)) * 100
                    )
                  : 0
              }%`}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
              <button
                onClick={() => setResultTab("imported")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  resultTab === "imported"
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Imported ({result.totalImported})
              </button>
              <button
                onClick={() => setResultTab("skipped")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  resultTab === "skipped"
                    ? "bg-brand-600 text-white"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Skipped ({result.totalSkipped})
              </button>
            </div>
            <button
              onClick={reset}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Import another file
            </button>
          </div>

          {resultTab === "imported" ? (
            <DataTable
              columns={CRM_FIELDS}
              rows={result.imported}
              emptyMessage="No records were successfully imported"
            />
          ) : (
            <DataTable
              columns={[...skippedColumns, "skip_reason"]}
              rows={result.skipped.map((s) => ({ ...s.row, skip_reason: s.reason }))}
              emptyMessage="Nothing was skipped 🎉"
            />
          )}
        </section>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${accent || ""}`}>{value}</p>
    </div>
  );
}
