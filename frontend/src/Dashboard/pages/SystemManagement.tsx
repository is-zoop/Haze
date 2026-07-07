import { useEffect, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/PageHeader";
import { DestructiveAlert, FloatingAlert, type FlashMessage } from "@/components/ui/alert";
import { getI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import { BusinessCategory, createBusinessCategory, deleteBusinessCategory, listBusinessCategories, updateBusinessCategory } from "@/lib/businessCategories";

const L = {
  title: "\u7cfb\u7edf\u7ba1\u7406", description: "\u914d\u7f6e Haze \u7cfb\u7edf\u7684\u516c\u5171\u4e1a\u52a1\u8bbe\u7f6e", tab: "\u4e1a\u52a1\u5206\u7c7b\u8bbe\u7f6e",
  add: "\u65b0\u589e\u5206\u7c7b", category: "\u4e1a\u52a1\u5206\u7c7b", detail: "\u5206\u7c7b\u63cf\u8ff0", creator: "\u521b\u5efa\u4eba", created: "\u521b\u5efa\u65f6\u95f4",
  updater: "\u6700\u8fd1\u4fee\u6539\u4eba", updated: "\u4fee\u6539\u65f6\u95f4", action: "\u64cd\u4f5c", edit: "\u7f16\u8f91", remove: "\u5220\u9664", empty: "\u6682\u65e0\u4e1a\u52a1\u5206\u7c7b",
  loading: "\u6b63\u5728\u52a0\u8f7d...", cancel: "\u53d6\u6d88", save: "\u4fdd\u5b58", saving: "\u4fdd\u5b58\u4e2d...", required: "\u8bf7\u8f93\u5165\u4e1a\u52a1\u5206\u7c7b",
};
const formatTime = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });

export function SystemManagement({ langCode = "ZH" }: { langCode?: "ZH" | "EN" | "JA" | "ES" }) {
  const t = getI18n(langCode);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [items, setItems] = useState<BusinessCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessCategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => { setLoading(true); try { setItems(await listBusinessCategories()); } catch (cause) { setError(cause instanceof Error ? cause.message : t.systemLoadFailed); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const openCreate = () => { setEditing(null); setName(""); setDescription(""); setError(""); setDialogOpen(true); };
  const openEdit = (item: BusinessCategory) => { setEditing(item); setName(item.name); setDescription(item.description ?? ""); setError(""); setDialogOpen(true); };
  const save = async () => {
    const cleanName = name.trim(); if (!cleanName) { setError(L.required); return; }
    setSaving(true); setError("");
    try { const payload = { name: cleanName, description: description.trim() || null }; if (editing) await updateBusinessCategory(editing.id, payload); else await createBusinessCategory(payload); setDialogOpen(false); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.systemSaveFailed); } finally { setSaving(false); }
  };
  const remove = async (item: BusinessCategory) => {
    if (!window.confirm(`\u786e\u5b9a\u5220\u9664\u4e1a\u52a1\u5206\u7c7b\u201c${item.name}\u201d\u5417\uff1f`)) return;
    try { await deleteBusinessCategory(item.id); await load(); } catch (cause) { setFlash({ type: "error", title: t.alertOperationFailedTitle, description: cause instanceof ApiError ? cause.message : t.systemDeleteFailed }); window.setTimeout(() => setFlash(null), 3000); }
  };
  return <div className="dashboard-page-stack h-full overflow-hidden text-left font-sans flex flex-col gap-3 animate-in fade-in duration-300">
    {flash && <FloatingAlert {...flash} />}
    <PageHeader title={L.title} description={L.description} actions={<Button onClick={openCreate}><Plus />{L.add}</Button>} />
    <Tabs defaultValue="categories" className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/70 bg-white shadow-xs p-4 pt-2.5">
      <div className="flex items-center border-b border-border/70"><TabsList className="h-10 bg-transparent p-0"><TabsTrigger value="categories" className="h-10 rounded-none border-b-2 border-transparent px-4 text-xs font-bold data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">{L.tab}</TabsTrigger></TabsList></div>
      <TabsContent value="categories" className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-border/70"><Table><TableHeader><TableRow><TableHead>{L.category}</TableHead><TableHead>{L.detail}</TableHead><TableHead>{L.creator}</TableHead><TableHead>{L.created}</TableHead><TableHead>{L.updater}</TableHead><TableHead>{L.updated}</TableHead><TableHead className="w-44" data-table-action="true">{L.action}</TableHead></TableRow></TableHeader>
        <TableBody>{items.map((item) => <TableRow key={item.id}><TableCell className="font-medium text-slate-900">{item.name}</TableCell><TableCell className="max-w-64 truncate text-muted-foreground">{item.description || "-"}</TableCell><TableCell>{item.created_by || "-"}</TableCell><TableCell>{formatTime(item.created_at)}</TableCell><TableCell>{item.updated_by || "-"}</TableCell><TableCell>{formatTime(item.updated_at)}</TableCell><TableCell className="text-left" data-table-action="true"><ButtonGroup><Button variant="outline" size="sm" onClick={() => openEdit(item)}><Edit3 />{L.edit}</Button><Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => void remove(item)}><Trash2 />{L.remove}</Button></ButtonGroup></TableCell></TableRow>)}
        {!loading && items.length === 0 && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{L.empty}</TableCell></TableRow>}{loading && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{L.loading}</TableCell></TableRow>}</TableBody>
      </Table></TabsContent>
    </Tabs>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editing ? `${L.edit}${L.category}` : L.add}</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><label className="text-sm font-medium">{L.category} <span className="text-destructive">*</span></label><Input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder={L.required} /></div><div className="space-y-2"><label className="text-sm font-medium">{L.detail}</label><Textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={4} /></div>{error && <DestructiveAlert title={error} />}</div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{L.cancel}</Button><Button disabled={saving} onClick={() => void save()}>{saving ? L.saving : L.save}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
