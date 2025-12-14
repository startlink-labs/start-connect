import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LoginCardProps {
  isLoading: boolean;
  error: string;
  onLogin: () => void;
  onCancel: () => void;
}

export const LoginCard = ({
  isLoading,
  error,
  onLogin,
  onCancel,
}: LoginCardProps) => {
  return (
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
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          <Button
            onClick={onLogin}
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
                onClick={onCancel}
                className="text-xs text-center text-muted-foreground hover:text-foreground underline w-full"
              >
                認証をキャンセルして再試行
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
