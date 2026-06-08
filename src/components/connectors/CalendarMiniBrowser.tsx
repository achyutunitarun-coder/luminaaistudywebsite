import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus } from "lucide-react";
import { MiniBrowserShell } from "./MiniBrowserShell";
import { calendarApi } from "@/lib/connectors/api";
import type { ContextBlock } from "@/lib/connectors/contextBlock";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (block: ContextBlock) => void;
}

const COLOR_MAP: Record<string, string> = {
  "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73",
  "5": "#f6bf26", "6": "#f4511e", "7": "#039be5", "8": "#616161",
  "9": "#3f51b5", "10": "#0b8043", "11": "#d50000",
};

function fmtTime(iso?: string) {
  if (!iso) return "All day";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CalendarMiniBrowser({ open, onClose, onInsert }: Props) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ topic: "", date: "", time: "09:00", minutes: 50 });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await calendarApi.list();
        if (!alive) return;
        setEvents(r.data?.items ?? []);
      } catch (e) {
        toast.error("Could not load Calendar", { description: String(e) });
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [open]);

  const insertEvent = (e: any) => {
    const start = e.start?.dateTime ?? e.start?.date ?? "";
    const end = e.end?.dateTime ?? e.end?.date ?? "";
    const content = `Event: ${e.summary ?? "Untitled"}\nWhen: ${start} → ${end}\n${e.location ? `Where: ${e.location}\n` : ""}${e.description ? `\n${e.description}` : ""}`;
    onInsert({
      id: `cal-${e.id}`,
      service: "calendar",
      sourceLabel: `Calendar · ${e.summary ?? "Event"}`,
      title: e.summary ?? "Event",
      preview: `${new Date(start).toLocaleString()}`,
      content,
      url: e.htmlLink,
    });
    onClose();
  };

  const createStudyBlock = async () => {
    if (!form.topic.trim() || !form.date) return;
    const start = new Date(`${form.date}T${form.time}:00`);
    const end = new Date(start.getTime() + form.minutes * 60_000);
    try {
      const r = await calendarApi.create({
        summary: `Lumina · ${form.topic}`,
        description: "Created from Lumina AI",
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        colorId: "7",
      });
      if (!r.ok) throw new Error(JSON.stringify(r.data));
      toast.success("Study block added to your calendar");
      setCreating(false);
      setForm({ topic: "", date: "", time: "09:00", minutes: 50 });
      const list = await calendarApi.list();
      setEvents(list.data?.items ?? []);
    } catch (e) {
      toast.error("Couldn't create event", { description: String(e) });
    }
  };

  return (
    <MiniBrowserShell open={open} onClose={onClose} title="Google Calendar" emoji="📅">
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-white/40">Today & tomorrow</span>
        <button
          onClick={() => setCreating((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-teal-300 hover:text-teal-200 font-medium"
        >
          <Plus className="w-3 h-3" />Add study block
        </button>
      </div>

      {creating && (
        <div className="mx-4 mb-3 p-3 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] space-y-2">
          <input
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Topic (e.g. Organic chem revision)"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-1.5 text-[12px] text-white/90 outline-none focus:border-teal-400/40"
          />
          <div className="grid grid-cols-3 gap-2">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-1.5 text-[12px] text-white/90 outline-none" />
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-1.5 text-[12px] text-white/90 outline-none" />
            <select value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
              className="bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-1.5 text-[12px] text-white/90 outline-none">
              {[25, 50, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </div>
          <button
            onClick={createStudyBlock}
            className="w-full mt-1 px-3 py-1.5 rounded-md bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-100 text-[12px] font-medium"
          >Create</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 text-white/55 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}
      {!loading && (
        <div className="divide-y divide-white/[0.04] pb-2">
          {events.length === 0 && (
            <div className="px-4 py-8 text-center text-white/45 text-sm">No upcoming events.</div>
          )}
          {events.map((e: any) => {
            const color = COLOR_MAP[e.colorId] ?? "#7986cb";
            const start = e.start?.dateTime ?? e.start?.date;
            return (
              <button
                key={e.id}
                onClick={() => insertEvent(e)}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                  <span className="text-[12.5px] font-medium text-white/85 truncate flex-1">{e.summary ?? "(untitled)"}</span>
                  <span className="text-[11px] text-white/45 tabular-nums">{fmtTime(start)}</span>
                </div>
                {e.location && (
                  <div className="ml-4 mt-0.5 flex items-center gap-1 text-[11px] text-white/45">
                    <MapPin className="w-2.5 h-2.5" />{e.location}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </MiniBrowserShell>
  );
}
