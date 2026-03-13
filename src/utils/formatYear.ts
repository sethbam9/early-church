/** Format a single year, handling BC. */
function fmtYear(y: number): string {
  return y < 0 ? `${Math.abs(y)} BC` : `${y}`;
}

/** Format a year range as "AD start–end", "AD start", "123 BC", or "". */
export function formatYearRange(start: number | null | undefined, end: number | null | undefined): string {
  if (start == null) return "";
  if (end == null || end === start) return start < 0 ? `${Math.abs(start)} BC` : `AD ${start}`;
  return `${fmtYear(start)}–${fmtYear(end)}`;
}

/** Format a decade label, e.g. "AD 30s" or "40s BC". */
export function formatDecadeLabel(decade: number): string {
  return decade < 0 ? `${Math.abs(decade)}s BC` : `AD ${decade}s`;
}

/** Format a review timestamp to YYYY-MM-DD, or "" if empty. */
export function formatReviewDate(timestamp: string | null | undefined): string {
  if (!timestamp) return "";
  try { return new Date(timestamp).toISOString().split("T")[0] ?? ""; } catch { return ""; }
}

/** Truncate a label to `max` characters with ellipsis. */
export function truncateLabel(label: string, max = 20): string {
  return label.length > max ? label.slice(0, max) + "…" : label;
}
