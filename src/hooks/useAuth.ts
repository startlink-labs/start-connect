import { useState, useEffect, createContext, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";

interface User {
	portal_id?: number;
	ui_domain?: string;
}

interface PortalInfo {
	portal_id?: number;
	ui_domain?: string;
}

interface StoredCredentials {
	portal_id?: number;
	ui_domain?: string;
}

interface AuthContextType {
	isAuthenticated: boolean;
	user: User | null;
	login: (token: string) => Promise<void>;
	logout: () => void;
	isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

class AuthAPI {
	static async getPortalInfo(): Promise<PortalInfo | null> {
		try {
			return await invoke('get_portal_info');
		} catch {
			return null;
		}
	}

	static async loginAndStore(token: string): Promise<StoredCredentials> {
		try {
			return await invoke('login_and_store', { token });
		} catch (error) {
			throw new Error(error as string || "認証に失敗しました");
		}
	}

	static async logoutAndClear(): Promise<void> {
		try {
			await invoke('logout_and_clear');
		} catch (error) {
			throw new Error(error as string || "ログアウトに失敗しました");
		}
	}
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

export function useAuthProvider(): AuthContextType {
	const [user, setUser] = useState<User | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	// 初期化時にセキュアストレージから認証情報を復元
	useEffect(() => {
		const initAuth = async () => {
			try {
				const portalInfo = await AuthAPI.getPortalInfo();
				if (portalInfo) {
					setUser({ 
						portal_id: portalInfo.portal_id,
						ui_domain: portalInfo.ui_domain
					});
					setIsAuthenticated(true);
				}
			} catch (error) {
				console.error('認証情報の復元に失敗:', error);
			} finally {
				setIsLoading(false);
			}
		};

		initAuth();
	}, []);

	const login = async (token: string): Promise<void> => {
		try {
			const credentials = await AuthAPI.loginAndStore(token);
			setUser({ 
				portal_id: credentials.portal_id,
				ui_domain: credentials.ui_domain
			});
			setIsAuthenticated(true);
		} catch (error) {
			throw error instanceof Error ? error : new Error("認証に失敗しました");
		}
	};

	const logout = async (): Promise<void> => {
		try {
			await AuthAPI.logoutAndClear();
			setUser(null);
			setIsAuthenticated(false);
		} catch (error) {
			console.error('ログアウトエラー:', error);
			// エラーが発生してもUIの状態はリセット
			setUser(null);
			setIsAuthenticated(false);
		}
	};

	return {
		isAuthenticated,
		user,
		login,
		logout,
		isLoading,
	};
}

export { AuthContext };