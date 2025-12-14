import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import { useEffect, useRef, useState } from "react";

interface PortalInfo {
  portal_id: number;
  ui_domain: string;
}

export const useAuth = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["auth"],
    queryFn: (): Promise<PortalInfo | null> => invoke("is_authenticated"),
    staleTime: 5 * 60 * 1000,
  });

  const logout = useMutation({
    mutationFn: (): Promise<void> => invoke("logout"),
    onSuccess: async () => {
      queryClient.setQueryData(["auth"], null);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate({ to: "/login" });
    },
  });

  return {
    portalInfo: query.data,
    isAuthenticated: !!query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
    logout,
  };
};

export const useOAuthLogin = () => {
  const { refetch } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    const unlisten = listen<string[]>("deep-link-urls", async (event) => {
      if (processedRef.current) return;

      const urls = event.payload;
      if (!urls || !urls[0]?.startsWith("sfhsfiletrans://oauth/callback"))
        return;

      processedRef.current = true;
      setIsLoading(true);

      try {
        const url = new URL(urls[0]);
        const accessToken = url.searchParams.get("access_token");
        const refreshToken = url.searchParams.get("refresh_token");
        const expiresIn = url.searchParams.get("expires_in");
        const portalId = url.searchParams.get("portal_id");
        const uiDomain = url.searchParams.get("ui_domain");

        if (
          !accessToken ||
          !refreshToken ||
          !expiresIn ||
          !portalId ||
          !uiDomain
        ) {
          throw new Error("認証情報が不完全です");
        }

        await invoke("save_oauth_tokens", {
          accessToken,
          refreshToken,
          expiresIn: Number.parseInt(expiresIn, 10),
          portalId: Number.parseInt(portalId, 10),
          uiDomain,
        });

        await refetch();
        navigate({ to: "/dashboard" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "認証処理に失敗しました");
        setIsLoading(false);
        processedRef.current = false;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [navigate, refetch]);

  const startLogin = async () => {
    setIsLoading(true);
    setError("");
    processedRef.current = false;
    try {
      const authUrl = await invoke<string>("start_oauth_flow");
      await open(authUrl);
    } catch {
      setError("認証の開始に失敗しました");
      setIsLoading(false);
    }
  };

  const cancelLogin = () => {
    setIsLoading(false);
    setError("");
    processedRef.current = false;
  };

  return {
    isLoading,
    error,
    startLogin,
    cancelLogin,
  };
};
