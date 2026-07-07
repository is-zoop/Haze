import { apiRequest } from "./api";

export type MemberRole = "SystemAdmin" | "Admin" | "Developer" | "User";
export type MemberStatus = "active" | "disabled";

export interface SystemMember {
  id: string;
  name: string;
  email: string;
  department: string;
  role: MemberRole;
  status: MemberStatus;
  lastLoginAt?: string;
  phone: string;
  memberNo?: string;
  initialPassword?: string;
}

interface ApiMember {
  member_no: string;
  name: string;
  email: string | null;
  phone: string;
  department: string;
  role_code: "ADMIN" | "DEVELOPER" | "USER" | "SYSTEM_ADMIN";
  status: MemberStatus;
  last_login_at?: string;
}

export interface MemberListResult {
  items: SystemMember[];
  page: number;
  page_size: number;
  total: number;
  counts: { all: number; active: number; disabled: number };
}

const roleToCode = { SystemAdmin: "SYSTEM_ADMIN", Admin: "ADMIN", Developer: "DEVELOPER", User: "USER" } as const;
const codeToRole = { SYSTEM_ADMIN: "SystemAdmin", ADMIN: "Admin", DEVELOPER: "Developer", USER: "User" } as const;

function mapMember(member: ApiMember): SystemMember {
  return {
    id: member.member_no,
    name: member.name,
    email: member.email || "",
    phone: member.phone,
    department: member.department,
    role: codeToRole[member.role_code],
    status: member.status,
    lastLoginAt: member.last_login_at,
  };
}

export async function listMembers(params: {
  page: number;
  pageSize: number;
  search?: string;
  role?: MemberRole | "All";
  status?: MemberStatus | "All";
}): Promise<MemberListResult> {
  const query = new URLSearchParams({ page: String(params.page), page_size: String(params.pageSize) });
  if (params.search) query.set("search", params.search);
  if (params.role && params.role !== "All") query.set("role_code", roleToCode[params.role]);
  if (params.status && params.status !== "All") query.set("status", params.status);
  const data = (await apiRequest<{ items: ApiMember[]; page: number; page_size: number; total: number; counts: MemberListResult["counts"] }>(`/api/users?${query}`)).data;
  return { ...data, items: data.items.map(mapMember) };
}

export async function createMember(member: Omit<SystemMember, "id" | "lastLoginAt">): Promise<{ member: SystemMember; temporaryPassword: string }> {
  const data = (await apiRequest<{ member: ApiMember; temporary_password: string }>("/api/users", {
    method: "POST",
    body: {
      member_no: member.memberNo,
      initial_password: member.initialPassword || undefined,
      name: member.name,
      email: member.email.trim() || null,
      phone: member.phone,
      department: member.department,
      role_code: roleToCode[member.role],
      status: member.status,
    },
  })).data;
  return { member: mapMember(data.member), temporaryPassword: data.temporary_password };
}

export async function updateMember(member: SystemMember): Promise<SystemMember> {
  const data = (await apiRequest<ApiMember>(`/api/users/${member.id}`, {
    method: "PATCH",
    body: { name: member.name, email: member.email.trim() || null, phone: member.phone, department: member.department },
  })).data;
  return mapMember(data);
}

export async function changeMemberRole(id: string, role: MemberRole): Promise<SystemMember> {
  return mapMember((await apiRequest<ApiMember>(`/api/users/${id}/role`, { method: "PUT", body: { role_code: roleToCode[role] } })).data);
}

export async function changeMemberStatus(id: string, status: MemberStatus): Promise<SystemMember> {
  return mapMember((await apiRequest<ApiMember>(`/api/users/${id}/status`, { method: "PATCH", body: { status } })).data);
}

export async function removeMember(id: string): Promise<void> {
  await apiRequest(`/api/users/${id}`, { method: "DELETE" });
}

export async function resetMemberPassword(id: string): Promise<string> {
  return (await apiRequest<{ temporary_password: string }>(`/api/users/${id}/reset-password`, { method: "POST" })).data.temporary_password;
}

export async function listDepartments(): Promise<string[]> {
  return (await apiRequest<Array<{ id: number; name: string }>>("/api/departments")).data.map(item => item.name);
}
