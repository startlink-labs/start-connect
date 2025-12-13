import { useEffect, useState } from "react";

function App() {
	const [backendStatus, setBackendStatus] = useState<string>("接続中...");
	const [testMessage, setTestMessage] = useState<string>("");

	useEffect(() => {
		// バックエンドのヘルスチェック
		fetch("http://localhost:8000/api/health")
			.then((res) => res.json())
			.then((data) => {
				setBackendStatus(`✅ ${data.message}`);
			})
			.catch(() => {
				setBackendStatus("❌ バックエンドに接続できません");
			});

		// テストエンドポイントの呼び出し
		fetch("http://localhost:8000/api/test")
			.then((res) => res.json())
			.then((data) => {
				setTestMessage(data.data.message);
			})
			.catch(() => {
				setTestMessage("テストエンドポイントに接続できません");
			});
	}, []);

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center">
			<div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
				<h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
					SF HS File Transfer App
				</h1>

				<div className="space-y-4">
					<div className="p-4 bg-blue-50 rounded-lg">
						<h2 className="font-semibold text-blue-900 mb-2">
							バックエンド状態
						</h2>
						<p className="text-blue-800">{backendStatus}</p>
					</div>

					<div className="p-4 bg-green-50 rounded-lg">
						<h2 className="font-semibold text-green-900 mb-2">API テスト</h2>
						<p className="text-green-800">{testMessage || "読み込み中..."}</p>
					</div>

					<div className="p-4 bg-purple-50 rounded-lg">
						<h2 className="font-semibold text-purple-900 mb-2">技術スタック</h2>
						<ul className="text-purple-800 text-sm space-y-1">
							<li>• React 19 + TypeScript</li>
							<li>• Vite + Tailwind CSS v4</li>
							<li>• Biome (Lint & Format)</li>
							<li>• Vitest + happy-dom</li>
							<li>• FastAPI + Pydantic</li>
							<li>• Python 3.14 + uv</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
