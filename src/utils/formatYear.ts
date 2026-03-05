/** Format a year range as "AD start–end", "AD start", or "". */
export function formatYearRange(start: number | null, end: number | null): string {
  if (!start) return "";
  if (!end || end === start) return `AD ${start}`;
  return `AD ${start}–${end}`;
}
