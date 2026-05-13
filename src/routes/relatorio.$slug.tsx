import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Printer,
  Loader2,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
  CheckCircle2,
  CalendarCheck,
  GraduationCap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/relatorio/$slug")({
  component: ReportPage,
});

// Deterministic mock data generator (until BI data source is wired in)
function buildReport(seed: string) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  const totalStudents = 120 + Math.floor(rng() * 180);
  const attendanceAvg = 78 + rng() * 18;
  const gradeAvg = 6 + rng() * 3;
  const approvalRate = 70 + rng() * 25;

  const turmas = ["1º Ano A", "1º Ano B", "2º Ano A", "2º Ano B", "3º Ano A"].map((t) => ({
    turma: t,
    media: +(5 + rng() * 4.5).toFixed(1),
    presenca: +(70 + rng() * 28).toFixed(1),
    alunos: 20 + Math.floor(rng() * 25),
  }));

  const disciplinas = [
    "Português",
    "Matemática",
    "Ciências",
    "História",
    "Geografia",
    "Inglês",
  ].map((d) => ({
    disciplina: d,
    media: +(5 + rng() * 4.5).toFixed(1),
    aprovacao: +(60 + rng() * 35).toFixed(0),
  }));

  const evolucao = ["Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out"].map(
    (mes, i) => ({
      mes,
      media: +(6 + rng() * 2 + i * 0.05).toFixed(2),
      presenca: +(75 + rng() * 18).toFixed(1),
    }),
  );

  const distribuicao = [
    { faixa: "Excelente (9-10)", valor: Math.floor(totalStudents * (0.1 + rng() * 0.1)) },
    { faixa: "Bom (7-8.9)", valor: Math.floor(totalStudents * (0.3 + rng() * 0.15)) },
    { faixa: "Regular (5-6.9)", valor: Math.floor(totalStudents * (0.25 + rng() * 0.15)) },
    { faixa: "Insuficiente (<5)", valor: Math.floor(totalStudents * (0.05 + rng() * 0.15)) },
  ];

  const nomes = [
    "Ana Silva", "Bruno Costa", "Carla Mendes", "Diego Souza", "Eduarda Lima",
    "Felipe Rocha", "Gabriela Alves", "Henrique Dias", "Isabela Martins", "João Pereira",
    "Karina Ribeiro", "Lucas Ferreira", "Mariana Gomes", "Nicolas Barbosa", "Olívia Cardoso",
  ];
  const alunosRisco = nomes
    .map((nome) => ({
      nome,
      turma: turmas[Math.floor(rng() * turmas.length)].turma,
      media: +(2 + rng() * 4.8).toFixed(1),
      presenca: +(40 + rng() * 35).toFixed(0),
      faltas: Math.floor(rng() * 25) + 5,
    }))
    .filter((a) => a.media < 6 || a.presenca < 75)
    .sort((a, b) => a.media - b.media)
    .slice(0, 8);

  const destaques = nomes
    .map((nome) => ({
      nome,
      turma: turmas[Math.floor(rng() * turmas.length)].turma,
      media: +(8.5 + rng() * 1.5).toFixed(1),
      presenca: +(92 + rng() * 8).toFixed(0),
    }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 5);

  return {
    kpis: {
      totalStudents,
      attendanceAvg: +attendanceAvg.toFixed(1),
      gradeAvg: +gradeAvg.toFixed(2),
      approvalRate: +approvalRate.toFixed(1),
    },
    turmas,
    disciplinas,
    evolucao,
    distribuicao,
    alunosRisco,
    destaques,
  };
}

const COLORS = ["#16a34a", "#3b82f6", "#f59e0b", "#ef4444"];

function ReportPage() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  const { data: assoc, isLoading } = useQuery({
    queryKey: ["assoc-report", slug, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("associations")
        .select("id, name, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const report = useMemo(() => buildReport(slug), [slug]);
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!assoc) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <div className="m-auto text-center">
          <p className="font-medium">Associação indisponível.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/dashboard">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }

  const k = report.kpis;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="print:hidden">
        <AppHeader />
      </div>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-8 print:px-0 print:py-0">
        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link to="/bi/$slug" params={{ slug }}>
              <ArrowLeft className="h-4 w-4" />
              Voltar ao painel
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir / Exportar PDF
          </Button>
        </div>

        {/* Report header */}
        <header className="border-b border-border pb-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
            Relatório Pedagógico · {assoc.name}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Desempenho dos Alunos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada para análise docente · Emitido em {today}
          </p>
        </header>

        {/* KPIs */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Users className="h-5 w-5" />}
            label="Alunos ativos"
            value={k.totalStudents.toString()}
            hint="Matriculados no período"
          />
          <KpiCard
            icon={<CalendarCheck className="h-5 w-5" />}
            label="Frequência média"
            value={`${k.attendanceAvg}%`}
            hint={k.attendanceAvg >= 85 ? "Acima da meta" : "Abaixo da meta (85%)"}
            trend={k.attendanceAvg >= 85 ? "up" : "down"}
          />
          <KpiCard
            icon={<Award className="h-5 w-5" />}
            label="Nota média geral"
            value={k.gradeAvg.toFixed(2)}
            hint="Escala 0–10"
            trend={k.gradeAvg >= 7 ? "up" : "down"}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Taxa de aprovação"
            value={`${k.approvalRate}%`}
            hint="Projeção bimestral"
            trend={k.approvalRate >= 80 ? "up" : "down"}
          />
        </section>

        {/* Executive summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Resumo executivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              A associação <strong className="text-foreground">{assoc.name}</strong> registra{" "}
              <strong className="text-foreground">{k.totalStudents}</strong> alunos no período
              analisado, com nota média geral de{" "}
              <strong className="text-foreground">{k.gradeAvg.toFixed(2)}</strong> e frequência
              de <strong className="text-foreground">{k.attendanceAvg}%</strong>.
            </p>
            <p>
              {k.approvalRate >= 80
                ? `O índice de aprovação projetado (${k.approvalRate}%) está dentro da meta institucional.`
                : `Atenção: o índice de aprovação projetado (${k.approvalRate}%) está abaixo da meta de 80%. Recomenda-se reforço nas turmas com menor desempenho.`}{" "}
              {report.alunosRisco.length} alunos foram identificados em situação de risco e estão
              listados ao final deste relatório para acompanhamento individual.
            </p>
          </CardContent>
        </Card>

        {/* Evolution + Distribution */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Evolução mensal</CardTitle>
              <CardDescription>Nota média e frequência ao longo do ano letivo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={report.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="media"
                    name="Nota média"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="presenca"
                    name="Presença %"
                    stroke="#16a34a"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de notas</CardTitle>
              <CardDescription>Quantos alunos em cada faixa</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={report.distribuicao}
                    dataKey="valor"
                    nameKey="faixa"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {report.distribuicao.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1 text-xs">
                {report.distribuicao.map((d, i) => (
                  <div key={d.faixa} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: COLORS[i] }}
                      />
                      {d.faixa}
                    </span>
                    <span className="font-medium text-foreground">{d.valor}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* By class + by subject */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por turma</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={report.turmas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="turma" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="media" name="Média" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="presenca" name="Presença %" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por disciplina</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Disciplina</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                    <TableHead className="text-right">Aprovação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.disciplinas.map((d) => (
                    <TableRow key={d.disciplina}>
                      <TableCell className="font-medium">{d.disciplina}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge
                          variant={d.media >= 7 ? "default" : d.media >= 5 ? "secondary" : "destructive"}
                        >
                          {d.media.toFixed(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.aprovacao}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* At risk students */}
        <Card className="mt-6 border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alunos em situação de risco
            </CardTitle>
            <CardDescription>
              Estudantes com média &lt; 6 ou frequência &lt; 75% — recomendar acompanhamento individual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead className="text-right">Média</TableHead>
                  <TableHead className="text-right">Presença</TableHead>
                  <TableHead className="text-right">Faltas</TableHead>
                  <TableHead>Indicador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.alunosRisco.map((a) => (
                  <TableRow key={a.nome}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell>{a.turma}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.media.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.presenca}%</TableCell>
                    <TableCell className="text-right tabular-nums">{a.faltas}</TableCell>
                    <TableCell>
                      {a.media < 5 ? (
                        <Badge variant="destructive" className="gap-1">
                          <TrendingDown className="h-3 w-3" /> Crítico
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Atenção
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Highlights */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-primary" />
              Destaques do período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead className="text-right">Média</TableHead>
                  <TableHead className="text-right">Presença</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.destaques.map((a) => (
                  <TableRow key={a.nome}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell>{a.turma}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.media.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.presenca}%</TableCell>
                    <TableCell>
                      <Badge variant="default" className="gap-1">
                        <TrendingUp className="h-3 w-3" /> Destaque
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Recomendações pedagógicas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Promover plantões de reforço para alunos identificados na faixa{" "}
                <strong className="text-foreground">Insuficiente</strong>.
              </li>
              <li>
                Acompanhar individualmente os {report.alunosRisco.length} alunos listados na seção
                de risco — agendar reunião com responsáveis.
              </li>
              <li>
                Revisar a metodologia em disciplinas com média abaixo de 6, priorizando avaliações
                diagnósticas.
              </li>
              <li>
                Reconhecer publicamente os alunos destaque, fortalecendo a cultura de mérito da
                associação.
              </li>
              <li>
                Monitorar a evolução mensal — qualquer queda superior a 0,5 ponto na média deve
                acionar plano de ação.
              </li>
            </ul>
          </CardContent>
        </Card>

        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          Relatório gerado automaticamente · {assoc.name} · {today}
        </footer>
      </main>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-500" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-destructive" />}
        </div>
        <div className="mt-3 text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs font-medium text-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}
