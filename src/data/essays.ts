// ─── Essay data types and content ────────────────────────────────────────────

export interface Essay {
  id: string;
  title: string;
  summary: string;
  body: string;
}

// Link syntax: [[kind:id|label]]
// Supported kinds: city, person, work, doctrine, event, persuasion, polity, archaeology

// ─── Load raw .md bodies from data/essays/ via Vite glob ─────────────────────

const rawMd = import.meta.glob("../../data/essays/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function getBody(id: string): string {
  const key = Object.keys(rawMd).find((k) => k.endsWith(`/${id}.md`));
  if (!key) return "";
  // Strip the leading H1 title line (already shown in the UI)
  return (rawMd[key] ?? "").replace(/^# .+\n\n?/, "");
}

// ─── Essay metadata ───────────────────────────────────────────────────────────

interface EssayMeta {
  id: string;
  title: string;
  summary: string;
}

const ESSAY_META: EssayMeta[] = [
  {
    id: "infant-baptism",
    title: "Infant Baptism in the Early Church",
    summary:
      "Tracing the evidence for infant baptism from the apostolic era through the fourth century, drawing on New Testament household baptisms, patristic testimony, and archaeological evidence.",
  },
  {
    id: "church-went-astray",
    title: "Did the Church Go Astray?",
    summary:
      "Examining the historical claim that the post-apostolic church apostatized from the original faith, through careful analysis of Paul's warnings, the Apostolic Fathers, and the fate of the Seven Churches of Revelation.",
  },
  {
    id: "religion-of-the-apostles",
    title: "The Religion of the Apostles",
    summary:
      "How Second Temple Jewish worship shaped every dimension of early Christian practice—structured prayer, sacrifice, sacred meals, cosmic liturgy—and what archaeology reveals about the physical world in which the apostles lived and worshipped.",
  },
  {
    id: "eucharist-center",
    title: "The Eucharist Is the Center",
    summary:
      "From Paul's earliest written account in 54 CE to the altar mosaics of the third century, the Eucharist was not one practice among many—it was the central, weekly, non-negotiable act of Christian worship.",
  },
  {
    id: "apostolic-succession",
    title: "Apostolic Succession and Oral Tradition",
    summary:
      "The chain of transmission from the apostles to their successors—what it meant, why it mattered, what oral tradition preserved beyond the written texts, and how the early church used succession lists as an accountability structure against Gnostic innovation.",
  },
];

export const ESSAYS: Essay[] = ESSAY_META.map((meta) => ({
  ...meta,
  body: getBody(meta.id),
}));
