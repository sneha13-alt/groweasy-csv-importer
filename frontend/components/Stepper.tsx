import { ImportStep } from "@/lib/types";

const STEPS: { key: ImportStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview" },
  { key: "processing", label: "AI Processing" },
  { key: "result", label: "Result" },
];

export default function Stepper({ current }: { current: ImportStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="mx-auto mb-10 flex max-w-2xl items-center justify-between">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isDone
                    ? "bg-brand-600 text-white"
                    : isActive
                    ? "bg-brand-500 text-white ring-4 ring-brand-50 dark:ring-slate-800"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                className={`whitespace-nowrap text-xs font-medium ${
                  isActive ? "text-brand-600 dark:text-brand-500" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 h-0.5 flex-1 rounded ${
                  isDone ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
