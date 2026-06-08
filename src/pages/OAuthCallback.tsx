import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { exchangeOAuth } from "@/lib/connectors/api";
import { toast } from "sonner";

interface Props { provider: "google" | "notion"; }

const hasScopeFor = (scopes: string[] | undefined, service: string) => {
  const joined = (scopes ?? []).join(" ");
  if (service === "gmail") return /gmail/.test(joined);
  if (service === "calendar") return /calendar/.test(joined);
  if (service === "drive") return /drive|documents/.test(joined);
  return true;
};

export default function OAuthCallback({ provider }: Props) {
  const nav = useNavigate();
  const loc = useLocation();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Connecting…");

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const code = params.get("code");
    const err = params.get("error");
    if (err) {
      setStatus("error");
      setMessage(err);
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("Missing authorization code.");
      return;
    }
    (async () => {
      try {
        const r = await exchangeOAuth(provider, code);
        if (provider === "google") {
          const pending = JSON.parse(sessionStorage.getItem("lumina_google_pending_services") || "[]") as string[];
          const missing = pending.filter((service) => !hasScopeFor(r.scopes, service));
          sessionStorage.removeItem("lumina_google_pending_services");
          if (missing.length) {
            throw new Error(`Google did not grant ${missing.join(", ")} permission. Reconnect and approve every requested checkbox on the Google screen.`);
          }
        }
        setStatus("ok");
        setMessage(`Connected${r.account_email ? ` as ${r.account_email}` : ""}.`);
        toast.success(`${provider === "google" ? "Google" : "Notion"} connected`);
        const back = sessionStorage.getItem("lumina_oauth_return") || "/chat";
        sessionStorage.removeItem("lumina_oauth_return");
        setTimeout(() => nav(back, { replace: true }), 900);
      } catch (e) {
        setStatus("error");
        setMessage(String(e));
      }
    })();
  }, [loc.search, provider, nav]);

  return (
    <div className="min-h-screen bg-[#050508] grid place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 text-center">
        {status === "working" && <Loader2 className="w-8 h-8 mx-auto text-teal-400 animate-spin" />}
        {status === "ok" && <CheckCircle2 className="w-8 h-8 mx-auto text-teal-400" />}
        {status === "error" && <AlertTriangle className="w-8 h-8 mx-auto text-rose-400" />}
        <h1 className="mt-4 text-[16px] font-medium text-white/90">
          {status === "working" ? "Finishing connection" : status === "ok" ? "All set" : "Connection failed"}
        </h1>
        <p className="mt-2 text-[12.5px] text-white/55 break-words">{message}</p>
        {status === "error" && (
          <button
            onClick={() => nav("/connectors")}
            className="mt-5 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/85 text-[12.5px]"
          >
            Back to connectors
          </button>
        )}
      </div>
    </div>
  );
}
