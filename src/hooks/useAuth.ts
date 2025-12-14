import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

interface PortalInfo {
  portal_id: number | null;
  ui_domain: string | null;
}

export const usePortalInfo = () => {
  return useQuery({
    queryKey: ["portalInfo"],
    queryFn: (): Promise<PortalInfo | null> => invoke("get_portal_info"),
    staleTime: 5 * 60 * 1000,
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string): Promise<PortalInfo> =>
      invoke("login_and_store", { token }),
    onSuccess: (data) => {
      queryClient.setQueryData(["portalInfo"], data);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (): Promise<void> => invoke("logout_and_clear"),
    onSuccess: () => {
      queryClient.setQueryData(["portalInfo"], null);
    },
  });
};

// 便利なヘルパーフック
export const useAuth = () => {
  const { data: portalInfo, isLoading } = usePortalInfo();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  return {
    portalInfo,
    isAuthenticated: !!portalInfo,
    isLoading,
    login: loginMutation,
    logout: logoutMutation,
  };
};
