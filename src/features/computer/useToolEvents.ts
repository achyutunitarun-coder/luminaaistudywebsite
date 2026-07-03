/**
 * Reactive store wrapping the ToolEventLog for UI consumption.
 */
import { create } from "zustand";
import { toolEventLog, createToolEvent, type ToolCategory, type ToolEvent } from "./toolEvents";

interface ToolEventState {
  events: ToolEvent[];
  add: (toolName: string, input: string) => string;
  update: (id: string, partial: Partial<ToolEvent>) => void;
  clear: () => void;
  getByCategory: (cat: ToolCategory) => ToolEvent[];
  getSummary: () => Record<string, number>;
}

export const useToolEvents = create<ToolEventState>((set, get) => ({
  events: [],

  add: (toolName: string, input: string) => {
    const event = createToolEvent(toolName, input);
    toolEventLog.push(event);
    set({ events: toolEventLog.getAll() });
    return event.id;
  },

  update: (id: string, partial: Partial<ToolEvent>) => {
    toolEventLog.update(id, partial);
    set({ events: toolEventLog.getAll() });
  },

  clear: () => {
    toolEventLog.clear();
    set({ events: [] });
  },

  getByCategory: (cat: ToolCategory) => {
    return toolEventLog.getByCategory(cat);
  },

  getSummary: () => {
    return toolEventLog.getSummary();
  },
}));
