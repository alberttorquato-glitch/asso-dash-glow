import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Maximize2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bi/$slug")({
  component: BiPage,
});

function BiPage() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["association", slug, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("associations")
        .select("id, name, slug, bi_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const openFullscreen = () => {
    const iframe = document.getElementById("bi-frame") as HTMLIFrameElement | null;
    iframe?.requestFullscreen?.();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" />Voltar</Link>
            </Button>
            <div>
              <h1 className="font-display text-xl font-semibold">
                {data?.name ?? (isLoading ? "Carregando..." : "Painel")}
              </h1>
              <p className="text-xs text-muted-foreground">Power BI · ao vivo</p>
            </div>
          </div>
          {data && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openFullscreen}>
                <Maximize2 className="h-4 w-4" />Tela cheia
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={data.bi_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />Abrir
                </a>
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !data ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-32 text-center">
              <p className="font-medium">Painel indisponível</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {error ? "Erro ao carregar." : "Você não tem acesso a esta associação ou ela não existe."}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">Voltar para os painéis</Link>
              </Button>
            </div>
          ) : (
            <iframe
              id="bi-frame"
              title={data.name}
              src={data.bi_url}
              className="h-[calc(100vh-200px)] min-h-[600px] w-full border-0"
              allowFullScreen
            />
          )}
        </div>
      </main>
    </div>
  );
}
