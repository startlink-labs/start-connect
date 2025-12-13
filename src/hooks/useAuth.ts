import { useState, useEffect, createContext, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";

interface User {
	portal_id?: number;
	token: string;
}

interface AuthContextType {
	isAuthenticated: boolean;
	user: User | null;
	login: (token: string) => Promise<void>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 定数
const STORAGE_KEYS = {
	TOKEN: "hubspot_token",
	PORTAL_ID: "hubspot_portal_id",
} as const;



// ユーティリティ関数
class AuthStorage {
	static getToken(): string | null {
		return localStorage.getItem(STORAGE_KEYS.TOKEN);
	}

	static getPortalId(): number | undefined {
		const portalId = localStorage.getItem(STORAGE_KEYS.PORTAL_ID);
		return portalId ? parseInt(portalId) : undefined;
	}

	static setCredentials(token: string, portalId?: number): void {
		localStorage.setItem(STORAGE_KEYS.TOKEN, token);
		if (portalId) {
			localStorage.setItem(STORAGE_KEYS.PORTAL_ID, portalId.toString());
		}
	}

	static clearCredentials(): void {
		localStorage.removeItem(STORAGE_KEYS.TOKEN);
		localStorage.removeItem(STORAGE_KEYS.PORTAL_ID);
	}
}

class AuthAPI {
	static async verifyToken(token: string): Promise<{ portal_id?: number }> {
		try {
			const portalId = await invoke('verify_hubspot_token', { token }) as number;
			return { portal_id: portalId };
		} catch (error) {
			throw new Error(error as string || "認証に失敗しました");
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

	// 初期化時にローカルストレージから認証情報を復元
	useEffect(() => {
		const token = AuthStorage.getToken();
		const portalId = AuthStorage.getPortalId();
		
		if (token) {
			setUser({ token, portal_id: portalId });
			setIsAuthenticated(true);
		}
	}, []);

	const login = async (token: string): Promise<void> => {
		try {
			const userData = await AuthAPI.verifyToken(token);
			
			AuthStorage.setCredentials(token, userData.portal_id);
			setUser({ token, portal_id: userData.portal_id });
			setIsAuthenticated(true);
		} catch (error) {
			throw error instanceof Error ? error : new Error("認証に失敗しました");
		}
	};

	const logout = (): void => {
		AuthStorage.clearCredentials();
		setUser(null);
		setIsAuthenticated(false);
	};

	return {
		isAuthenticated,
		user,
		login,
		logout,
	};
}

export { AuthContext };