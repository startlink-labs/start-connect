import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "../components/Header";
import { useAuth } from "../hooks/useAuth";

function RootLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated && <Header />}
      <Outlet />
      <Toaster position="top-right" />
      <TanStackRouterDevtools />
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
