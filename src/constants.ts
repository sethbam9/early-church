import type { LocationPrecision, PresenceStatus } from "./types";

export const PRESENCE_STATUS_COLORS: Record<PresenceStatus, string> = {
  attested: "#2a9d8f",
  probable: "#e9c46a",
  claimed_tradition: "#f4a261",
  not_attested: "#8d99ae",
  suppressed: "#e63946",
  unknown: "#6c757d",
};

export const PRESENCE_STATUS_LABELS: Record<PresenceStatus, string> = {
  attested: "Attested",
  probable: "Probable",
  claimed_tradition: "Claimed tradition",
  not_attested: "Not attested",
  suppressed: "Suppressed",
  unknown: "Unknown",
};

export const LOCATION_PRECISION_LABELS: Record<LocationPrecision, string> = {
  exact: "Exact site",
  approx_city: "Approximate city",
  region_only: "Region only",
  unknown: "Unknown",
};

export const PLAYBACK_SPEEDS = [1, 2, 5] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
