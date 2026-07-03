import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WorkspaceEntry {
  key: string;
  value: unknown;
  type: "artifact" | "file" | "session";
  mode?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ArtifactPreview {
  id: string;
  type: string;
  title: string;
  format: string;
  snippet: string;
  exports: string[];
  createdAt: number;
  expanded?: boolean;
}

export interface ExportAction {
  format: string;
  label: string;
  action: "download" | "google_push" | "preview";
  url?: string;
}

interface WorkspaceState {
  entries: WorkspaceEntry[];
  sessionId: string | null;
  activeArtifactId: string | null;
  artifactPreviews: ArtifactPreview[];
  setSession: (id: string) => void;
  put: (key: string, value: unknown, type: WorkspaceEntry["type"], mode?: string) => void;
  get: <T = unknown>(key: string) => T | undefined;
  getAllByMode: (mode: string) => WorkspaceEntry[];
  getAllByType: (type: WorkspaceEntry["type"]) => WorkspaceEntry[];
  delete: (key: string) => void;
  clear: () => void;
  setActiveArtifact: (id: string | null) => void;
  addArtifactPreview: (preview: ArtifactPreview) => void;
  removeArtifactPreview: (id: string) => void;
  toggleArtifactExpand: (id: string) => void;
  getExportActions: (type: string) => ExportAction[];
}

const EXPORT_MAP: Record<string, ExportAction[]> = {
  slide: [
    { format: "pptx", label: "Download PPTX", action: "download" },
    { format: "google_slides", label: "Push to Google Slides", action: "google_push" },
    { format: "html", label: "Preview HTML", action: "preview" },
    { format: "pdf", label: "Download PDF", action: "download" },
  ],
  doc: [
    { format: "docx", label: "Download DOCX", action: "download" },
    { format: "google_docs", label: "Push to Google Docs", action: "google_push" },
    { format: "pdf", label: "Download PDF", action: "download" },
    { format: "md", label: "Download Markdown", action: "download" },
  ],
  sheet: [
    { format: "xlsx", label: "Download XLSX", action: "download" },
    { format: "google_sheets", label: "Push to Google Sheets", action: "google_push" },
    { format: "csv", label: "Download CSV", action: "download" },
    { format: "html", label: "Preview HTML", action: "preview" },
  ],
  research: [
    { format: "md", label: "Download Markdown", action: "download" },
    { format: "html", label: "Preview HTML", action: "preview" },
    { format: "pdf", label: "Download PDF", action: "download" },
  ],
  website: [
    { format: "html", label: "Preview Website", action: "preview" },
    { format: "html", label: "Download HTML", action: "download" },
  ],
};

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      entries: [],
      sessionId: null,
      activeArtifactId: null,
      artifactPreviews: [],

      setSession: (id: string) => set({ sessionId: id }),

      put: (key: string, value: unknown, type: WorkspaceEntry["type"], mode?: string) => {
        const existing = get().entries.findIndex((e) => e.key === key);
        const entry: WorkspaceEntry = {
          key, value, type, mode,
          createdAt: existing >= 0 ? get().entries[existing].createdAt : Date.now(),
          updatedAt: Date.now(),
        };
        if (existing >= 0) {
          const updated = [...get().entries];
          updated[existing] = entry;
          set({ entries: updated });
        } else {
          set({ entries: [...get().entries, entry] });
        }
      },

      get: <T = unknown>(key: string): T | undefined => {
        return get().entries.find((e) => e.key === key)?.value as T | undefined;
      },

      getAllByMode: (mode: string) => get().entries.filter((e) => e.mode === mode),

      getAllByType: (type: WorkspaceEntry["type"]) => get().entries.filter((e) => e.type === type),

      delete: (key: string) => set({ entries: get().entries.filter((e) => e.key !== key) }),

      clear: () => set({ entries: [], artifactPreviews: [], activeArtifactId: null }),

      setActiveArtifact: (id: string | null) => set({ activeArtifactId: id }),

      addArtifactPreview: (preview: ArtifactPreview) => {
        const existing = get().artifactPreviews.findIndex((p) => p.id === preview.id);
        if (existing >= 0) {
          const updated = [...get().artifactPreviews];
          updated[existing] = { ...updated[existing], ...preview };
          set({ artifactPreviews: updated });
        } else {
          set({ artifactPreviews: [...get().artifactPreviews, preview] });
        }
      },

      removeArtifactPreview: (id: string) => {
        set({ artifactPreviews: get().artifactPreviews.filter((p) => p.id !== id) });
      },

      toggleArtifactExpand: (id: string) => {
        set({
          artifactPreviews: get().artifactPreviews.map((p) =>
            p.id === id ? { ...p, expanded: !p.expanded } : p
          ),
        });
      },

      getExportActions: (type: string): ExportAction[] => {
        return EXPORT_MAP[type] ?? [{ format: "json", label: "Export JSON", action: "download" }];
      },
    }),
    {
      name: "lumina-workspace",
      partialize: (state) => ({
        entries: state.entries,
        sessionId: state.sessionId,
        artifactPreviews: state.artifactPreviews,
      }),
    },
  ),
);

export const frontendArtifactStore = {
  set(key: string, value: unknown, mode: string) {
    useWorkspace.getState().put(key, value, "artifact", mode);
  },

  get<T = unknown>(key: string): T | undefined {
    return useWorkspace.getState().get<T>(key);
  },

  getLatestByMode<T = unknown>(mode: string): { key: string; value: T } | undefined {
    const entries = useWorkspace.getState().getAllByMode(mode);
    if (entries.length === 0) return undefined;
    const latest = entries.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return { key: latest.key, value: latest.value as T };
  },

  addPreview(preview: ArtifactPreview) {
    useWorkspace.getState().addArtifactPreview(preview);
  },

  getPreviews(): ArtifactPreview[] {
    return useWorkspace.getState().artifactPreviews;
  },
};
