import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { HubSpotObjectsPopover } from "@/components/HubSpotObjectsSheet";
import { open } from "@tauri-apps/plugin-shell";
import { useHeaderStore } from "../stores/headerStore";

export function Header() {
	const { portalInfo: user, logout } = useAuth();
	const { centerMessage } = useHeaderStore();

	const handleLogout = () => {
		logout.mutate();
	};

	return (
		<header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between items-center h-14 relative">
					{centerMessage && (
						<div className="absolute left-1/2 transform -translate-x-1/2 text-sm font-medium text-blue-600">
							{centerMessage}
						</div>
					)}
					<div className="flex items-center space-x-3">
						{user?.portal_id && user?.ui_domain && (
							<div className="flex items-center space-x-2">
								<div className="w-2 h-2 bg-green-500 rounded-full"></div>
								<button 
									onClick={() => open(`https://${user.ui_domain}/settings/${user.portal_id}/account-defaults/general`)}
									className="text-sm text-gray-600 hover:text-gray-900 underline decoration-gray-400 hover:decoration-gray-600 transition-colors cursor-pointer"
								>
									Portal: {user.portal_id}
								</button>
							</div>
						)}
					</div>
					<div className="flex items-center space-x-2">
						<HubSpotObjectsPopover />
						<Button 
							variant="ghost" 
							size="sm" 
							onClick={handleLogout}
							className="text-gray-600 hover:text-gray-900"
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