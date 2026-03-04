export interface Essay {
  id: string;
  title: string;
  summary: string;
  body: string;
}

// Simple essay metadata - in a real app this could be loaded from a manifest
export const ESSAY_METADATA = [
  {
    id: "infant-baptism",
    filename: "infant-baptism.md",
  },
];

// Cache for loaded essays
const essayCache = new Map<string, Essay>();

export async function loadEssay(id: string): Promise<Essay | null> {
  if (essayCache.has(id)) {
    return essayCache.get(id)!;
  }

  const meta = ESSAY_METADATA.find(e => e.id === id);
  if (!meta) return null;

  try {
    const response = await fetch(`/data/essays/${meta.filename}`);
    if (!response.ok) return null;
    
    const content = await response.text();
    
    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) return null;
    
    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2];
    
    if (!frontmatter || !body) return null;
    
    // Parse YAML frontmatter (simple implementation)
    const titleMatch = frontmatter.match(/title:\s*"([^"]+)"/);
    const summaryMatch = frontmatter.match(/summary:\s*"([^"]+)"/);
    
    const essay: Essay = {
      id,
      title: titleMatch?.[1] || id,
      summary: summaryMatch?.[1] || "",
      body: body.trim(),
    };
    
    essayCache.set(id, essay);
    return essay;
  } catch (error) {
    console.error(`Failed to load essay ${id}:`, error);
    return null;
  }
}

export async function getAllEssays(): Promise<Essay[]> {
  const essays: Essay[] = [];
  for (const meta of ESSAY_METADATA) {
    const essay = await loadEssay(meta.id);
    if (essay) essays.push(essay);
  }
  return essays;
}
