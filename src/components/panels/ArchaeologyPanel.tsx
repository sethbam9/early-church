import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/runtimeData";
import { Badge } from "../shared/Badge";
import { CitationList } from "../shared/CitationList";
import type { ArchaeologySite } from "../../domain/types";

const SITE_TYPE_LABELS: Record<string, string> = {
  "house-church": "House Church",
  basilica: "Basilica",
  catacomb: "Catacomb",
  baptistery: "Baptistery",
  monastery: "Monastery",
  inscription: "Inscription",
  martyrium: "Martyrium",
  mosaic: "Mosaic",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  extant: "Extant",
  destroyed: "Destroyed",
  partially_preserved: "Partially Preserved",
  unknown: "Unknown",
};

export function ArchaeologyPanel() {
  const activeDecade = useAppStore((s) => s.activeDecade);
  const selection = useAppStore((s) => s.selection);
  const setSelection = useAppStore((s) => s.setSelection);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAllDecades, setShowAllDecades] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const allSites = useMemo(() => {
    return dataStore.archaeology.getAll().sort((a, b) => a.year_start - b.year_start);
  }, []);

  const siteTypes = useMemo(() => {
    const types = new Set(allSites.map((s) => s.site_type));
    return Array.from(types).sort();
  }, [allSites]);

  const filtered = useMemo(() => {
    let sites = allSites;
    if (typeFilter !== "all") {
      sites = sites.filter((s) => s.site_type === typeFilter);
    }
    if (!showAllDecades) {
      sites = sites.filter((s) => {
        const startsBefore = s.year_start <= activeDecade + 9;
        const endsAfter = s.year_end === null || s.year_end >= activeDecade;
        return startsBefore && endsAfter;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      sites = sites.filter((s) =>
        [s.name_display, s.city_ancient, s.description, s.significance].join(" ").toLowerCase().includes(q),
      );
    }
    return sites;
  }, [allSites, typeFilter, showAllDecades, activeDecade, searchQuery]);

  const selectedSiteId = selection?.kind === "archaeology" ? selection.id : null;
  const selectedSite = selectedSiteId ? dataStore.archaeology.getById(selectedSiteId) : null;

  return (
    <div className="archaeology-panel">
      <h2>Archaeology Timeline</h2>
      <p className="muted small">
        Churches, catacombs, baptisteries, monasteries, and inscriptions.
      </p>

      <div className="event-track-filters">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sites..."
          style={{ flex: 1, minWidth: 120 }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {siteTypes.map((t) => (
            <option key={t} value={t}>{SITE_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={showAllDecades}
            onChange={(e) => setShowAllDecades(e.target.checked)}
          />
          Show all decades
        </label>
        <span className="muted small">{filtered.length} sites</span>
      </div>

      <div className="archaeology-list">
        {filtered.map((site) => (
          <ArchaeologyCard
            key={site.id}
            site={site}
            isSelected={site.id === selectedSiteId}
            onSelect={() => setSelection({ kind: "archaeology", id: site.id })}
          />
        ))}
      </div>

      {selectedSite && (
        <div className="archaeology-detail">
          <h3>{selectedSite.name_display}</h3>
          <div className="badge-row">
            <Badge>{SITE_TYPE_LABELS[selectedSite.site_type] ?? selectedSite.site_type}</Badge>
            <Badge>AD {selectedSite.year_start}{selectedSite.year_end ? `–${selectedSite.year_end}` : "+"}</Badge>
            <Badge>{STATUS_LABELS[selectedSite.current_status] ?? selectedSite.current_status}</Badge>
            <Badge>{selectedSite.city_ancient}</Badge>
          </div>
          <p>{selectedSite.description}</p>
          {selectedSite.significance && (
            <>
              <h4>Significance</h4>
              <p className="small">{selectedSite.significance}</p>
            </>
          )}
          {selectedSite.discovery_notes && (
            <>
              <h4>Discovery</h4>
              <p className="small">{selectedSite.discovery_notes}</p>
            </>
          )}
          {selectedSite.uncertainty && (
            <>
              <h4>Uncertainty</h4>
              <p className="small">{selectedSite.uncertainty}</p>
            </>
          )}
          <CitationList urls={selectedSite.citations} />
        </div>
      )}
    </div>
  );
}

function ArchaeologyCard({
  site,
  isSelected,
  onSelect,
}: {
  site: ArchaeologySite;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`event-card ${isSelected ? "event-card-selected" : ""}`}
      onClick={onSelect}
    >
      <div className="event-card-header">
        <strong>{site.name_display}</strong>
        <span className="muted small">AD {site.year_start}</span>
      </div>
      <div className="badge-row">
        <Badge>{SITE_TYPE_LABELS[site.site_type] ?? site.site_type}</Badge>
        <Badge>{site.city_ancient}</Badge>
      </div>
      <p className="small">{site.description.slice(0, 120)}...</p>
    </div>
  );
}
