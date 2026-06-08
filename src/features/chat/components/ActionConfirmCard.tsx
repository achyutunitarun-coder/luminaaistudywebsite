import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import type { AgentAction } from "@/lib/agent/actions";
import { describeAction } from "@/lib/agent/actions";

interface Props {
  action: AgentAction;
  summary?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  done?: boolean;
}

export const ActionConfirmCard = ({ action, summary, onConfirm, onCancel, done }: Props) => {
  const [running, setRunning] = useState(false);
  const [resolved, setResolved] = useState(false);
  const { title, details } = describeAction(action);

  const handleConfirm = async () => {
    setRunning(true);
    try {
      await onConfirm();
      setResolved(true);
    } finally {
      setRunning(false);
    }
  };

  const handleCancel = () => {
    setResolved(true);
    onCancel();
  };

  const finished = done || resolved;

  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary grid place-items-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-sm font-semibold">{title}</div>
        </div>
        {summary && <div className="text-sm text-foreground/90 mb-2">{summary}</div>}
        <ul className="text-xs text-muted-foreground space-y-1 mb-3 pl-1">
          {details.map((d, i) => (
            <li key={i} className="font-mono leading-relaxed">{d}</li>
          ))}
        </ul>
        {!finished ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={running}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              {running ? "Working…" : "Confirm & run"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={running}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-3 h-3" /> Cancel
            </button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">
            {resolved ? "Handled." : "Done."}
          </div>
        )}
      </div>
    </div>
  );
};
