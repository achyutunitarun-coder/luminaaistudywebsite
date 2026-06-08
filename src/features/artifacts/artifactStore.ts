import { create } from "zustand";

export type ArtifactKind = "notes" | "exam" | "slides" | "code";

export interface ArtifactVersion {
  id: string;
  html: string;
  summary: string;
  createdAt: number;
  author: "AI" | "User";
}

export interface LinkedContextMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ArtifactRecord {
  id: string;
  type: ArtifactKind;
  title: string;
  html: string;
  createdAt: number;
  updatedAt: number;
  sourceMessageId: string;
  versions: ArtifactVersion[];
  contextMessageIds: string[];
}

type UpsertInput = {
  id: string;
  type: ArtifactKind;
  title: string;
  html: string;
  createdAt: number;
  sourceMessageId: string;
  contextMessageIds?: string[];
  summary?: string;
};

interface ArtifactState {
  artifacts: Record<string, ArtifactRecord>;
  order: string[];
  activeArtifactId: string | null;
  spotlight: boolean;
  upsertArtifact: (artifact: UpsertInput) => void;
  openArtifact: (id: string) => void;
  closeArtifact: () => void;
  toggleSpotlight: () => void;
}

const sameArtifact = (a: ArtifactRecord, b: UpsertInput) =>
  a.type === b.type && a.title.trim().toLowerCase() === b.title.trim().toLowerCase();

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  artifacts: {},
  order: [],
  activeArtifactId: null,
  spotlight: false,
  upsertArtifact: (input) => {
    const state = get();
    const existingId = state.order.find((id) => sameArtifact(state.artifacts[id], input));
    const id = existingId ?? input.id;
    const existing = existingId ? state.artifacts[existingId] : undefined;
    const alreadyHasVersion = existing?.versions.some((v) => v.html === input.html);
    const version: ArtifactVersion = {
      id: `${input.id}-${input.createdAt}`,
      html: input.html,
      summary: input.summary ?? (existing ? "Updated artifact" : "Created artifact"),
      createdAt: input.createdAt,
      author: "AI",
    };

    const record: ArtifactRecord = existing
      ? {
          ...existing,
          html: input.html,
          updatedAt: input.createdAt,
          sourceMessageId: input.sourceMessageId,
          versions: alreadyHasVersion ? existing.versions : [...existing.versions, version].slice(-30),
          contextMessageIds: Array.from(new Set([...(existing.contextMessageIds ?? []), ...(input.contextMessageIds ?? [])])),
        }
      : {
          id,
          type: input.type,
          title: input.title || "Untitled artifact",
          html: input.html,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
          sourceMessageId: input.sourceMessageId,
          versions: [version],
          contextMessageIds: input.contextMessageIds ?? [],
        };

    set({
      artifacts: { ...state.artifacts, [id]: record },
      order: existingId ? state.order : [id, ...state.order],
    });
  },
  openArtifact: (id) => set({ activeArtifactId: id }),
  closeArtifact: () => set({ activeArtifactId: null, spotlight: false }),
  toggleSpotlight: () => set((s) => ({ spotlight: !s.spotlight })),
}));
