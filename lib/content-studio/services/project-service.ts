import { generateId } from "ai";
import { loadProjects, saveProjects } from "@/lib/content-studio/storage";
import type { ContentProject } from "@/lib/content-studio/types";

/**
 * Pure CRUD + query layer on top of `storage.ts`. UI components never touch
 * localStorage directly — everything goes through this service.
 */

export function createProject(titleHint?: string): ContentProject {
  const now = Date.now();
  const project: ContentProject = {
    id: generateId(),
    title: titleHint?.trim() || "Untitled project",
    titleMode: titleHint?.trim() ? "manual" : "auto",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  const all = loadProjects();
  saveProjects([...all, project]);
  return project;
}

export function listProjects(): ContentProject[] {
  return [...loadProjects()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getRecentProjects(limit = 5): ContentProject[] {
  return listProjects().slice(0, limit);
}

export function getProject(id: string): ContentProject | null {
  return loadProjects().find((p) => p.id === id) ?? null;
}

export function updateProject(
  id: string,
  patch: Partial<Omit<ContentProject, "id" | "createdAt">>,
): ContentProject | null {
  const all = loadProjects();
  let updated: ContentProject | null = null;
  const next = all.map((p) => {
    if (p.id !== id) return p;
    updated = { ...p, ...patch, updatedAt: Date.now() };
    return updated;
  });
  if (updated) saveProjects(next);
  return updated;
}

export function renameProject(id: string, title: string): void {
  const trimmed = title.trim();
  updateProject(id, {
    title: trimmed.length ? trimmed.slice(0, 120) : "Untitled project",
    titleMode: "manual",
  });
}

export function deleteProject(id: string): ContentProject[] {
  const next = loadProjects().filter((p) => p.id !== id);
  saveProjects(next);
  return next;
}

export function clearAllProjects(): void {
  saveProjects([]);
}

export function hasAnyProjects(): boolean {
  return loadProjects().length > 0;
}
