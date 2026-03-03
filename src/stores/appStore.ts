import { create } from "zustand";
import type {
  CorrespondenceArc,
  FilterState,
  HighlightEntry,
  PlaybackSpeed,
  RightPanel,
  Selection,
} from "../domain/types";
import { dataStore, churchRowRepo } from "../data/runtimeData";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDefaultFilters(): FilterState {
  return {
    church_presence_status: [...churchRowRepo.facets.church_presence_status],
    ruling_empire_polity: [...churchRowRepo.facets.ruling_empire_polity],
    denomination_label_historic: [...churchRowRepo.facets.denomination_label_historic],
    modern_denom_mapping: [...churchRowRepo.facets.modern_denom_mapping],
  };
}

function parseUrlParams() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const requestedYear = Number(params.get("year"));
  return {
    year:
      Number.isFinite(requestedYear) && churchRowRepo.yearBuckets.includes(requestedYear)
        ? requestedYear
        : undefined,
    cumulative: params.get("cum") !== "0",
    search: params.get("q") ?? "",
    leftVisible: params.get("left") !== "0",
    rightVisible: params.get("right") !== "0",
  };
}

// ─── State Interface ─────────────────────────────────────────────────────────

export interface AppState {
  // Decade navigation
  activeDecade: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  includeCumulative: boolean;

  // Selection
  selection: Selection | null;

  // Highlights computed by services
  highlights: Record<string, HighlightEntry>;
  correspondenceArcs: CorrespondenceArc[];

  // UI layout
  leftSidebarVisible: boolean;
  rightSidebarVisible: boolean;
  activeRightPanel: RightPanel;

  // Right panel width
  rightPanelWide: boolean;

  // Layer toggles
  archaeologyLayerVisible: boolean;
  correspondenceLayerVisible: boolean;

  // Filters
  filters: FilterState;

  // Search
  searchQuery: string;

  // Shortcut help
  showShortcutHelp: boolean;

  // Share
  shareStatus: string;

  // Starred POI toggles (legacy support)
  enabledPoiIds: string[];

  // Essay
  activeEssayId: string;

  // Actions
  setDecade: (decade: number) => void;
  stepDecade: (offset: number) => void;
  setDecadeByIndex: (index: number) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setIncludeCumulative: (value: boolean) => void;

  setSelection: (selection: Selection | null) => void;
  setHighlights: (highlights: Record<string, HighlightEntry>) => void;
  setCorrespondenceArcs: (arcs: CorrespondenceArc[]) => void;

  setLeftSidebarVisible: (visible: boolean) => void;
  setRightSidebarVisible: (visible: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setActiveRightPanel: (panel: RightPanel) => void;

  toggleRightPanelWide: () => void;

  toggleArchaeologyLayer: () => void;
  toggleCorrespondenceLayer: () => void;

  setFilters: (filters: FilterState) => void;
  toggleFilterValue: (field: keyof FilterState, value: string) => void;
  setAllFilterValues: (field: keyof FilterState, values: string[]) => void;
  resetFilters: () => void;

  setSearchQuery: (query: string) => void;
  toggleShortcutHelp: () => void;
  setShareStatus: (status: string) => void;

  setEnabledPoiIds: (ids: string[]) => void;
  togglePoiId: (id: string) => void;

  setActiveEssayId: (id: string) => void;

  setIsPlaying: (playing: boolean) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const urlParams = parseUrlParams();
const defaultFilters = buildDefaultFilters();

export const useAppStore = create<AppState>((set) => ({
  activeDecade: urlParams.year ?? churchRowRepo.yearBuckets[0] ?? 33,
  isPlaying: false,
  playbackSpeed: 1,
  includeCumulative: urlParams.cumulative ?? true,

  selection: null,
  highlights: {},
  correspondenceArcs: [],

  leftSidebarVisible: urlParams.leftVisible ?? true,
  rightSidebarVisible: urlParams.rightVisible ?? true,
  activeRightPanel: "details",

  rightPanelWide: false,

  archaeologyLayerVisible: true,
  correspondenceLayerVisible: false,

  filters: defaultFilters,
  searchQuery: urlParams.search ?? "",

  showShortcutHelp: false,
  shareStatus: "",

  enabledPoiIds: dataStore.archaeology.getAll().map((s) => s.id),
  activeEssayId: "",

  // Actions
  setDecade: (decade) => set({ activeDecade: decade }),
  stepDecade: (offset) =>
    set((state) => {
      const buckets = churchRowRepo.yearBuckets;
      const currentIndex = buckets.indexOf(state.activeDecade);
      const nextIndex = Math.min(buckets.length - 1, Math.max(0, currentIndex + offset));
      return { activeDecade: buckets[nextIndex] ?? state.activeDecade };
    }),
  setDecadeByIndex: (index) =>
    set(() => {
      const buckets = churchRowRepo.yearBuckets;
      const bounded = Math.min(buckets.length - 1, Math.max(0, index));
      return { activeDecade: buckets[bounded] ?? 33 };
    }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setIncludeCumulative: (value) => set({ includeCumulative: value }),

  setSelection: (selection) => set({ selection }),
  setHighlights: (highlights) => set({ highlights }),
  setCorrespondenceArcs: (arcs) => set({ correspondenceArcs: arcs }),

  setLeftSidebarVisible: (visible) => set({ leftSidebarVisible: visible }),
  setRightSidebarVisible: (visible) => set({ rightSidebarVisible: visible }),
  toggleLeftSidebar: () => set((state) => ({ leftSidebarVisible: !state.leftSidebarVisible })),
  toggleRightSidebar: () => set((state) => ({ rightSidebarVisible: !state.rightSidebarVisible })),
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),

  toggleRightPanelWide: () => set((state) => ({ rightPanelWide: !state.rightPanelWide })),

  toggleArchaeologyLayer: () =>
    set((state) => ({ archaeologyLayerVisible: !state.archaeologyLayerVisible })),
  toggleCorrespondenceLayer: () =>
    set((state) => ({ correspondenceLayerVisible: !state.correspondenceLayerVisible })),

  setFilters: (filters) => set({ filters }),
  toggleFilterValue: (field, value) =>
    set((state) => {
      const current = state.filters[field];
      const hasValue = current.includes(value);
      const nextValues = hasValue ? current.filter((v) => v !== value) : [...current, value];
      return { filters: { ...state.filters, [field]: nextValues } };
    }),
  setAllFilterValues: (field, values) =>
    set((state) => ({ filters: { ...state.filters, [field]: [...values] } })),
  resetFilters: () => set({ filters: buildDefaultFilters() }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleShortcutHelp: () => set((state) => ({ showShortcutHelp: !state.showShortcutHelp })),
  setShareStatus: (status) => set({ shareStatus: status }),

  setEnabledPoiIds: (ids) => set({ enabledPoiIds: ids }),
  togglePoiId: (id) =>
    set((state) => ({
      enabledPoiIds: state.enabledPoiIds.includes(id)
        ? state.enabledPoiIds.filter((i) => i !== id)
        : [...state.enabledPoiIds, id],
    })),

  setActiveEssayId: (id) => set({ activeEssayId: id }),
}));
