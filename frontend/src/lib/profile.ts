import { AuthUser } from "./auth";
import { apiRequest } from "./api";

export interface McpCredential {
  id: number;
  name: string;
  key_prefix: string;
  masked_key: string;
  created_at: string;
  updated_at: string;
}

export interface McpCredentialSecret extends McpCredential {
  key: string;
}

export async function updateProfileAvatar(avatarUrl: string | null): Promise<AuthUser> {
  return (await apiRequest<AuthUser>("/api/auth/me/profile", {
    method: "PATCH",
    body: { avatar_url: avatarUrl },
  })).data;
}

export async function resetOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest<{ reset: boolean }>("/api/auth/me/reset-password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export async function getMcpCredential(): Promise<McpCredentialSecret> {
  return (await apiRequest<McpCredentialSecret>("/api/auth/me/mcp-credential")).data;
}

export async function resetMcpCredential(): Promise<McpCredentialSecret> {
  return (await apiRequest<McpCredentialSecret>("/api/auth/me/mcp-credential/reset", {
    method: "POST",
  })).data;
}
