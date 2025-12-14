import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";

interface PortalInfo {
  portal_id: number;
  ui_domain: string;
}

export const useAuth = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["auth"],
    queryFn: (): Promise<PortalInfo | null> => invoke("is_authenticated"),
    staleTime: 5 * 60 * 1000,
  });

  const logout = useMutation({
    mutationFn: (): Promise<void> => invoke("logout"),
    onSuccess: async () => {
      queryClient.setQueryData(["auth"], null);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate({ to: "/login" });
    },
  });

  return {
    portalInfo: query.data,
    isAuthenticated: !!query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
    logout,
  };
};
