import type { SourceRecord } from "../data/types";

export function getSourceExternalUrl(source: SourceRecord | null | undefined): string {
  if (!source) return "";
  if (source.url) return source.url;
  if (source.isbn_issn) return `https://www.worldcat.org/search?q=bn%3A${encodeURIComponent(source.isbn_issn)}`;
  return "";
}

export function getSourceAccessLabel(source: SourceRecord | null | undefined): string {
  if (!source) return "";
  if (source.url) return source.source_kind === "primary_text" ? "Open text" : "Open source";
  if (source.isbn_issn) return "Find edition";
  return "";
}

export function getSourceAccessTitle(source: SourceRecord | null | undefined): string {
  if (!source) return "";
  if (source.url) return `Open ${source.title}`;
  if (source.isbn_issn) return `Find ISBN/ISSN ${source.isbn_issn}`;
  return "";
}
