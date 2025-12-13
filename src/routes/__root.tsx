import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useAuth } from "../hooks/useAuth";
import { Header } from "../components/Header";

function RootLayout() {
	const { isAuthenticated } = useAuth();

	return (
		<div className="min-h-screen bg-gray-50">
			{isAuthenticated && <Header />}
			<Outlet />
			<TanStackRouterDevtools />
		</div>
	);
}

export const Route = createRootRoute({
	component: RootLayout,
});