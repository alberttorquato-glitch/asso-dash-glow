import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Shield, ShieldCheck, User as UserIcon, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { createUserAdmin, deleteUserAdmin } from "@/lib/admin-users.functions";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Profile = { id: string; email: string | null; full_name: string | null };
type Assoc = { id: string; name: string; slug: string };

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createUserFn = useServerFn(createUserAdmin);
  const deleteUserFn = useServerFn(deleteUserAdmin);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: "", email: "", password: "", isAdmin: false,
    associationIds: new Set<string>(),
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
  }, [user, authLoading, navigate]);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id, email, full_name").order("email");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as { user_id: string; role: "admin" | "user" }[];
    },
  });

  const { data: associations } = useQuery({
    queryKey: ["admin-associations"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("associations").select("id, name, slug").order("name");
      if (error) throw error;
      return data as Assoc[];
    },
  });

  const { data: links, refetch: refetchLinks } = useQuery({
    queryKey: ["admin-links", selectedUserId],
    enabled: !!isAdmin && !!selectedUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_associations").select("association_id").eq("user_id", selectedUserId!);
      if (error) throw error;
      return new Set(data.map((d) => d.association_id));
    },
  });

  const filtered = useMemo(() => {
    if (!users) return [];
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter(
      (u) => (u.email ?? "").toLowerCase().includes(t) || (u.full_name ?? "").toLowerCase().includes(t),
    );
  }, [users, q]);

  const isUserAdmin = (uid: string) => roles?.some((r) => r.user_id === uid && r.role === "admin") ?? false;

  const toggleAssociation = async (associationId: string, checked: boolean) => {
    if (!selectedUserId) return;
    if (checked) {
      const { error } = await supabase
        .from("user_associations").insert({ user_id: selectedUserId, association_id: associationId });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_associations").delete()
        .eq("user_id", selectedUserId).eq("association_id", associationId);
      if (error) return toast.error(error.message);
    }
    refetchLinks();
  };

  const toggleAdmin = async (uid: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Promovido a admin");
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Permissão de admin removida");
    }
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      return toast.error("Preencha nome, email e senha");
    }
    setCreateBusy(true);
    try {
      await createUserFn({
        data: {
          email: newUser.email.trim(),
          password: newUser.password,
          fullName: newUser.fullName.trim(),
          isAdmin: newUser.isAdmin,
          associationIds: Array.from(newUser.associationIds),
        },
      });
      toast.success("Usuário criado com sucesso");
      setCreateOpen(false);
      setNewUser({ fullName: "", email: "", password: "", isAdmin: false, associationIds: new Set() });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao criar usuário");
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm("Excluir este usuário? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteUserFn({ data: { userId: uid } });
      toast.success("Usuário excluído");
      if (selectedUserId === uid) setSelectedUserId(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao excluir");
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <AppHeader />
        <main className="mx-auto max-w-md px-6 py-20 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva para administradores.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/dashboard">Voltar aos painéis</Link>
          </Button>
        </main>
      </div>
    );
  }

  const selectedUser = users?.find((u) => u.id === selectedUserId);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Administração
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Usuários e acessos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre usuários e defina quais associações cada um pode visualizar.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard">Ver painéis</Link>
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-elegant">
                  <UserPlus className="h-4 w-4" />
                  Novo usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Cadastrar novo usuário</DialogTitle>
                  <DialogDescription>
                    Defina as credenciais e selecione quais associações o usuário poderá acessar.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nu-name">Nome completo</Label>
                    <Input id="nu-name" value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} required />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nu-email">Email</Label>
                      <Input id="nu-email" type="email" value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nu-password">Senha</Label>
                      <Input id="nu-password" type="text" value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        minLength={6} required />
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Administrador (master)</p>
                      <p className="text-xs text-muted-foreground">Acesso total a todas as associações</p>
                    </div>
                    <Switch checked={newUser.isAdmin}
                      onCheckedChange={(c) => setNewUser({ ...newUser, isAdmin: c })} />
                  </label>
                  {!newUser.isAdmin && (
                    <div>
                      <p className="text-sm font-medium">Associações</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Selecione os painéis que estarão disponíveis.</p>
                      <div className="mt-3 grid max-h-52 gap-1.5 overflow-y-auto rounded-lg border border-border bg-background p-2 sm:grid-cols-2">
                        {associations?.map((a) => {
                          const checked = newUser.associationIds.has(a.id);
                          return (
                            <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                              <Checkbox checked={checked} onCheckedChange={(c) => {
                                const next = new Set(newUser.associationIds);
                                if (c) next.add(a.id); else next.delete(a.id);
                                setNewUser({ ...newUser, associationIds: next });
                              }} />
                              <span className="truncate">{a.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createBusy} className="bg-gradient-primary">
                      {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar usuário"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Lista de usuários */}
          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar usuário..." className="pl-9" />
              </div>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-2">
              {!users ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum usuário</p>
              ) : (
                filtered.map((u) => {
                  const active = u.id === selectedUserId;
                  const admin = isUserAdmin(u.id);
                  return (
                    <button key={u.id} onClick={() => setSelectedUserId(u.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                      }`}>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? "bg-gradient-primary text-primary-foreground" : "bg-muted"}`}>
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.full_name || "Sem nome"}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      {admin && <Badge variant="secondary" className="shrink-0 text-[10px]">admin</Badge>}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Detalhe do usuário */}
          <section className="rounded-2xl border border-border bg-card shadow-card">
            {!selectedUser ? (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 p-10 text-center">
                <UserIcon className="h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium">Selecione um usuário</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Escolha um usuário à esquerda para gerenciar suas associações e permissões.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-6">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{selectedUser.full_name || "Sem nome"}</h2>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                      <div className="text-right">
                        <p className="text-xs font-medium">Administrador</p>
                        <p className="text-[11px] text-muted-foreground">Acesso total</p>
                      </div>
                      <Switch checked={isUserAdmin(selectedUser.id)}
                        disabled={selectedUser.id === user?.id}
                        onCheckedChange={(c) => toggleAdmin(selectedUser.id, c)} />
                    </label>
                    {selectedUser.id !== user?.id && (
                      <Button variant="outline" size="icon"
                        onClick={() => handleDeleteUser(selectedUser.id)}
                        title="Excluir usuário">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-sm font-semibold">Associações que pode acessar</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Marque as associações cujos painéis devem aparecer para este usuário.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {associations?.map((a) => {
                      const checked = links?.has(a.id) ?? false;
                      return (
                        <label key={a.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                            checked ? "border-primary/50 bg-accent/40" : "border-border bg-background hover:bg-muted/40"
                          }`}>
                          <Checkbox checked={checked} onCheckedChange={(c) => toggleAssociation(a.id, !!c)} />
                          <span className="text-sm font-medium">{a.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
