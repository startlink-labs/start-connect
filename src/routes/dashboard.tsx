import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "../hooks/useAuth";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ファイルマッピング</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              SalesforceのContentVersionとContentDocumentLinkのCSVファイルを処理して、HubSpotにファイルを転送します。
            </p>
            <Link to="/file-transfer">
              <Button className="w-full">ファイルマッピングを開始</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chatter移行</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Salesforce
              FeedItemとFeedCommentのCSVファイルを処理して、HubSpotに移行します。
            </p>
            <Link to="/chatter-migration">
              <Button className="w-full">Chatter移行を開始</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
