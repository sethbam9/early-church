import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

type WikiMode = "browse" | "audit";
type BrowseSelection = { kind: string; id: string };

export type { WikiMode, BrowseSelection };

export function useWikiPageState() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<WikiMode>("browse");
  const [entityKind, setEntityKind] = useState("person");
  const [search, setSearch] = useState("");
  const lastHandledParam = useRef("");

  // Selection history stack
  const [selection, setSelection] = useState<BrowseSelection | null>(null);
  const [history, setHistory] = useState<BrowseSelection[]>([]);

  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"relations" | "claims">("claims");

  // Handle deep-link from URL params (e.g. /wiki?kind=person&id=paul-of-tarsus)
  useEffect(() => {
    const kind = searchParams.get("kind");
    const id = searchParams.get("id");
    if (!kind || !id) return;
    const paramKey = `${kind}:${id}`;
    if (paramKey === lastHandledParam.current) return;
    lastHandledParam.current = paramKey;
    setMode("browse");
    setEntityKind(kind);
    setSelection({ kind, id });
    setHistory([]);
    setSelectedClaimId(null);
  }, [searchParams]);

  const pushSelection = useCallback((sel: BrowseSelection) => {
    setSelection((prev) => {
      if (prev) setHistory((h) => [...h, prev]);
      return sel;
    });
    setSelectedClaimId(null);
  }, []);

  const popSelection = useCallback(() => {
    setHistory((h) => {
      const newH = [...h];
      const prev = newH.pop() ?? null;
      setSelection(prev);
      return newH;
    });
    setSelectedClaimId(null);
  }, []);

  const handleSelectEntity = useCallback((kind: string, id: string) => {
    // Prevent nested selection if already viewing this entity
    if (selection?.kind === kind && selection?.id === id) return;
    setMode("browse");
    setEntityKind((prev) => {
      if (kind !== prev) setSearch("");
      return kind;
    });
    pushSelection({ kind, id });
  }, [pushSelection, selection]);

  const handleSelectClaim = useCallback((claimId: string) => {
    setSelectedClaimId(claimId);
  }, []);

  const selectEntityKind = useCallback((kind: string) => {
    setEntityKind(kind);
    setSelection(null);
    setHistory([]);
    setSearch("");
    setSelectedClaimId(null);
  }, []);

  return {
    // Mode
    mode, setMode,
    // Entity kind / search
    entityKind, selectEntityKind,
    search, setSearch,
    // Selection
    selection, history, pushSelection, popSelection,
    // Claim detail
    selectedClaimId, setSelectedClaimId,
    handleSelectEntity, handleSelectClaim,
    // View mode
    viewMode, setViewMode,
  };
}
