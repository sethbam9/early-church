import { create } from "zustand";
import type { Selection, PresenceStatus } from "../data/dataStore";
import { dataStore } from "../data/dataStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SidebarTab =
  | "places"
  | "persuasions"
  | "polities"
  | "people"
  | "doctrines"
  | "events"
  | "works"
  | "essays";

export type PlacesSubTab = "cities" | "archaeology";
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

  // Global search (left panel)
  searchQuery: string;

  // Arcs overlay (on by default)
  showArcs: boolean;

  // Map filter by entity (persuasion / polity / person)
  mapFilterType: string | null;
  mapFilterId: string | null;

  // Right sidebar
  sidebarTab: SidebarTab;
  sidebarPlacesSubTab: PlacesSubTab;
  sidebarExpanded: boolean;
  sidebarSearch: string;

  // Panel visibility
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  archaeologyLayerVisible: boolean;

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

  setSearchQuery: (q: string) => void;

  toggleShowArcs: () => void;
  setMapFilter: (type: string, id: string) => void;
  clearMapFilter: () => void;
  clearAll: () => void;

  setSidebarTab: (tab: SidebarTab) => void;
  setSidebarPlacesSubTab: (sub: PlacesSubTab) => void;
  toggleSidebarExpanded: () => void;
  setSidebarSearch: (q: string) => void;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleArchaeologyLayer: () => void;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const decades = dataStore.map.getDecades();
const defaultDecade = decades.includes(0) ? 0 : (decades.find((d) => d >= 0) ?? decades[0] ?? 0);

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  activeDecade: defaultDecade,
  isPlaying: false,
  playbackSpeed: 1,
  includeCumulative: true,

  selection: null,
  selectionHistory: [],

  activePresenceFilters: [],

  searchQuery: "",

  showArcs: true,
  mapFilterType: null,
  mapFilterId: null,

  sidebarTab: "places",
  sidebarPlacesSubTab: "cities",
  sidebarExpanded: false,
  sidebarSearch: "",

  leftPanelVisible: true,
  rightPanelVisible: true,
  archaeologyLayerVisible: true,

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

  setSelection: (selection) => set({ selection, selectionHistory: [] }),

  pushSelection: (sel) => set((s) => ({
    selectionHistory: s.selection ? [...s.selectionHistory, s.selection] : s.selectionHistory,
    selection: sel,
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

  // ── Global search ────────────────────────────────────────────────────────

  setSearchQuery: (q) => set({ searchQuery: q }),

  // ── Arcs / filter ────────────────────────────────────────────────────────

  toggleShowArcs: () => set((s) => ({ showArcs: !s.showArcs })),

  setMapFilter: (type, id) => set({ mapFilterType: type, mapFilterId: id }),
  clearMapFilter: () => set({ mapFilterType: null, mapFilterId: null }),
  clearAll: () => set({ selection: null, selectionHistory: [], mapFilterType: null, mapFilterId: null, searchQuery: "", activePresenceFilters: [] }),

  // ── Sidebar ──────────────────────────────────────────────────────────────

  setSidebarTab: (tab) => set({ sidebarTab: tab, sidebarSearch: "" }),
  setSidebarPlacesSubTab: (sub) => set({ sidebarPlacesSubTab: sub, sidebarSearch: "" }),
  toggleSidebarExpanded: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  setSidebarSearch: (q) => set({ sidebarSearch: q }),

  // ── Panel visibility ─────────────────────────────────────────────────────

  toggleLeftPanel: () => set((s) => ({ leftPanelVisible: !s.leftPanelVisible })),
  toggleRightPanel: () => set((s) => ({
    rightPanelVisible: !s.rightPanelVisible,
    sidebarExpanded: s.rightPanelVisible ? false : s.sidebarExpanded,
  })),
  toggleArchaeologyLayer: () => set((s) => ({ archaeologyLayerVisible: !s.archaeologyLayerVisible })),
}));
