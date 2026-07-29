import { apiRequest } from "./api";

export interface HomeCapabilityItem {
  id: string;
  name: string;
  type: "Skill" | "MCP";
  description: string | null;
  author: string;
  department: string | null;
  category: string | null;
  calls: number;
  is_favorite: boolean;
  icon: string | null;
  updated_at: string;
  use_count: number | null;
  last_used_at: string | null;
}

export interface HomeOverview {
  published: { total: number; skill: number; mcp: number };
  weekly_added: { current: number; previous: number; difference: number };
  my_capabilities: { available: boolean; total: number | null; published: number | null };
  audit: { available: boolean; pending: number | null; avg_review_hours: number | null };
  recommended: HomeCapabilityItem[];
  latest: HomeCapabilityItem[];
  popular: HomeCapabilityItem[];
  favorites: HomeCapabilityItem[];
  frequent: HomeCapabilityItem[];
}

export async function fetchHomeOverview(): Promise<HomeOverview> {
  return (await apiRequest<HomeOverview>("/api/home/overview")).data;
}

export async function recordHomeCapabilityUsage(id: string): Promise<void> {
  await apiRequest(`/api/home/capabilities/${id}/usage`, { method: "POST" });
}
