import { apiRequest } from "./api";

export interface BusinessCategory {
  id: number;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export const listBusinessCategories = async () =>
  (await apiRequest<BusinessCategory[]>("/api/business-categories")).data;

export const createBusinessCategory = async (payload: { name: string; description: string | null }) =>
  (await apiRequest<BusinessCategory>("/api/business-categories", { method: "POST", body: payload })).data;

export const updateBusinessCategory = async (id: number, payload: { name: string; description: string | null }) =>
  (await apiRequest<BusinessCategory>(`/api/business-categories/${id}`, { method: "PUT", body: payload })).data;

export const deleteBusinessCategory = async (id: number) =>
  apiRequest<{ deleted: boolean }>(`/api/business-categories/${id}`, { method: "DELETE" });
