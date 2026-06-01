import { create } from "zustand";

export type ComputerFile = {
  name: string;
  type: "html" | "data" | "md" | "js" | "css" | "txt";
  content: string;
  sizeKB: number;
};

interface FilesState {
  files: ComputerFile[];
  add: (f: ComputerFile) => void;
  clear: () => void;
}

export const useComputerFiles = create<FilesState>((set) => ({
  files: [],
  add: (f) =>
    set((s) => ({
      files: [...s.files.filter((x) => x.name !== f.name), f],
    })),
  clear: () => set({ files: [] }),
}));
