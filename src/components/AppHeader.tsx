import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/dashboard" className="flex items-center gap-3">
          <Logo className="h-9 w-auto" />
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            BI Hub
          </span>
        </Link>
        {user && (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin"><ShieldCheck className="h-4 w-4" />Admin</Link>
              </Button>
            )}
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
