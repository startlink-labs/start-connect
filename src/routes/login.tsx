import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "../hooks/useAuth";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { isAuthenticated, isLoading: authLoading, refetch } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const processedRef = useRef(false);

  /**
   * Deep Linkで受け取ったOAuthコールバックURLを処理する
   */
  useEffect(() => {
    const unlisten = listen<string[]>("deep-link-urls", async (event) => {
      if (processedRef.current) return;

      const urls = event.payload;
      if (!urls || !urls[0]?.startsWith("sfhsfiletrans://oauth/callback"))
        return;

      processedRef.current = true;
      console.log("[DeepLink] Processing:", urls[0]);
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
        setError(err instanceof Error ? err.message : "認証処理に失椱しました");
        setIsLoading(false);
        processedRef.current = false;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [navigate, refetch]);

  /**
   * OAuthログインを開始する
   */
  const handleOAuthLogin = async () => {
    setIsLoading(true);
    setError("");
    processedRef.current = false;
    try {
      const authUrl = await invoke<string>("start_oauth_flow");
      await open(authUrl);
    } catch (_err) {
      setError("認証の開始に失敗しました");
      setIsLoading(false);
    }
  };

  /**
   * 認証をキャンセルする
   */
  const handleCancelAuth = () => {
    setIsLoading(false);
    setError("");
    processedRef.current = false;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner className="size-8" />
          <p className="text-sm text-muted-foreground">認証情報を確認中</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>HubSpot認証</CardTitle>
          <CardDescription>
            HubSpotアカウントでログインしてください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button
              onClick={handleOAuthLogin}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? "認証中..." : "HubSpotでログイン"}
            </Button>
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">
                ブラウザでHubSpot認証ページが開きます
              </p>
              {isLoading && (
                <button
                  type="button"
                  onClick={handleCancelAuth}
                  className="text-xs text-center text-muted-foreground hover:text-foreground underline w-full"
                >
                  認証をキャンセルして再試行
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
