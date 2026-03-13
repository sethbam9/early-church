import { create } from "zustand";
import type { Selection, PresenceStatus, PlaceKind } from "../data/dataStore";
import { dataStore } from "../data/dataStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PanelTab =
  | "places"
  | "groups"
  | "people"
  | "propositions"
  | "events"
  | "works"
  | "essays";

export type PlaybackSpeed = 1 | 2 | 4;

// ─── State ───────────────────────────────────────────────────────────────────

export interface AppState {
  // Decade navigation
  activeDecade: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  includeCumulative: boolean;

  // Map selection + navigation history
  selection: Selection | null;
  selectionHistory: Selection[];

  // Presence filter chips (empty = all shown)
  activePresenceFilters: PresenceStatus[];

  // Place kind filter (empty = all shown)
  activePlaceKindFilter: PlaceKind | null;

  // Christian-only toggle
  christianOnly: boolean;

  // Global search (left panel)
  searchQuery: string;

  // Arcs overlay (on by default)
  showArcs: boolean;

  // Map filter by entity (group / person / proposition)
  mapFilterType: string | null;
  mapFilterId: string | null;

  // Right panel
  panelTab: PanelTab;
  panelExpanded: boolean;
  panelSearch: string;
  pendingEssayId: string | null;

  // Panel visibility
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;

  // Actions
  setDecade: (decade: number) => void;
  stepDecade: (offset: number) => void;
  togglePlayback: () => void;
  setIsPlaying: (v: boolean) => void;
  setPlaybackSpeed: (s: PlaybackSpeed) => void;
  setIncludeCumulative: (v: boolean) => void;

  setSelection: (sel: Selection | null) => void;
  pushSelection: (sel: Selection) => void;
  popSelection: () => void;

  togglePresenceFilter: (s: PresenceStatus) => void;
  setAllPresenceFilters: (statuses: PresenceStatus[]) => void;

  setPlaceKindFilter: (kind: PlaceKind | null) => void;
  setChristianOnly: (v: boolean) => void;

  setSearchQuery: (q: string) => void;

  toggleShowArcs: () => void;
  setMapFilter: (type: string, id: string) => void;
  clearMapFilter: () => void;
  clearAll: () => void;

  setPanelTab: (tab: PanelTab) => void;
  togglePanelExpanded: () => void;
  setPanelSearch: (q: string) => void;
  setPendingEssay: (id: string | null) => void;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const decades = dataStore.map.getDecades();
const defaultDecade = decades.includes(20) ? 20 : (decades.find((d) => d >= 0) ?? decades[0] ?? 0);

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  activeDecade: defaultDecade,
  isPlaying: false,
  playbackSpeed: 1,
  includeCumulative: true,

  selection: null,
  selectionHistory: [],

  activePresenceFilters: [],
  activePlaceKindFilter: null,
  christianOnly: false,

  searchQuery: "",

  showArcs: true,
  mapFilterType: null,
  mapFilterId: null,

  panelTab: "places",
  panelExpanded: false,
  panelSearch: "",
  pendingEssayId: null,

  leftPanelVisible: true,
  rightPanelVisible: true,

  // ── Decade / playback ────────────────────────────────────────────────────

  setDecade: (decade) => set({ activeDecade: decade }),

  stepDecade: (offset) =>
    set((s) => {
      const idx = decades.indexOf(s.activeDecade);
      const next = Math.min(decades.length - 1, Math.max(0, idx + offset));
      return { activeDecade: decades[next] ?? s.activeDecade };
    }),

  togglePlayback: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setIncludeCumulative: (v) => set({ includeCumulative: v }),

  // ── Selection ────────────────────────────────────────────────────────────

  setSelection: (selection) => set({ selection, selectionHistory: [], showArcs: true }),

  pushSelection: (sel) => set((s) => ({
    selectionHistory: s.selection ? [...s.selectionHistory, s.selection] : s.selectionHistory,
    selection: sel,
    showArcs: true,
  })),

  popSelection: () => set((s) => {
    const history = [...s.selectionHistory];
    const prev = history.pop() ?? null;
    return { selection: prev, selectionHistory: history };
  }),

  // ── Presence filters ─────────────────────────────────────────────────────

  togglePresenceFilter: (s) =>
    set((state) => {
      const cur = state.activePresenceFilters;
      const next = cur.includes(s) ? cur.filter((v) => v !== s) : [...cur, s];
      return { activePresenceFilters: next };
    }),

  setAllPresenceFilters: (statuses) => set({ activePresenceFilters: statuses }),

  // ── Place kind / christian filters ────────────────────────────────────────

  setPlaceKindFilter: (kind) => set({ activePlaceKindFilter: kind }),
  setChristianOnly: (v) => set({ christianOnly: v }),

  // ── Global search ────────────────────────────────────────────────────────

  setSearchQuery: (q) => set({ searchQuery: q }),

  // ── Arcs / filter ────────────────────────────────────────────────────────

  toggleShowArcs: () => set((s) => ({ showArcs: !s.showArcs })),

  setMapFilter: (type, id) => set({ mapFilterType: type, mapFilterId: id }),
  clearMapFilter: () => set({ mapFilterType: null, mapFilterId: null }),
  clearAll: () => set({ selection: null, selectionHistory: [], mapFilterType: null, mapFilterId: null, searchQuery: "", activePresenceFilters: [], activePlaceKindFilter: null, christianOnly: false }),

  // ── Panel ───────────────────────────────────────────────────────────────

  setPanelTab: (tab) => set({ panelTab: tab, panelSearch: "" }),
  togglePanelExpanded: () => set((s) => ({ panelExpanded: !s.panelExpanded })),
  setPanelSearch: (q) => set({ panelSearch: q }),
  setPendingEssay: (id) => set({ pendingEssayId: id }),

  // ── Panel visibility ─────────────────────────────────────────────────────

  toggleLeftPanel: () => set((s) => ({ leftPanelVisible: !s.leftPanelVisible })),
  toggleRightPanel: () => set((s) => ({
    rightPanelVisible: !s.rightPanelVisible,
    panelExpanded: s.rightPanelVisible ? false : s.panelExpanded,
  })),
}));
