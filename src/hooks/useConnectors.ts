import { useCallback, useEffect, useState } from "react";
import { listConnections, type UserConnection } from "@/lib/connectors/api";
import type { ConnectorProvider, ConnectorServiceId } from "@/lib/connectors/config";

export function useConnectors() {
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setConnections(await listConnections());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const isConnected = useCallback(
    (provider: ConnectorProvider) => connections.some((c) => c.provider === provider),
    [connections],
  );

  const isServiceConnected = useCallback(
    (service: ConnectorServiceId) => {
      if (service === "notion") return connections.some((c) => c.provider === "notion");
      const google = connections.find((c) => c.provider === "google");
      if (!google) return false;
      // crude scope check
      const scopes = (google.scopes ?? []).join(" ");
      if (service === "gmail") return /gmail/.test(scopes);
      if (service === "calendar") return /calendar/.test(scopes);
      if (service === "drive") return /drive/.test(scopes);
      return false;
    },
    [connections],
  );

  return { connections, loading, refresh, isConnected, isServiceConnected };
}
