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
          description: update.body || "更新内容を確認してください",
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: "今すぐ更新",
            onClick: async () => {
              toast.loading("更新をダウンロード中...", {
                id: "update-download",
              });
              await update.downloadAndInstall();
              toast.success("更新が完了しました。再起動します...", {
                id: "update-download",
              });
              setTimeout(async () => {
                await relaunch();
              }, 2000);
            },
          },
          cancel: {
            label: "次回起動時に更新",
            onClick: () => {
              toast.dismiss();
            },
          },
        });
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
