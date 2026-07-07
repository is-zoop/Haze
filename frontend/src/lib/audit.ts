import { apiRequest } from "./api";
import { loadCapabilityIcon } from "./capabilities";

export interface AuditStats {
  pending: number;
  today_reviewed: number;
  week_pass_rate: number | null;
  avg_review_hours: number | null;
}

export interface AuditCapabilityItem {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  version: string;
  category: string | null;
  tags: string[];
  author: string;
  department: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  comment: string | null;
  icon: string | null;
}

export interface AuditDetailCapability {
  id: string;
  name: string;
  code: string;
  type: string;
  version: string;
  category: string | null;
  tags: string[];
  description: string | null;
  recent_test_status: string;
  connect_type: string | null;
  icon: string | null;
}

export interface AuditDetailDeveloper {
  name: string | null;
  department: string | null;
  submitted_at: string | null;
}

export interface AuditDetailVersion {
  changelog: string | null;
  is_first_publish: boolean;
}

export interface AuditDetailReview {
  status: string;
  comment: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
}

export interface AuditDetail {
  capability: AuditDetailCapability;
  developer: AuditDetailDeveloper;
  version_info: AuditDetailVersion;
  review: AuditDetailReview | null;
}

export async function fetchAuditStats(): Promise<AuditStats> {
  const data = (await apiRequest<AuditStats>("/api/audit/stats")).data;
  return data;
}

export async function fetchAuditCapabilities(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  type?: string;
  deptId?: number;
}): Promise<{ items: AuditCapabilityItem[]; total: number }> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 20),
  });
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.type) query.set("type", params.type);
  if (params.deptId) query.set("dept_id", String(params.deptId));

  const data = (await apiRequest<{ items: AuditCapabilityItem[]; page: number; page_size: number; total: number }>(
    `/api/audit/capabilities?${query}`
  )).data;

  const items = await Promise.all(data.items.map(async (item) => {
    if (!item.icon) return item;
    try {
      return { ...item, icon: await loadCapabilityIcon(item.icon) };
    } catch {
      return { ...item, icon: null };
    }
  }));

  return { items, total: data.total };
}

export async function fetchAuditDetail(id: string): Promise<AuditDetail> {
  const raw = (await apiRequest<AuditDetail>(`/api/audit/capabilities/${id}/detail`)).data;
  if (raw.capability.icon) {
    try {
      raw.capability.icon = await loadCapabilityIcon(raw.capability.icon);
    } catch {
      raw.capability.icon = null;
    }
  }
  return raw;
}

export async function reviewCapability(
  id: string,
  action: "approved" | "rejected",
  comment?: string,
): Promise<{ success: boolean; new_status: string }> {
  const data = (await apiRequest<{ success: boolean; capability_id: string; new_status: string }>(
    `/api/audit/capabilities/${id}/review`,
    { method: "POST", body: { action, comment: comment ?? null } },
  )).data;
  return { success: data.success, new_status: data.new_status };
}
