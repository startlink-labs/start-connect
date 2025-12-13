import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { invoke } from "@tauri-apps/api/core";

interface HubSpotObject {
  object_type_id: string;
  name: string;
  label: string;
}

interface HubSpotObjectsResponse {
  success: boolean;
  objects: HubSpotObject[];
  message: string;
}

export function useHubSpotObjects() {
  const { user } = useAuth();
  const [objects, setObjects] = useState<HubSpotObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchObjects = async () => {
    if (!user?.token) return;

    setLoading(true);
    setError(null);

    try {
      const objects = await invoke('get_hubspot_objects', {
        token: user.token
      }) as HubSpotObject[];
      
      setObjects(objects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchObjects();
    }
  }, [user?.token]);

  return { objects, loading, error, refetch: fetchObjects };
}