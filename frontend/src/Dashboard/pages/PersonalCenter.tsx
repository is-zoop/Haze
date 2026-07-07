import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, Check, Copy, Eye, EyeOff, KeyRound, LockKeyhole, RefreshCw, Save, Shield, UserRound } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicAlert, DestructiveAlert } from "@/components/ui/alert";
import { AuthUser } from "@/lib/auth";
import { getI18n } from "@/i18n";
import { getMcpCredential, McpCredentialSecret, resetMcpCredential, resetOwnPassword, updateProfileAvatar } from "@/lib/profile";

interface PersonalCenterProps {
  user: AuthUser;
  onLogout: () => void;
  onUserChange?: (user: AuthUser) => void;
  langCode?: string;
}

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MIN_SIZE = 128;
const AVATAR_MAX_SIZE = 4096;
const AVATAR_OUTPUT_SIZE = 256;

function fmtTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-border/70 bg-slate-50/60 px-3 py-2.5">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground" title={value || "--"}>{value || "--"}</div>
    </div>
  );
}

async function loadAvatarImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function normalizeAvatar(file: File): Promise<string> {
  if (!AVATAR_TYPES.has(file.type)) {
    throw new Error("仅支持 JPG、PNG、WebP 图片");
  }
  const image = await loadAvatarImage(file);
  const minSide = Math.min(image.naturalWidth, image.naturalHeight);
  const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (minSide < AVATAR_MIN_SIZE) {
    throw new Error("头像图片分辨率不能低于 128x128");
  }
  if (maxSide > AVATAR_MAX_SIZE) {
    throw new Error("头像图片最长边不能超过 4096 像素");
  }

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("头像处理失败");
  const sourceSize = minSide;
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function PersonalCenter({ user, onLogout, onUserChange, langCode = "ZH" }: PersonalCenterProps) {
  const t = getI18n(langCode);
  const [profile, setProfile] = useState<AuthUser>(user);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [credential, setCredential] = useState<McpCredentialSecret | null>(null);
  const [showFullKey, setShowFullKey] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfile(user);
    setAvatarUrl(user.avatar_url ?? "");
  }, [user]);

  useEffect(() => {
    let active = true;
    setCredentialLoading(true);
    getMcpCredential()
      .then(data => {
        if (active) setCredential(data);
      })
      .catch(() => {
        if (active) setCredential(null);
      })
      .finally(() => {
        if (active) setCredentialLoading(false);
      });
    return () => { active = false; };
  }, []);

  function openPasswordDialog() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setShowPassword(false);
    setPasswordOpen(true);
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProfileMessage("");
    try {
      const nextAvatar = await normalizeAvatar(file);
      setAvatarUrl(nextAvatar);
      setProfileMessage(t.profileAvatarSelected);
    } catch (err: unknown) {
      setProfileMessage(err instanceof Error ? err.message : t.profileAvatarProcessFailed);
    }
  }

  async function handleAvatarSave() {
    setProfileSaving(true);
    setProfileMessage("");
    try {
      const updated = await updateProfileAvatar(avatarUrl || null);
      setProfile(updated);
      setAvatarUrl(updated.avatar_url ?? "");
      onUserChange?.(updated);
      setProfileMessage(t.profileAvatarUpdated);
    } catch (err: unknown) {
      setProfileMessage(err instanceof Error ? err.message : t.profileAvatarUpdateFailed);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordReset() {
    setPasswordError("");
    if (!currentPassword) {
      setPasswordError(t.profilePasswordCurrentRequired);
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t.profilePasswordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t.profilePasswordMismatch);
      return;
    }
    setPasswordSaving(true);
    try {
      await resetOwnPassword(currentPassword, newPassword);
      setPasswordOpen(false);
      onLogout();
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : t.profilePasswordResetFailed);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleCredentialReset() {
    setCredentialLoading(true);
    setCopyDone(false);
    try {
      setCredential(await resetMcpCredential());
      setShowFullKey(true);
    } finally {
      setCredentialLoading(false);
    }
  }

  async function handleCopyKey() {
    const text = credential?.key;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopyDone(true);
    window.setTimeout(() => setCopyDone(false), 1500);
  }

  const initial = (profile.name || profile.member_no || "U").substring(0, 1).toUpperCase();

  return (
    <div className="dashboard-page-stack h-full overflow-hidden text-left font-sans animate-in fade-in duration-300">
      <PageHeader title="个人中心" description="查看个人信息，维护头像与个人服务访问凭证" />

      <div className="flex-1 min-h-0 rounded-xl border border-border/75 bg-white p-4 shadow-sm overflow-hidden">
        <Tabs defaultValue="settings" className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          <TabsList className="h-9 w-fit rounded-lg bg-slate-100/80 p-1 border-none">
            <TabsTrigger value="settings" className="h-7 px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              个人设置
            </TabsTrigger>
            <TabsTrigger value="mcp" className="h-7 px-4 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              个人凭证
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-0 min-h-0 flex-1 overflow-auto">
            <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
              <Card className="rounded-xl border-border/70 bg-white shadow-none">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <UserRound size={15} /> 头像设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="group relative h-16 w-16 overflow-hidden rounded-full border border-border bg-transparent">
                      <Avatar className="h-full w-full">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={profile.name} className="object-cover" />}
                        <AvatarFallback className="bg-neutral-900 text-base font-bold text-white">{initial}</AvatarFallback>
                      </Avatar>
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera size={16} />
                      </span>
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-foreground">{profile.name}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{profile.email}</div>
                      <div className="mt-1 text-xs text-muted-foreground">点击头像上传 JPG/PNG/WebP，保存为 256x256</div>
                    </div>
                  </div>
                  {profileMessage && <BasicAlert title={profileMessage} />}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleAvatarSave} disabled={profileSaving} className="h-8 gap-1.5 rounded-lg text-xs font-semibold">
                      <Save size={13} /> 保存头像
                    </Button>
                    <Button variant="outline" onClick={openPasswordDialog} className="h-8 gap-1.5 rounded-lg border-border/70 text-xs font-semibold">
                      <LockKeyhole size={13} /> 重置密码
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/70 bg-white shadow-none">
                <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Shield size={15} /> 个人信息
                  </CardTitle>
                  <Badge variant={profile.status === "active" ? "success" : "secondary"}>{profile.status === "active" ? "启用" : "禁用"}</Badge>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-2">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <InfoItem label="姓名" value={profile.name} />
                    <InfoItem label="工号" value={profile.member_no} />
                    <InfoItem label="手机号" value={profile.phone} />
                    <InfoItem label="邮箱" value={profile.email} />
                    <InfoItem label="部门" value={profile.department} />
                    <InfoItem label="角色" value={profile.role_name} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="mcp" className="mt-0 min-h-0 flex-1 overflow-auto">
            <Card className="rounded-xl border-border/70 bg-white shadow-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <KeyRound size={15} /> 个人服务访问凭证
                </CardTitle>
                <Button variant="outline" disabled={credentialLoading} onClick={handleCredentialReset} className="h-8 gap-1.5 rounded-lg border-border/70 text-xs font-semibold">
                  <RefreshCw size={13} className={credentialLoading ? "animate-spin" : ""} /> 重置凭证
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-2">
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoItem label="凭证名称" value={credential?.name ?? "Personal Service Access Credential"} />
                  <InfoItem label="创建时间" value={fmtTime(credential?.created_at)} />
                  <InfoItem label="最近重置" value={fmtTime(credential?.updated_at)} />
                </div>
                <div className="rounded-lg border border-dashed border-border bg-slate-50/70 p-3">
                  <div className="text-xs font-semibold text-muted-foreground">个人服务访问凭证</div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-h-9 flex-1 rounded-lg border border-border bg-white px-3 py-2 font-mono text-[13px] font-medium tracking-wide text-foreground leading-5 break-all select-all">
                      {showFullKey ? (credential?.key ?? "—") : (credential?.masked_key ?? "正在生成默认个人服务访问凭证…")}
                    </div>
                    <Button variant="outline" disabled={!credential?.key} onClick={handleCopyKey} className="h-9 gap-1.5 rounded-lg border-border/70 text-xs font-semibold shrink-0">
                      {copyDone ? <Check size={13} /> : <Copy size={13} />}
                      {copyDone ? "已复制" : "复制凭证"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {showFullKey
                      ? "完整凭证当前可见，刷新页面后将自动隐藏为掩码。"
                      : "复制凭证将获取完整明文；重置后将展示明文并使旧凭证立即失效。"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>密码重置成功后，当前会话将失效并返回登录页。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">当前密码</Label>
              <div className="relative">
                <Input name="profile-current-password" autoComplete="off" type={showPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-9 pr-9 text-xs" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1 h-7 w-7 rounded-lg text-muted-foreground">
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">新密码</Label>
              <div className="relative">
                <Input name="profile-new-password" autoComplete="off" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-9 pr-9 text-xs" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1 h-7 w-7 rounded-lg text-muted-foreground">
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">确认新密码</Label>
              <div className="relative">
                <Input name="profile-confirm-password" autoComplete="off" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-9 pr-9 text-xs" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1 h-7 w-7 rounded-lg text-muted-foreground">
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </Button>
              </div>
            </div>
            {passwordError && <DestructiveAlert title={passwordError} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)} className="h-8 rounded-lg text-xs">取消</Button>
            <Button onClick={handlePasswordReset} disabled={passwordSaving} className="h-8 rounded-lg text-xs">确认重置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
