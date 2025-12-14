import { open } from "@tauri-apps/plugin-shell";
import { HubSpotObjectsPopover } from "@/components/HubSpotObjectsSheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "../hooks/useAuth";
import { useHeaderStore } from "../stores/headerStore";

export function Header() {
  const { portalInfo, logout } = useAuth();
  const { centerMessage } = useHeaderStore();

  return (
    <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 relative">
          {centerMessage && (
            <div className="absolute left-1/2 transform -translate-x-1/2 text-sm font-medium text-foreground">
              {centerMessage}
            </div>
          )}
          <div className="flex items-center space-x-3">
            {portalInfo?.portal_id && portalInfo?.ui_domain && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-chart-2 rounded-full" />
                <button
                  type="button"
                  onClick={() =>
                    open(
                      `https://${portalInfo.ui_domain}/settings/${portalInfo.portal_id}/account-defaults/general`,
                    )
                  }
                  className="text-sm text-muted-foreground hover:text-foreground underline decoration-muted-foreground/40 hover:decoration-foreground/60 transition-colors"
                >
                  Portal: {portalInfo.portal_id}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <HubSpotObjectsPopover />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {logout.isPending ? "ログアウト中..." : "ログアウト"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
