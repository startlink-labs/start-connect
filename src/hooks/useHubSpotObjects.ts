import { useState, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { invoke } from "@tauri-apps/api/core";

interface HubSpotObject {
  object_type_id: string;
  name: string;
  label: string;
}

export function useHubSpotObjects() {
  const { isAuthenticated } = useAuth();
  const [objects, setObjects] = useState<HubSpotObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchObjects = async () => {
    if (!isAuthenticated || fetchedRef.current) return;

    setLoading(true);
    setError(null);
    fetchedRef.current = true;

    try {
      const objects = (await invoke("get_hubspot_objects")) as HubSpotObject[];
      setObjects(objects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      fetchedRef.current = false; // エラー時は再試行を許可
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !fetchedRef.current) {
      fetchObjects();
    }
  }, [isAuthenticated]);

  const refetch = () => {
    fetchedRef.current = false;
    fetchObjects();
  };

  return { objects, loading, error, refetch };
}
