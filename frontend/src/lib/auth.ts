import { apiRequest } from "./api";

export const AUTH_TOKEN_KEY = "haze_access_token";
export const AUTH_UNAUTHORIZED_EVENT = "haze:unauthorized";

export interface AuthUser {
  member_no: string;
  name: string;
  phone: string;
  email: string;
  avatar_url?: string | null;
  department: string;
  role_code: "SYSTEM_ADMIN" | "ADMIN" | "DEVELOPER" | "USER";
  role_name: string;
  status: "active" | "disabled";
  permissions: string[];
}

export interface LoginData {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function saveAccessToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function login(phone: string, password: string): Promise<LoginData> {
  const response = await apiRequest<LoginData>("/api/auth/login", {
    method: "POST",
    body: { phone, password },
  });
  saveAccessToken(response.data.access_token);
  return response.data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  return (await apiRequest<AuthUser>("/api/auth/me")).data;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } finally {
    clearAccessToken();
  }
}
