import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/login")({
	component: Login,
});

function Login() {
	const { isAuthenticated, login } = useAuth();
	const [token, setToken] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	if (isAuthenticated) {
		return <Navigate to="/dashboard" />;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!token.trim()) {
			setError("Private App Tokenを入力してください");
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			await login(token);
		} catch (err) {
			setError("認証に失敗しました。トークンを確認してください。");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle>HubSpot認証</CardTitle>
					<CardDescription>
						Private App Tokenを入力してログインしてください
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="token">Private App Token</Label>
							<Input
								id="token"
								type="password"
								value={token}
								onChange={(e) => setToken(e.target.value)}
								placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
								disabled={isLoading}
							/>
						</div>

						{error && (
							<div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
								{error}
							</div>
						)}

						<Button type="submit" disabled={isLoading} className="w-full">
							{isLoading ? "認証中..." : "ログイン"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}