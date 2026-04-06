import { format } from "date-fns";

/**
 * Convert an array of objects to a CSV string and trigger a browser download.
 */
export function downloadCsv(
  rows: Record<string, string | number | boolean | null | undefined>[],
  filename: string,
) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? "";
          const str = String(val);
          // Escape quotes and wrap if contains comma/quote/newline
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    ),
  ];

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Generate a dated filename like Zawya_Users_2026-04-06.csv */
export function zawyaFilename(prefix: string, suffix?: string) {
  const date = format(new Date(), "yyyy-MM-dd");
  const safeSuffix = suffix ? `_${suffix.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_")}` : "";
  return `Zawya_${prefix}${safeSuffix}_${date}.csv`;
}
