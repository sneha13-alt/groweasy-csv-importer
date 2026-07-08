interface Props {
  columns: string[];
  rows: Record<string, string>[];
  maxHeight?: string;
  emptyMessage?: string;
}

export default function DataTable({
  columns,
  rows,
  maxHeight = "60vh",
  emptyMessage = "No rows to display",
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800"
      style={{ maxHeight }}
    >
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="sticky-th whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-2.5 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="odd:bg-white even:bg-slate-50 hover:bg-brand-50 dark:odd:bg-slate-900 dark:even:bg-slate-900/60 dark:hover:bg-slate-800"
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="max-w-xs truncate whitespace-nowrap border-b border-slate-100 px-4 py-2 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                  title={row[col]}
                >
                  {row[col] || <span className="text-slate-300 dark:text-slate-600">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
