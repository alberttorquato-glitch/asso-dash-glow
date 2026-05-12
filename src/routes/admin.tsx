import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Shield, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
  }, [user, authLoading, navigate]);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("email");
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
        .from("associations")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return data as Assoc[];
    },
  });

  const { data: links, refetch: refetchLinks } = useQuery({
    queryKey: ["admin-links", selectedUserId],
    enabled: !!isAdmin && !!selectedUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_associations")
        .select("association_id")
        .eq("user_id", selectedUserId!);
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
        .from("user_associations")
        .insert({ user_id: selectedUserId, association_id: associationId });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_associations")
        .delete()
        .eq("user_id", selectedUserId)
        .eq("association_id", associationId);
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
              Defina quais associações cada usuário pode visualizar.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Ver painéis</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Lista de usuários */}
          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar usuário..."
                  className="pl-9"
                />
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
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                      }`}
                    >
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
                  <label className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-right">
                      <p className="text-xs font-medium">Administrador</p>
                      <p className="text-[11px] text-muted-foreground">Acesso total</p>
                    </div>
                    <Switch
                      checked={isUserAdmin(selectedUser.id)}
                      disabled={selectedUser.id === user?.id}
                      onCheckedChange={(c) => toggleAdmin(selectedUser.id, c)}
                    />
                  </label>
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
                        <label
                          key={a.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                            checked ? "border-primary/50 bg-accent/40" : "border-border bg-background hover:bg-muted/40"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleAssociation(a.id, !!c)}
                          />
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
