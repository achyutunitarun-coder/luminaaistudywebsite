// Global offline banner — listens to the browser's online/offline events
// and shows a fixed banner at the top of the viewport when the device
// is offline. Read-only mode hint for the rest of the app.

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-[12.5px] font-medium text-amber-100 backdrop-blur-md"
      style={{
        background: "linear-gradient(180deg, rgba(146,64,14,0.95), rgba(120,53,15,0.92))",
        borderBottom: "0.5px solid rgba(252,211,77,0.35)",
        boxShadow: "0 4px 20px -8px rgba(0,0,0,0.4)",
      }}
    >
      <WifiOff className="w-3.5 h-3.5" />
      You're offline — showing your last saved content. Generation is paused
      until your connection returns.
    </div>
  );
}
