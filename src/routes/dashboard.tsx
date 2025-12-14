import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, FileText, MessageSquare } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="max-w-6xl mx-auto py-12 px-6 space-y-12">
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Salesforce → HubSpot
            </h2>
            <p className="text-muted-foreground">
              SalesforceのデータをHubSpotに移行するツール群
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg group flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">ファイルマッピング</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  SalesforceのContentVersionとContentDocumentLinkのCSVファイルを処理し、HubSpotにファイルをアップロードしてノートを作成します。
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    CSVからファイル情報を抽出
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    HubSpotにファイルをアップロード
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    HubSpotレコードにファイルを添付
                  </li>
                </ul>
                <div className="flex-1" />
                <Link to="/file-transfer" className="block">
                  <Button
                    className="w-full group-hover:shadow-md transition-shadow"
                    size="lg"
                  >
                    開始する
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg group flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Chatter移行</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  SalesforceのFeedItemとFeedCommentのCSVファイルを処理し、HubSpotのノートとして移行します。
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    FeedItemとコメントを読み込み
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    HTML形式に整形
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    HubSpotレコードにノート作成
                  </li>
                </ul>
                <div className="flex-1" />
                <Link to="/chatter-migration" className="block">
                  <Button
                    className="w-full group-hover:shadow-md transition-shadow"
                    size="lg"
                  >
                    開始する
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
