import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function useUpdater() {
  const [checking, setChecking] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (checking) return;

    try {
      setChecking(true);
      const update = await check();

      if (update?.available) {
        toast.info(`新しいバージョン ${update.version} が利用可能です`, {
          description: "ダウンロードとインストールを開始します...",
          duration: 5000,
        });

        await update.downloadAndInstall();

        toast.success("更新が完了しました", {
          description: "アプリを再起動します...",
          duration: 3000,
        });

        setTimeout(async () => {
          await relaunch();
        }, 3000);
      }
    } catch (error) {
      console.error("Update check failed:", error);
    } finally {
      setChecking(false);
    }
  }, [checking]);

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return { checkForUpdates, checking };
}
