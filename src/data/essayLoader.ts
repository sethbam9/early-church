import { ESSAYS } from "./essays";

export interface Essay {
  id: string;
  title: string;
  summary: string;
  body: string;
}

export async function loadEssay(id: string): Promise<Essay | null> {
  const essay = ESSAYS.find(e => e.id === id);
  return essay || null;
}

export async function getAllEssays(): Promise<Essay[]> {
  return ESSAYS;
}

