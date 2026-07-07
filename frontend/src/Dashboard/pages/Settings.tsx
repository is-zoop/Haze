import React, { useCallback, useEffect, useState } from "react";
import {
  Search, Plus, Edit3, X, UserPlus, Shield, Power, MoreHorizontal,
  Eye, Key, Trash2, Check, RotateCcw, ChevronDown, Copy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { FloatingAlert, type FlashMessage } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell, TableSecondaryText } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "../../components/common/PageHeader";
import { DataTableFooter } from "../../components/common/DataTableFooter";
import { getI18n } from "../../i18n";
import { ApiError } from "@/lib/api";
import {
  changeMemberRole, changeMemberStatus, createMember, listDepartments,
  listMembers, MemberRole, removeMember, resetMemberPassword,
  SystemMember, updateMember,
} from "@/lib/members";

interface PageProps {
  onBackToHome: () => void;
  langCode?: "ZH" | "EN" | "JA" | "ES";
}

type StoredAuthUser = {
  id?: string;
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
  realName?: string;
  username?: string;
};

type TemporaryPasswordDialog = {
  title: string;
  description: string;
  memberName: string;
  temporaryPassword: string;
};

const readStoredAuthUser = (): StoredAuthUser | null => {
  if (typeof window === "undefined") return null;

  const parseCandidate = (raw: string | null): StoredAuthUser | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const candidate = parsed?.user ?? parsed?.data?.user ?? parsed?.currentUser ?? parsed;
      if (!candidate || typeof candidate !== "object") return null;
      if (candidate.id || candidate.userId || candidate.email || candidate.phone || candidate.name || candidate.realName || candidate.username) {
        return candidate as StoredAuthUser;
      }
    } catch {
      return null;
    }
    return null;
  };

  const preferredKeys = [
    "haze_auth_user",
    "haze_user",
    "auth_user",
    "currentUser",
    "current_user",
    "user",
  ];

  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of preferredKeys) {
      const candidate = parseCandidate(storage.getItem(key));
      if (candidate) return candidate;
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !/(auth|user|profile|member)/i.test(key)) continue;
      const candidate = parseCandidate(storage.getItem(key));
      if (candidate) return candidate;
    }
  }

  return null;
};

export function Settings({ onBackToHome: _onBackToHome, langCode: _langCode = "ZH" }: PageProps) {
  const t = getI18n(_langCode);
  const [members, setMembers] = useState<SystemMember[]>([]);
  const [counts, setCounts] = useState({ all: 0, active: 0, disabled: 0 });
  const [totalItems, setTotalItems] = useState(0);
  const [departments, setDepartments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRole | "All">("All");
  const [statusTab, setStatusTab] = useState<"All" | "active" | "disabled">("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentMember, setCurrentMember] = useState<Partial<SystemMember>>({
    name: "", email: "", department: "", phone: "", role: "User", status: "active"
  });
  const [formError, setFormError] = useState("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [targetMemberForRole, setTargetMemberForRole] = useState<SystemMember | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<MemberRole>("User");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsMember, setDetailsMember] = useState<SystemMember | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"disable" | "enable" | "remove" | null>(null);
  const [confirmMember, setConfirmMember] = useState<SystemMember | null>(null);
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
  const [currentAuthUser, setCurrentAuthUser] = useState<StoredAuthUser | null>(null);
  const [temporaryPasswordDialog, setTemporaryPasswordDialog] = useState<TemporaryPasswordDialog | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const showFlash = (message: FlashMessage) => {
    setFlashMessage(message);
    window.setTimeout(() => setFlashMessage(value => value === message ? null : value), 6000);
  };

  const getErrorMessage = (error: unknown) => error instanceof ApiError ? error.message : "Request failed";
  const getRoleLabel = (role: MemberRole) => role === "SystemAdmin"
    ? t.memberMgmt_roleSystemAdmin
    : role === "Admin"
    ? t.memberMgmt_roleAdmin
    : role === "Developer"
      ? t.memberMgmt_roleDeveloper
      : t.memberMgmt_roleMember;

  const getTempPasswordText = (key: "createdTitle" | "resetTitle" | "createdDesc" | "resetDesc" | "copy" | "copied" | "close") => {
    const dict = {
      ZH: {
        createdTitle: "成员创建成功",
        resetTitle: "临时密码已生成",
        createdDesc: "请复制临时密码并安全发送给成员。关闭弹窗后将无法再次查看该密码。",
        resetDesc: "请复制新的临时密码并安全发送给成员。关闭弹窗后将无法再次查看该密码。",
        copy: "复制密码",
        copied: "已复制",
        close: "关闭",
      },
      EN: {
        createdTitle: "Member Created",
        resetTitle: "Temporary Password Generated",
        createdDesc: "Copy the temporary password and send it to the member securely. It will not be shown again after closing this dialog.",
        resetDesc: "Copy the new temporary password and send it to the member securely. It will not be shown again after closing this dialog.",
        copy: "Copy password",
        copied: "Copied",
        close: "Close",
      },
      JA: {
        createdTitle: "メンバーを作成しました",
        resetTitle: "一時パスワードを生成しました",
        createdDesc: "一時パスワードをコピーし、メンバーへ安全に共有してください。このダイアログを閉じると再表示できません。",
        resetDesc: "新しい一時パスワードをコピーし、メンバーへ安全に共有してください。このダイアログを閉じると再表示できません。",
        copy: "パスワードをコピー",
        copied: "コピー済み",
        close: "閉じる",
      },
      ES: {
        createdTitle: "Miembro creado",
        resetTitle: "Contraseña temporal generada",
        createdDesc: "Copie la contraseña temporal y envíela de forma segura. No se volverá a mostrar al cerrar este cuadro.",
        resetDesc: "Copie la nueva contraseña temporal y envíela de forma segura. No se volverá a mostrar al cerrar este cuadro.",
        copy: "Copiar contraseña",
        copied: "Copiada",
        close: "Cerrar",
      },
    };
    return dict[_langCode][key];
  };

  const isSelfMember = useCallback((member?: Partial<SystemMember> | null) => {
    if (!member || !currentAuthUser) return false;

    const authId = currentAuthUser.id || currentAuthUser.userId;
    const authEmail = currentAuthUser.email?.toLowerCase();
    const authPhone = currentAuthUser.phone;
    const authName = currentAuthUser.name || currentAuthUser.realName || currentAuthUser.username;

    return Boolean(
      (authId && member.id === authId)
      || (authEmail && member.email?.toLowerCase() === authEmail)
      || (authPhone && member.phone === authPhone)
      || (authName && member.name === authName)
    );
  }, [currentAuthUser]);

  const openTemporaryPasswordDialog = (payload: TemporaryPasswordDialog) => {
    setCopySuccess(false);
    setTemporaryPasswordDialog(payload);
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryPasswordDialog?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPasswordDialog.temporaryPassword);
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 1800);
    } catch {
      showFlash({ type: "warning", title: t.alertActionRequiredTitle, description: temporaryPasswordDialog.temporaryPassword });
    }
  };

  const loadMembers = useCallback(async () => {
    try {
      const result = await listMembers({
        page: currentPage, pageSize, search: searchQuery.trim(), role: roleFilter, status: statusTab,
      });
      setMembers(result.items);
      setCounts(result.counts);
      setTotalItems(result.total);
    } catch (error) {
      showFlash({ type: "error", title: t.alertLoadFailedTitle, description: getErrorMessage(error) });
    }
  }, [currentPage, pageSize, searchQuery, roleFilter, statusTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMembers(), 250);
  return () => window.clearTimeout(timer);
  }, [loadMembers]);

  useEffect(() => {
    setCurrentAuthUser(readStoredAuthUser());
  }, []);

  useEffect(() => {
    void listDepartments().then(setDepartments).catch(error => showFlash({ type: "error", title: t.alertLoadFailedTitle, description: getErrorMessage(error) }));
  }, []);

  const getRecentLogin = (id: string) => {
    const member = members.find(item => item.id === id);
    if (!member?.lastLoginAt) return "-";
    return new Date(member.lastLoginAt).toLocaleString();
  };

  const getAvatarBgClass = (id: string) => {
    const num = parseInt(id.replace(/\D/g, "")) || 0;
    const bgs = [
      "bg-blue-50 text-blue-600 border border-blue-100/50",
      "bg-indigo-50 text-indigo-600 border border-indigo-100/50",
      "bg-purple-50 text-purple-600 border border-purple-100/50",
      "bg-emerald-50 text-emerald-600 border border-emerald-100/50",
      "bg-amber-50 text-amber-600 border border-amber-100/50",
      "bg-rose-50 text-rose-600 border border-rose-100/50",
    ];
    return bgs[num % bgs.length];
  };

  const allCount = counts.all;
  const activeCount = counts.active;
  const disabledCount = counts.disabled;
  const paginatedMembers = members;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validatedPage = Math.min(currentPage, totalPages);
  const isEditingSelf = isEditing && isSelfMember(currentMember);

  const handleResetFilters = () => {
    setSearchQuery(""); setRoleFilter("All"); setStatusTab("All"); setCurrentPage(1);
    showFlash({ type: "success", title: t.alertOperationSuccessTitle, description: t.memberMgmt_msgResetFilters });
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentMember({ memberNo: "", initialPassword: "", name: "", email: "", department: "", phone: "", role: "User", status: "active" });
    setFormError(""); setShowEditModal(true);
  };

  const handleOpenEdit = (member: SystemMember) => {
    setIsEditing(true); setCurrentMember({ ...member }); setFormError(""); setShowEditModal(true);
  };

  const handleSaveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isEditing && !currentMember.memberNo?.trim()) {
      return setFormError(_langCode === "ZH" ? "请输入成员编号" : "Member number is required");
    }
    if (!currentMember.name?.trim()) return setFormError(t.memberMgmt_errName);
    if (!currentMember.department?.trim()) return setFormError(t.memberMgmt_errDept);
    if (!isEditing && !currentMember.phone?.trim()) return setFormError(t.memberMgmt_errPhone);

    try {
      if (isEditing) {
        const originalMember = members.find(item => item.id === currentMember.id);
        const payload = { ...currentMember } as SystemMember;

        if (originalMember) {
          payload.phone = originalMember.phone;
          if (isSelfMember(originalMember)) {
            payload.role = originalMember.role;
            payload.status = originalMember.status;
          }
        }

        await updateMember(payload);
        showFlash({ type: "success", title: t.alertSaveSuccessTitle, description: `${t.memberMgmt_msgSaveSuccess}: ${currentMember.name}` });
      } else {
        const result = await createMember(currentMember as Omit<SystemMember, "id" | "lastLoginAt">);
        openTemporaryPasswordDialog({
          title: getTempPasswordText("createdTitle"),
          description: getTempPasswordText("createdDesc"),
          memberName: result.member.name,
          temporaryPassword: result.temporaryPassword,
        });
      }
      setShowEditModal(false);
      await loadMembers();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const triggerConfirmAction = (action: "disable" | "enable" | "remove", member: SystemMember) => {
    if ((action === "disable" || action === "enable") && isSelfMember(member)) {
      showFlash({ type: "warning", title: t.alertActionRequiredTitle, description: t.settingsSelfStatusForbidden });
      return;
    }
    setConfirmAction(action); setConfirmMember(member); setShowConfirmDialog(true);
  };

  const executeConfirmAction = async () => {
    if (!confirmMember || !confirmAction) return;
    if ((confirmAction === "disable" || confirmAction === "enable") && isSelfMember(confirmMember)) {
      showFlash({ type: "warning", title: t.alertActionRequiredTitle, description: t.settingsSelfStatusForbidden });
      setShowConfirmDialog(false);
      return;
    }
    try {
      if (confirmAction === "remove") {
        await removeMember(confirmMember.id);
        showFlash({ type: "success", title: t.alertDeleteSuccessTitle, description: `${t.memberMgmt_msgRemoveSuccess}: ${confirmMember.name}` });
      } else {
        await changeMemberStatus(confirmMember.id, confirmAction === "disable" ? "disabled" : "active");
        showFlash({ type: "success", title: t.alertOperationSuccessTitle, description: `${confirmAction === "disable" ? t.memberMgmt_msgDisableSuccess : t.memberMgmt_msgEnableSuccess}: ${confirmMember.name}` });
      }
      await loadMembers();
    } catch (error) {
      showFlash({ type: "error", title: t.alertOperationFailedTitle, description: getErrorMessage(error) });
    } finally {
      setShowConfirmDialog(false); setConfirmAction(null); setConfirmMember(null);
    }
  };

  const handleOpenChangeRole = (member: SystemMember) => {
    if (isSelfMember(member)) {
      showFlash({ type: "warning", title: t.alertActionRequiredTitle, description: t.settingsSelfRoleForbidden });
      return;
    }
    setTargetMemberForRole(member); setSelectedNewRole(member.role); setShowRoleModal(true);
  };

  const saveRoleChange = async () => {
    if (!targetMemberForRole) return;
    if (isSelfMember(targetMemberForRole)) {
      showFlash({ type: "warning", title: t.alertActionRequiredTitle, description: t.settingsSelfRoleForbidden });
      setShowRoleModal(false);
      return;
    }
    try {
      await changeMemberRole(targetMemberForRole.id, selectedNewRole);
      showFlash({ type: "success", title: t.alertOperationSuccessTitle, description: `${t.memberMgmt_msgRoleSuccess}: ${targetMemberForRole.name} -> ${getRoleLabel(selectedNewRole)}` });
      setShowRoleModal(false);
      await loadMembers();
    } catch (error) {
      showFlash({ type: "error", title: t.alertOperationFailedTitle, description: getErrorMessage(error) });
    }
  };

  const handleResetPassword = async (member: SystemMember) => {
    try {
      const password = await resetMemberPassword(member.id);
      openTemporaryPasswordDialog({
        title: getTempPasswordText("resetTitle"),
        description: getTempPasswordText("resetDesc"),
        memberName: member.name,
        temporaryPassword: password,
      });
    } catch (error) {
      showFlash({ type: "error", title: t.alertOperationFailedTitle, description: getErrorMessage(error) });
    }
  };

  const handleViewDetails = (member: SystemMember) => {
    setDetailsMember(member); setShowDetailsModal(true);
  };
  const renderDepartmentField = () => (
    <div>
      <label className="block text-xs font-bold text-muted-foreground pb-1.5">
        {t.memberMgmt_formDept}
      </label>
      <div className="relative flex items-center">
        <Input
          type="text"
          required
          value={currentMember.department || ""}
          onChange={(e) => setCurrentMember(prev => ({ ...prev, department: e.target.value }))}
          className="w-full h-10 pl-3 pr-10 text-xs bg-background border border-input rounded-lg focus:outline-hidden focus:border-blue-500 font-medium text-foreground"
        />
        <div className="absolute right-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-slate-100 rounded-md cursor-pointer"
              >
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] text-xs bg-white text-slate-700 border border-slate-200 shadow-md rounded-xl p-1 z-[100]" align="end">
              {departments.map((dept) => (
                <DropdownMenuItem
                  key={dept}
                  onClick={() => setCurrentMember(prev => ({ ...prev, department: dept }))}
                  className="cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between"
                >
                  <span>{dept}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
  return (
    <div className="dashboard-page-stack h-full overflow-hidden text-left font-sans flex flex-col gap-3 animate-in fade-in duration-300" id="haze-settings-page-container">
      <PageHeader
        title={t.memberMgmt_title}
        description={t.memberMgmt_desc}
        actions={(
          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="w-full sm:w-auto font-bold bg-slate-900 hover:bg-slate-800 text-white h-10 px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={16} />
            <span>{t.memberMgmt_addBtn}</span>
          </Button>
        )}
      />

      {/* Container Wrapper */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border/70 bg-white shadow-xs p-4 pt-2.5 pb-2.5 gap-3 overflow-hidden" id="haze-settings-page-overhaul">

        {/* 2. Status Tabs */}
        <div className="flex border-b border-border/70 text-sm font-medium shrink-0" id="haze-member-tabs">
          <button
            onClick={() => { setStatusTab("All"); setCurrentPage(1); }}
            className={`pb-3 px-4 font-bold border-b-2 transition-all duration-200 cursor-pointer text-xs ${
              statusTab === "All"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.memberMgmt_tabAll} <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">{allCount}</span>
          </button>
          <button
            onClick={() => { setStatusTab("active"); setCurrentPage(1); }}
            className={`pb-3 px-4 font-bold border-b-2 transition-all duration-200 cursor-pointer text-xs ${
              statusTab === "active"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.memberMgmt_tabActive} <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">{activeCount}</span>
          </button>
          <button
            onClick={() => { setStatusTab("disabled"); setCurrentPage(1); }}
            className={`pb-3 px-4 font-bold border-b-2 transition-all duration-200 cursor-pointer text-xs ${
              statusTab === "disabled"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.memberMgmt_tabDisabled} <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-rose-600 font-bold">{disabledCount}</span>
          </button>
        </div>

        {/* 3. Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0" id="haze-member-filter-toolbar">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box - Width 320px, Height 40px */}
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
              <Input
                type="text"
                placeholder={t.memberMgmt_searchPlaceholder}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-10 pl-10 pr-4 text-xs bg-background border border-input rounded-lg focus-visible:ring-blue-500 text-foreground placeholder:text-muted-foreground font-semibold"
              />
            </div>

            {/* Role select - Width 140px, Height 40px */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 w-[140px] px-3.5 text-xs bg-background border border-input rounded-lg flex items-center justify-between font-semibold text-foreground cursor-pointer shadow-none hover:bg-slate-50 transition-colors"
                >
                  <span>
                    {roleFilter === "All" ? t.memberMgmt_filterRoleAll : getRoleLabel(roleFilter)}
                  </span>
                  <ChevronDown size={14} className="opacity-60 ml-1 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[140px] text-xs bg-white text-slate-700 border border-slate-200 shadow-md rounded-xl p-1 z-50 animate-fade-in" align="start">
                <DropdownMenuItem
                  onClick={() => { setRoleFilter("All"); setCurrentPage(1); }}
                  className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${roleFilter === "All" ? "text-blue-600 bg-blue-50/50" : ""}`}
                >
                  <span>{t.memberMgmt_filterRoleAll}</span>
                  {roleFilter === "All" && <Check size={12} className="text-blue-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setRoleFilter("Admin"); setCurrentPage(1); }}
                  className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${roleFilter === "Admin" ? "text-blue-600 bg-blue-50/50" : ""}`}
                >
                  <span>{t.memberMgmt_roleAdmin}</span>
                  {roleFilter === "Admin" && <Check size={12} className="text-blue-600" />}
                </DropdownMenuItem>                <DropdownMenuItem
                  onClick={() => { setRoleFilter("Developer"); setCurrentPage(1); }}
                  className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${roleFilter === "Developer" ? "text-blue-600 bg-blue-50/50" : ""}`}
                >
                  <span>{t.memberMgmt_roleDeveloper}</span>
                  {roleFilter === "Developer" && <Check size={12} className="text-blue-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setRoleFilter("User"); setCurrentPage(1); }}
                  className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${roleFilter === "User" ? "text-blue-600 bg-blue-50/50" : ""}`}
                >
                  <span>{t.memberMgmt_roleMember}</span>
                  {roleFilter === "User" && <Check size={12} className="text-blue-600" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reset Button - Height 40px */}
            {(searchQuery !== "" || roleFilter !== "All" || statusTab !== "All") && (
              <Button
                variant="ghost"
                onClick={handleResetFilters}
                className="h-10 px-4 text-xs font-semibold flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                <RotateCcw size={13} />
                <span>{t.memberMgmt_reset}</span>
              </Button>
            )}
          </div>
        </div>

        {/* 4. Main Data Table */}
        <div className="flex-grow flex-1 min-h-0 flex flex-col justify-between gap-2" id="haze-member-table-container">
          <div className="flex-grow flex-1 min-h-0 overflow-auto rounded-xl border border-border/70 bg-white">
            <Table className="min-w-[1100px] table-fixed">
              <TableHeader className="sticky top-0 z-30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[16%]">
                    {t.memberMgmt_colMember}
                  </TableHead>
                  <TableHead className="w-[18%]">
                    {t.memberMgmt_colEmail}
                  </TableHead>
                  <TableHead className="w-[12%]">
                    {t.memberMgmt_colPhone}
                  </TableHead>
                  <TableHead className="w-[14%]">
                    {t.memberMgmt_colDept}
                  </TableHead>
                  <TableHead className="w-[10%]">
                    {t.memberMgmt_colRole}
                  </TableHead>
                  <TableHead className="w-[10%]">
                    {t.memberMgmt_colStatus}
                  </TableHead>
                  <TableHead className="w-[12%]">
                    {t.memberMgmt_colLogin}
                  </TableHead>
                  <TableHead className="w-[8%]" data-table-action="true">
                    {t.memberMgmt_colAction}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMembers.map((member) => (
                  <TableRow key={member.id}>
                    {/* Member (16%) */}
                    <TableCell className="w-[16%] min-w-0">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 shrink-0 font-bold text-xs rounded-full flex items-center justify-center ${getAvatarBgClass(member.id)}`}>
                          {(member.name).charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground truncate">
                            {member.name}
                          </span>
                          <TableSecondaryText className="truncate animate-none">
                            {member.id}
                          </TableSecondaryText>
                        </div>
                      </div>
                    </TableCell>

                    {/* Email (18%) */}
                    <TableCell className="w-[18%] text-foreground truncate">
                      {member.email}
                    </TableCell>

                    {/* Phone (12%) */}
                    <TableCell className="w-[12%] text-foreground truncate">
                      {member.phone || "-"}
                    </TableCell>

                    {/* Department (14%) */}
                    <TableCell className="w-[14%] text-foreground truncate">
                      {member.department}
                    </TableCell>

                    {/* Role (10%) */}
                    <TableCell className="w-[10%]">
                      {member.role === "Admin" ? (
                        <Badge variant="outline" className="border-none bg-blue-50 text-blue-600 hover:bg-blue-50/80 font-bold text-xs py-0.5 px-2.5 rounded-md">
                          {t.memberMgmt_roleAdmin}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-none bg-slate-100 text-slate-500 hover:bg-slate-100 font-bold text-xs py-0.5 px-2.5 rounded-md">
                          {getRoleLabel(member.role)}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Status (10%) */}
                    <TableCell className="w-[10%]">
                      {member.status === "active" ? (
                        <Badge variant="outline" className="border-none bg-emerald-50 text-emerald-600 hover:bg-emerald-50 font-black text-xs py-0.5 px-2.5 rounded-md">
                          {t.memberMgmt_tabActive}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-none bg-rose-50 text-rose-600 hover:bg-rose-50 font-black text-xs py-0.5 px-2.5 rounded-md">
                          {t.memberMgmt_tabDisabled}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Recent login (12%) */}
                    <TableCell className="w-[12%] text-muted-foreground">
                      {getRecentLogin(member.id)}
                    </TableCell>

                    {/* Actions (8% - 右对齐) */}
                    <TableCell className="w-[8%] text-left" data-table-action="true">
                      <div className="flex items-center justify-start gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(member)}
                        >
                          <Edit3 />
                          <span>{t.memberMgmt_edit}</span>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              <MoreHorizontal size={15} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs bg-white text-slate-700 border border-slate-100 shadow-md rounded-xl p-1 w-[140px] z-50">
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(member)}
                              className="cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center gap-1.5"
                            >
                              <Eye size={12} className="text-slate-400" />
                              <span>{t.memberMgmt_viewDetails}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              disabled={isSelfMember(member)}
                              onClick={() => handleOpenChangeRole(member)}
                              className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center gap-1.5 ${isSelfMember(member) ? "opacity-45 pointer-events-none" : ""}`}
                            >
                              <Shield size={12} className="text-slate-400" />
                              <span>{t.memberMgmt_changeRole}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleResetPassword(member)}
                              className="cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center gap-1.5"
                            >
                              <Key size={12} className="text-slate-400" />
                              <span>{t.memberMgmt_resetPassword}</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {member.status === "active" ? (
                              <DropdownMenuItem
                                disabled={isSelfMember(member)}
                                onClick={() => triggerConfirmAction("disable", member)}
                                className={`cursor-pointer font-bold p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50 rounded-lg flex items-center gap-1.5 ${isSelfMember(member) ? "opacity-45 pointer-events-none" : ""}`}
                              >
                                <Power size={12} />
                                <span>{t.memberMgmt_disableAccount}</span>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={isSelfMember(member)}
                                onClick={() => triggerConfirmAction("enable", member)}
                                className={`cursor-pointer font-bold p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 focus:bg-emerald-50 rounded-lg flex items-center gap-1.5 ${isSelfMember(member) ? "opacity-45 pointer-events-none" : ""}`}
                              >
                                <Power size={12} />
                                <span>{t.memberMgmt_enableAccount}</span>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => triggerConfirmAction("remove", member)}
                              className="cursor-pointer font-bold p-2 text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-lg flex items-center gap-1.5"
                            >
                              <Trash2 size={12} />
                              <span>{t.memberMgmt_removeMember}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground font-semibold">
                      {t.memberMgmt_noMatches}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* 5. Pagination controls */}
          <DataTableFooter
            totalItems={totalItems}
            currentPage={validatedPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            langCode={_langCode}
          />
        </div>

      </div>

      {/* 6. Edit/Create Modal (AnimatePresence Overlay) */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl p-6 bg-card border border-border rounded-xl shadow-lg text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-foreground font-bold">
                  <UserPlus size={16} className="text-blue-600" />
                  <span>
                    {isEditing ? t.memberMgmt_editDetails : t.memberMgmt_addNew}
                  </span>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-0.5 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {formError && (
                <div className="mt-3 p-2.5 bg-destructive/10 border border-destructive/20 text-xs rounded-lg text-destructive font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveForm} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!isEditing && (
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                        {_langCode === "ZH" ? "\u6210\u5458\u7f16\u53f7" : "Member number"}<span className="text-destructive ml-0.5">*</span>
                      </label>
                      <Input
                        type="text"
                        required
                        maxLength={30}
                        value={currentMember.memberNo || ""}
                        onChange={(e) => setCurrentMember(prev => ({ ...prev, memberNo: e.target.value }))}
                        className="w-full h-10 px-3 text-xs bg-background border border-input rounded-lg focus:outline-hidden focus:border-blue-500 font-medium text-foreground"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                      {t.memberMgmt_formName}<span className="text-destructive ml-0.5">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      value={currentMember.name || ""}
                      onChange={(e) => setCurrentMember(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full h-10 px-3 text-xs bg-background border border-input rounded-lg focus:outline-hidden focus:border-blue-500 font-medium text-foreground"
                    />
                  </div>
                  {isEditing && renderDepartmentField()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                      {t.memberMgmt_formEmail}
                    </label>
                    <Input
                      type="email"
                      value={currentMember.email || ""}
                      onChange={(e) => setCurrentMember(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full h-10 px-3 text-xs bg-background border border-input rounded-lg focus:outline-hidden focus:border-blue-500 font-medium text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                      {t.memberMgmt_formPhone}<span className="text-destructive ml-0.5">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      disabled={isEditing}
                      value={currentMember.phone || ""}
                      onChange={(e) => setCurrentMember(prev => ({ ...prev, phone: e.target.value }))}
                      className={`w-full h-10 px-3 text-xs border border-input rounded-lg focus:outline-hidden focus:border-blue-500 font-medium text-foreground ${isEditing ? "bg-slate-50 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
                    />
                  </div>
                </div>

                {!isEditing && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderDepartmentField()}
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                        {_langCode === "ZH" ? "\u521d\u59cb\u5bc6\u7801\uff08\u53ef\u9009\uff09" : "Initial password (optional)"}
                      </label>
                      <Input
                        type="password"
                        minLength={6}
                        maxLength={128}
                        value={currentMember.initialPassword || ""}
                        placeholder={_langCode === "ZH" ? "\u7559\u7a7a\u5219\u81ea\u52a8\u751f\u6210" : "Leave blank to generate automatically"}
                        onChange={(e) => setCurrentMember(prev => ({ ...prev, initialPassword: e.target.value }))}
                        className="w-full h-10 px-3 text-xs bg-background border border-input rounded-lg focus:outline-hidden focus:border-blue-500 font-medium text-foreground"
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                      {t.memberMgmt_formRole}<span className="text-destructive ml-0.5">*</span>
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isEditingSelf}
                          className={`w-full h-10 px-3 text-xs bg-background border border-input rounded-lg flex items-center justify-between font-semibold text-foreground shadow-none hover:bg-slate-50 transition-colors ${isEditingSelf ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                        >
                          <span>
                            {getRoleLabel((currentMember.role || "User") as MemberRole)}
                          </span>
                          <ChevronDown size={14} className="opacity-60 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[180px] text-xs bg-white text-slate-700 border border-slate-200 shadow-md rounded-xl p-1 z-[100]" align="start">                        <DropdownMenuItem
                          onClick={() => setCurrentMember(prev => ({ ...prev, role: "Developer" }))}
                          className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${currentMember.role === "Developer" ? "text-blue-600 bg-blue-50/50" : ""}`}
                        >
                          <span>{t.memberMgmt_roleDeveloper}</span>
                          {currentMember.role === "Developer" && <Check size={12} className="text-blue-600" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setCurrentMember(prev => ({ ...prev, role: "User" }))}
                          className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${currentMember.role === "User" ? "text-blue-600 bg-blue-50/50" : ""}`}
                        >
                          <span>{t.memberMgmt_roleMember}</span>
                          {currentMember.role === "User" && <Check size={12} className="text-blue-600" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setCurrentMember(prev => ({ ...prev, role: "Admin" }))}
                          className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${currentMember.role === "Admin" ? "text-blue-600 bg-blue-50/50" : ""}`}
                        >
                          <span>{t.memberMgmt_roleAdmin}</span>
                          {currentMember.role === "Admin" && <Check size={12} className="text-blue-600" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                      {t.memberMgmt_formStatus}<span className="text-destructive ml-0.5">*</span>
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isEditingSelf}
                          className={`w-full h-10 px-3 text-xs bg-background border border-input rounded-lg flex items-center justify-between font-semibold text-foreground shadow-none hover:bg-slate-50 transition-colors ${isEditingSelf ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                        >
                          <span>
                            {currentMember.status === "disabled" ? t.memberMgmt_tabDisabled : t.memberMgmt_tabActive}
                          </span>
                          <ChevronDown size={14} className="opacity-60 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[180px] text-xs bg-white text-slate-700 border border-slate-200 shadow-md rounded-xl p-1 z-[100]" align="start">
                        <DropdownMenuItem
                          onClick={() => setCurrentMember(prev => ({ ...prev, status: "active" }))}
                          className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${currentMember.status !== "disabled" ? "text-blue-600 bg-blue-50/50" : ""}`}
                        >
                          <span>{t.memberMgmt_tabActive}</span>
                          {currentMember.status !== "disabled" && <Check size={12} className="text-blue-600" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setCurrentMember(prev => ({ ...prev, status: "disabled" }))}
                          className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${currentMember.status === "disabled" ? "text-blue-600 bg-blue-50/50" : ""}`}
                        >
                          <span>{t.memberMgmt_tabDisabled}</span>
                          {currentMember.status === "disabled" && <Check size={12} className="text-blue-600" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-end gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditModal(false)}
                    className="h-9 text-xs font-bold px-4 cursor-pointer text-foreground"
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 text-xs font-bold px-5 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    {t.memberMgmt_saveBtn}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Change Role Modal */}
      <AnimatePresence>
        {showRoleModal && targetMemberForRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[360px] p-6 bg-card border border-border rounded-xl shadow-lg text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-foreground font-bold">
                  <Shield size={16} className="text-blue-600" />
                  <span>{t.memberMgmt_changeRole}</span>
                </div>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-0.5 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="my-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  {_langCode === "ZH" ? <>请为成员 <strong className="text-foreground">{targetMemberForRole.name}</strong> 选择新的企业控制台角色。</>
                   : _langCode === "JA" ? <>メンバー <strong className="text-foreground">{targetMemberForRole.name}</strong> の新しいロールを選択してください。</>
                   : _langCode === "ES" ? <>Seleccione el rol de consola para <strong className="text-foreground">{targetMemberForRole.name}</strong>.</>
                   : <>Select console role for <strong className="text-foreground">{targetMemberForRole.name}</strong>.</>}
                </p>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                    {t.memberMgmt_formRole}
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-10 px-3 text-xs bg-background border border-input rounded-lg flex items-center justify-between font-semibold text-foreground cursor-pointer shadow-none hover:bg-slate-50 transition-colors"
                      >
                        <span>
                          {getRoleLabel(selectedNewRole)}
                        </span>
                        <ChevronDown size={14} className="opacity-60 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[220px] text-xs bg-white text-slate-700 border border-slate-200 shadow-md rounded-xl p-1 z-[100]" align="start">
                      <DropdownMenuItem
                        onClick={() => setSelectedNewRole("Admin")}
                        className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${selectedNewRole === "Admin" ? "text-blue-600 bg-blue-50/50" : ""}`}
                      >
                        <span>{t.memberMgmt_roleAdmin}</span>
                        {selectedNewRole === "Admin" && <Check size={12} className="text-blue-600" />}
                      </DropdownMenuItem>                      <DropdownMenuItem
                        onClick={() => setSelectedNewRole("Developer")}
                        className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${selectedNewRole === "Developer" ? "text-blue-600 bg-blue-50/50" : ""}`}
                      >
                        <span>{t.memberMgmt_roleDeveloper}</span>
                        {selectedNewRole === "Developer" && <Check size={12} className="text-blue-600" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setSelectedNewRole("User")}
                        className={`cursor-pointer font-bold p-2 hover:bg-slate-50 focus:bg-slate-50 rounded-lg flex items-center justify-between ${selectedNewRole === "User" ? "text-blue-600 bg-blue-50/50" : ""}`}
                      >
                        <span>{t.memberMgmt_roleMember}</span>
                        {selectedNewRole === "User" && <Check size={12} className="text-blue-600" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRoleModal(false)}
                  className="h-8 text-xs font-bold px-3.5 cursor-pointer text-foreground"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={saveRoleChange}
                  className="h-8 text-xs font-bold px-4 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {t.memberMgmt_saveBtn}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. Temporary Password Modal */}
      <AnimatePresence>
        {temporaryPasswordDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[380px] p-6 bg-card border border-border rounded-xl shadow-lg text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-foreground font-bold">
                  <Key size={16} className="text-blue-600" />
                  <span>{temporaryPasswordDialog.title}</span>
                </div>
                <button
                  onClick={() => setTemporaryPasswordDialog(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-0.5 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="my-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {temporaryPasswordDialog.description}
                </p>
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <div className="text-xs font-bold text-muted-foreground mb-1.5">
                    {_langCode === "ZH" ? "成员" : _langCode === "JA" ? "メンバー" : _langCode === "ES" ? "Miembro" : "Member"}
                  </div>
                  <div className="text-sm font-extrabold text-foreground">
                    {temporaryPasswordDialog.memberName}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground pb-1.5">
                    {_langCode === "ZH" ? "临时密码" : _langCode === "JA" ? "一時パスワード" : _langCode === "ES" ? "Contraseña temporal" : "Temporary password"}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={temporaryPasswordDialog.temporaryPassword}
                      className="h-10 flex-1 px-3 text-sm bg-background border border-input rounded-lg font-mono font-bold tracking-wide text-foreground"
                    />
                    <Button
                      type="button"
                      onClick={copyTemporaryPassword}
                      className="h-10 px-3 text-xs font-bold cursor-pointer bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5"
                    >
                      {copySuccess ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copySuccess ? getTempPasswordText("copied") : getTempPasswordText("copy")}</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTemporaryPasswordDialog(null)}
                  className="h-8 text-xs font-bold px-3.5 cursor-pointer text-foreground"
                >
                  {getTempPasswordText("close")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. View Details Modal */}
      <AnimatePresence>
        {showDetailsModal && detailsMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[400px] p-6 bg-card border border-border rounded-xl shadow-lg text-left"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-foreground font-bold">
                  <Eye size={16} className="text-blue-600" />
                  <span>{t.memberMgmt_viewDetails}</span>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-0.5 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {/* Header Avatar and Name info */}
                <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                  <div className={`h-12 w-12 shrink-0 font-bold text-base rounded-full flex items-center justify-center ${getAvatarBgClass(detailsMember.id)}`}>
                    {(detailsMember.name).charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-foreground">{detailsMember.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {_langCode === "ZH" ? `工号: ${detailsMember.id}` : _langCode === "JA" ? `社員番号: ${detailsMember.id}` : _langCode === "ES" ? `ID: ${detailsMember.id}` : `ID: ${detailsMember.id}`}
                    </p>
                  </div>
                </div>

                {/* Detail list elements */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50 border-border/40">
                    <span className="text-muted-foreground font-semibold">
                      {t.memberMgmt_colEmail}
                    </span>
                    <span className="text-foreground font-bold">{detailsMember.email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 border-border/40">
                    <span className="text-muted-foreground font-semibold">
                      {t.memberMgmt_colDept}
                    </span>
                    <span className="text-foreground font-bold">{detailsMember.department}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 border-border/40">
                    <span className="text-muted-foreground font-semibold">
                      {t.memberMgmt_colPhone}
                    </span>
                    <span className="text-foreground font-bold">{detailsMember.phone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 border-border/40">
                    <span className="text-muted-foreground font-semibold">
                      {t.memberMgmt_colRole}
                    </span>
                    <span>
                      {detailsMember.role === "Admin" ? (
                        <Badge variant="outline" className="border-none bg-blue-50 text-blue-600 font-bold text-xs py-0 px-1.5 rounded-sm">
                          {t.memberMgmt_roleAdmin}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-none bg-slate-100 text-slate-500 font-bold text-xs py-0 px-1.5 rounded-sm">
                          {getRoleLabel(detailsMember.role)}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 border-border/40">
                    <span className="text-muted-foreground font-semibold">
                      {t.memberMgmt_colStatus}
                    </span>
                    <span>
                      {detailsMember.status === "active" ? (
                        <Badge variant="outline" className="border-none bg-emerald-50 text-emerald-600 font-bold text-xs py-0 px-1.5 rounded-sm">
                          {t.memberMgmt_tabActive}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-none bg-rose-50 text-rose-600 font-bold text-xs py-0 px-1.5 rounded-sm">
                          {t.memberMgmt_tabDisabled}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground font-semibold">
                      {t.memberMgmt_colLogin}
                    </span>
                    <span className="text-foreground font-bold">{getRecentLogin(detailsMember.id)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border flex justify-end">
                <Button
                  onClick={() => setShowDetailsModal(false)}
                  className="h-8.5 text-xs font-bold px-4 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                >
                  {_langCode === "ZH" ? "关闭" : _langCode === "JA" ? "閉じる" : _langCode === "ES" ? "Cerrar" : "Close"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 10. AlertDialog for Danger actions (Disabling / Enabling / Removing) */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-white border rounded-xl shadow-lg w-full max-w-sm p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900 text-left flex items-center gap-2">
              <span>{t.memberMgmt_confirmTitle}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground text-left mt-2 leading-relaxed">
              {confirmAction === "remove" && (
                <>
                  {_langCode === "ZH" ? <>您正在执行危险操作：将成员 <strong className="text-red-600">{confirmMember?.name}</strong> 从企业管理控制台中彻底移除。此操作不可逆，移除后其将无法再次登录。是否确认继续？</>
                   : _langCode === "JA" ? <>危険：メンバー <strong className="text-red-600">{confirmMember?.name}</strong> を企業リストから完全に削除します。この操作は元に戻せません。続行しますか？</>
                   : _langCode === "ES" ? <>Acción peligrosa: eliminar permanentemente al miembro <strong className="text-red-600">{confirmMember?.name}</strong> de la consola. Esta acción es irreversible. ¿Desea continuar?</>
                   : <>Dangerous action: permanently remove member <strong className="text-red-600">{confirmMember?.name}</strong> from the roster. This action is irreversible. Do you wish to continue?</>}
                </>
              )}
              {confirmAction === "disable" && (
                <>
                  {_langCode === "ZH" ? <>您正在执行禁用操作：挂起成员 <strong className="text-slate-900">{confirmMember?.name}</strong> 的账号凭证。禁用后，该成员将暂时无法进入工作台或使用任何 Skill，但其历史数据和发布信息将被保留。是否继续？</>
                   : _langCode === "JA" ? <>アカウント無効化：メンバー <strong className="text-slate-900">{confirmMember?.name}</strong> を一时的に無効にします。これにより、一部機能へのアクセスが一時停止されますが、データは維持されます。続行しますか？</>
                   : _langCode === "ES" ? <>Deshabilitar: suspender temporalmente la cuenta del miembro <strong className="text-slate-900">{confirmMember?.name}</strong>. Se conservarán los datos históricos. ¿Desea continuar?</>
                   : <>Disable: temporarily suspend member <strong className="text-slate-900">{confirmMember?.name}</strong>. Historical data and records will be retained. Do you wish to continue?</>}
                </>
              )}
              {confirmAction === "enable" && (
                <>
                  {_langCode === "ZH" ? <>您正准备重新启用成员 <strong className="text-slate-900">{confirmMember?.name}</strong> 的账号访问权限。启用后，该成员可立即登录使用平台。是否继续？</>
                   : _langCode === "JA" ? <>アカウント再有効化：メンバー <strong className="text-slate-900">{confirmMember?.name}</strong> のアカウントを有効に戻します。ログインを直ちに許可します。続行しますか？</>
                   : _langCode === "ES" ? <>Habilitar: restaurar permisos de acceso para <strong className="text-slate-900">{confirmMember?.name}</strong>. ¿Desea continuar?</>
                   : <>Enable: restore login and workspace permissions for <strong className="text-slate-900">{confirmMember?.name}</strong>. Do you wish to continue?</>}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex flex-row justify-end gap-2 text-xs">
            <AlertDialogCancel asChild>
              <Button variant="outline" className="h-8 px-3 text-xs font-bold text-slate-600 cursor-pointer">
                {t.cancel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={executeConfirmAction}
                className={`h-8 px-4 text-xs font-bold text-white cursor-pointer transition-colors ${
                  confirmAction === "remove"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : confirmAction === "disable"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {t.memberMgmt_confirmBtn}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {flashMessage && <FloatingAlert {...flashMessage} />}
    </div>
  );
}
