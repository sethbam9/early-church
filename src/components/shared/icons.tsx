/**
 * Centralized icon system using Lucide React.
 * All icons are imported here and exported as components for consistent usage.
 */

import {
  MapPin,
  User,
  ScrollText,
  Zap,
  Users,
  BookOpen,
  BarChart3,
  FileText,
  Library,
  FileCheck,
  Link2,
  StickyNote,
  Map as MapIcon,
  Network,
  BookMarked,
  BookText,
  Search,
  Menu,
  Building2,
  Mountain,
  Church,
  Landmark,
  Route,
  MapPinned,
  Circle,
  type LucideProps,
} from "lucide-react";

// Entity kind icons
export const PlaceIcon = MapPin;
export const PersonIcon = User;
export const WorkIcon = ScrollText;
export const EventIcon = Zap;
export const GroupIcon = Users;
export const TopicIcon = BookOpen;
export const DimensionIcon = BarChart3;
export const PropositionIcon = FileText;
export const SourceIcon = Library;
export const PassageIcon = FileCheck;
export const ClaimIcon = Link2;
export const EditorNoteIcon = StickyNote;
export const EssayIcon = BookText;

// Navigation icons
export const MapNavIcon = MapIcon;
export const GraphNavIcon = Network;
export const WikiNavIcon = BookMarked;
export const AuditNavIcon = Search;
export const GuideNavIcon = BookOpen;

// Place kind icons
export const CityIcon = Building2;
export const SiteIcon = Mountain;
export const MonasteryIcon = Church;
export const RegionIcon = Landmark;
export const ProvinceIcon = MapPinned;
export const RouteIcon = Route;
export const UnknownPlaceIcon = Circle;

// UI utility icons
export const MenuIcon = Menu;
export const SearchIcon = Search;

// ─── Place-kind SVG path data (exact Lucide paths) ────────────────────────────
// Single source of truth used by both React components (PlaceKindIcon) and
// Leaflet divIcon raw SVG strings (buildPlaceKindIconSvg). Any icon update
// here automatically propagates to the map markers AND the right panel.
export const PLACE_KIND_SVG_PATHS: Record<string, string> = {
  city:      `<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>`,
  site:      `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>`,
  monastery: `<path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="m18 9 3.52 2.147a1 1 0 0 1 .48.854V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6.999a1 1 0 0 1 .48-.854L6 9"/><path d="M6 21V7a1 1 0 0 1 .376-.782l5-3.999a1 1 0 0 1 1.249.001l5 4A1 1 0 0 1 18 7v14"/>`,
  region:    `<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>`,
  province:  `<path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0"/><circle cx="12" cy="8" r="2"/><path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712"/>`,
  route:     `<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>`,
};

export const PLACE_KIND_LABELS: Record<string, string> = {
  city: "City", site: "Site", monastery: "Monastery",
  region: "Region", province: "Province", route: "Route", unknown: "Unknown",
};

/**
 * Builds a raw SVG string for use in Leaflet divIcon.
 * Uses the EXACT same paths as the PlaceKindIcon React component.
 */
export function buildPlaceKindIconSvg(
  placeKind: string,
  strokeColor: string,
  size: number,
): string {
  const inner = PLACE_KIND_SVG_PATHS[placeKind];
  if (!inner) {
    const r = Math.round(size / 2) - 2;
    const cx = size / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${cx}" cy="${cx}" r="${r}" fill="${strokeColor}" stroke="${strokeColor}" stroke-width="1.5"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

// Icon component map for dynamic lookup
export const KIND_ICON_COMPONENTS: Record<string, React.ComponentType<LucideProps>> = {
  place: PlaceIcon,
  person: PersonIcon,
  work: WorkIcon,
  event: EventIcon,
  group: GroupIcon,
  topic: TopicIcon,
  dimension: DimensionIcon,
  proposition: PropositionIcon,
  source: SourceIcon,
  passage: PassageIcon,
  claim: ClaimIcon,
  editor_note: EditorNoteIcon,
  essay: BookText,
};

export const PLACE_KIND_ICON_COMPONENTS: Record<string, React.ComponentType<LucideProps>> = {
  city: CityIcon,
  site: SiteIcon,
  monastery: MonasteryIcon,
  region: RegionIcon,
  province: ProvinceIcon,
  route: RouteIcon,
  unknown: UnknownPlaceIcon,
};

// Helper to get icon component by entity kind
export function getKindIcon(kind: string): React.ComponentType<LucideProps> {
  return KIND_ICON_COMPONENTS[kind] ?? Circle;
}

// Helper to get place kind icon component
export function getPlaceKindIcon(placeKind: string): React.ComponentType<LucideProps> {
  return PLACE_KIND_ICON_COMPONENTS[placeKind] ?? UnknownPlaceIcon;
}

// Default icon props for consistent sizing
export const DEFAULT_ICON_PROPS: LucideProps = {
  size: 16,
  strokeWidth: 2,
};
