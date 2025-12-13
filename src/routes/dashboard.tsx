import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
						<CardTitle>ファイル移行</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-gray-600 mb-4">
							SalesforceのContentVersionとContentDocumentLinkのCSVファイルを処理して、HubSpotにファイルを転送します。
						</p>
						<Link to="/file-transfer">
							<Button className="w-full">ファイル転送を開始</Button>
						</Link>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Chatter移行</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-gray-600 mb-4">
							Salesforce ChatterのデータをHubSpotに移行します。
						</p>
						<Button className="w-full" disabled>
							準備中
						</Button>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}