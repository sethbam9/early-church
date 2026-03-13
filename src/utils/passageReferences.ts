import type { Passage, SourceRecord } from "../data/types";
import { locatorToDisplay, osisToStepBibleUrl } from "./bibleApi";
import { getSourceExternalUrl } from "./sourceLinks";

export function isBiblePassage(passage: Passage | null | undefined): boolean {
  return passage?.locator_type === "bible_osis";
}

export function formatPassageLocator(passage: Passage | null | undefined): string {
  if (!passage) return "";
  return isBiblePassage(passage) ? locatorToDisplay(passage.locator) : passage.locator;
}

export function getPassageUrl(
  passage: Passage | null | undefined,
  source: SourceRecord | null | undefined,
): string {
  if (!passage) return "";
  if (passage.url_override) return passage.url_override;
  if (isBiblePassage(passage)) return osisToStepBibleUrl(passage.locator);
  return getSourceExternalUrl(source);
}
