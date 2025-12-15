import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function useUpdater() {
  const [hasChecked, setHasChecked] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (hasChecked) return;

    try {
      setHasChecked(true);
      console.log("Checking for updates...");
      const update = await check();
      console.log("Update check result:", update);

      if (update) {
        toast.info(`v${update.version} が利用可能`, {
          duration: 30000,
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
            label: "後で",
            onClick: () => {
              toast.dismiss();
            },
          },
        });
      } else {
        console.log("No updates available");
      }
    } catch (error) {
      console.error("Update check failed:", error);
    }
  }, [hasChecked]);

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return { checkForUpdates, hasChecked };
}
