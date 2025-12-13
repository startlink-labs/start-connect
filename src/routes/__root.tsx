import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { HubSpotObjectsPopover } from "@/components/HubSpotObjectsSheet";

function RootLayout() {
	const { isAuthenticated, user, logout } = useAuth();

	return (
		<div className="min-h-screen bg-gray-50">
			{isAuthenticated && (
				<header className="bg-white border-b border-gray-200">
					<div className="px-6">
						<div className="flex justify-between items-center py-3">
							{user?.portal_id && (
								<div className="text-sm text-gray-600">
									Portal ID: <span className="font-medium">{user.portal_id}</span>
								</div>
							)}
							<div className="flex items-center gap-2">
								<HubSpotObjectsPopover />
								<Button onClick={logout} variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
									ログアウト
								</Button>
							</div>
						</div>
					</div>
				</header>
			)}
			<Outlet />
			<TanStackRouterDevtools />
		</div>
	);
}

export const Route = createRootRoute({
	component: RootLayout,
});