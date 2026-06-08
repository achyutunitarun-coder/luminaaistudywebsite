// Lumina Connector registry. Add a service here, give it an icon emoji
// (mini-browsers render their own logos in components) and it appears
// everywhere.

export type ConnectorProvider = "google" | "notion";
export type ConnectorServiceId = "gmail" | "calendar" | "drive" | "notion";
export type ConnectorCategory = "Email" | "Calendar" | "Storage" | "Productivity";

export interface ConnectorService {
  id: ConnectorServiceId;
  provider: ConnectorProvider;          // OAuth flow used
  label: string;
  description: string;
  category: ConnectorCategory;
  emoji: string;                         // fallback icon
  accent: string;                        // tailwind text class
  available: boolean;                    // false = coming soon
  googleService?: "gmail" | "calendar" | "drive";  // for google connections
}

export const CONNECTORS: ConnectorService[] = [
  {
    id: "gmail", provider: "google", googleService: "gmail",
    label: "Gmail", description: "Read, summarize, and compose emails.",
    category: "Email", emoji: "✉️", accent: "text-rose-300", available: true,
  },
  {
    id: "calendar", provider: "google", googleService: "calendar",
    label: "Google Calendar", description: "See today's schedule and add study blocks.",
    category: "Calendar", emoji: "📅", accent: "text-sky-300", available: true,
  },
  {
    id: "drive", provider: "google", googleService: "drive",
    label: "Google Drive", description: "Pull notes and PDFs straight into chat.",
    category: "Storage", emoji: "📂", accent: "text-amber-300", available: true,
  },
  {
    id: "notion", provider: "notion",
    label: "Notion", description: "Reference any page from your workspace.",
    category: "Productivity", emoji: "📝", accent: "text-white", available: true,
  },
];

export const GOOGLE_REDIRECT_PATH = "/oauth/google/callback";
export const NOTION_REDIRECT_PATH = "/oauth/notion/callback";

export function redirectUri(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
