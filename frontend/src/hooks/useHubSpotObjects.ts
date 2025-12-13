import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

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
      const response = await fetch(
        `http://localhost:8000/api/v1/hubspot/objects?token=${encodeURIComponent(user.token)}`
      );

      if (!response.ok) {
        throw new Error("オブジェクト情報の取得に失敗しました");
      }

      const data: HubSpotObjectsResponse = await response.json();
      setObjects(data.objects);
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