import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoginCard } from "@/components/auth/LoginCard";
import { Spinner } from "@/components/ui/spinner";
import { useAuth, useOAuthLogin } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading, error, startLogin, cancelLogin } = useOAuthLogin();

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
      <LoginCard
        isLoading={isLoading}
        error={error}
        onLogin={startLogin}
        onCancel={cancelLogin}
      />
    </div>
  );
}
