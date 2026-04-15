"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Calendar,
  CheckCircle,
  DollarSign,
  Target,
  Clock,
  Loader2,
  Filter,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────

interface DashboardStats {
  meetingsThisWeek: number;
  rsvpRate: number;
  pipelineInfluenced: number;
  pipelineOppCount: number;
  avgGoalProgress: number;
  activeGoalCount: number;
}

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string | null;
  durationMinutes: number;
  externalAttendeeName: string | null;
  externalAttendeeCompany: string | null;
  externalRsvpStatus: string | null;
}

interface Goal {
  id: string;
  name: string;
  type: string | null;
  period: string | null;
  targetValue: number;
  currentValue: number | null;
  unit: string | null;
  periodStart: string;
  periodEnd: string;
}

interface PipelineStage {
  stageName: string;
  totalAmount: number;
  count: number;
}

interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  createdAt: string | null;
}

interface DashboardData {
  stats: DashboardStats;
  upcomingMeetings: Meeting[];
  goals: Goal[];
  pipelineSummary: PipelineStage[];
  recentActivity: AuditEntry[];
}

interface EventOption {
  id: string;
  name: string;
}

// ─── Color constants ─────────────────────────────────────────────────

const PIPELINE_COLORS = [
  "#0070f3", // blue
  "#7928ca", // purple
  "#ff0080", // pink
  "#f5a623", // amber
  "#00a878", // green
  "#06b6d4", // cyan
  "#ef4444", // red
  "#8b5cf6", // violet
];

const STAT_CONFIGS: {
  title: string;
  key: keyof DashboardStats;
  format: (v: number) => string;
  description: (stats: DashboardStats) => string;
  icon: LucideIcon;
  color: string;
  bg: string;
}[] = [
  {
    title: "Meetings This Week",
    key: "meetingsThisWeek",
    format: (v) => v.toString(),
    description: () => "Confirmed, pending, and completed",
    icon: Calendar,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "RSVP Rate",
    key: "rsvpRate",
    format: (v) => `${v}%`,
    description: () => "Accepted / total confirmed meetings",
    icon: CheckCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Pipeline Influenced",
    key: "pipelineInfluenced",
    format: formatCurrency,
    description: (s) =>
      `Across ${s.pipelineOppCount} opportunit${s.pipelineOppCount === 1 ? "y" : "ies"}`,
    icon: DollarSign,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    title: "Goal Progress",
    key: "avgGoalProgress",
    format: (v) => `${v}%`,
    description: (s) =>
      `Average across ${s.activeGoalCount} active goal${s.activeGoalCount === 1 ? "" : "s"}`,
    icon: Target,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function getRsvpColor(status: string | null): string {
  switch (status) {
    case "accepted":
      return "border-l-emerald-500";
    case "tentative":
      return "border-l-amber-500";
    case "declined":
      return "border-l-red-500";
    default:
      return "border-l-muted-foreground/30";
  }
}

function getRsvpBadgeVariant(
  status: string | null
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "accepted":
      return "default";
    case "tentative":
      return "secondary";
    case "declined":
      return "destructive";
    default:
      return "outline";
  }
}

function getRsvpLabel(status: string | null): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "tentative":
      return "Tentative";
    case "declined":
      return "Declined";
    case "needsAction":
      return "Pending";
    default:
      return "Unknown";
  }
}

function getActivityDot(action: string): string {
  if (action.startsWith("create")) return "bg-emerald-500";
  if (action.startsWith("update") || action.startsWith("edit"))
    return "bg-blue-500";
  if (action.startsWith("delete") || action.startsWith("cancel"))
    return "bg-red-500";
  return "bg-muted-foreground";
}

function getActivityIcon(action: string): LucideIcon {
  if (action.startsWith("create")) return Plus;
  if (action.startsWith("update") || action.startsWith("edit")) return Pencil;
  if (action.startsWith("delete") || action.startsWith("cancel")) return Trash2;
  return Pencil;
}

function getActionLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getGoalColor(pct: number): string {
  if (pct >= 75) return "#00a878";
  if (pct >= 25) return "#f5a623";
  return "#ef4444";
}

function formatDashboardValue(value: number, unit: string | null): string {
  if (unit === "$") {
    return value >= 1_000_000
      ? `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
      : value >= 1_000
        ? `$${(value / 1_000).toFixed(0)}K`
        : `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

// ─── Animated Counter ────────────────────────────────────────────────

function AnimatedValue({
  value,
  formatter,
}: {
  value: number;
  formatter: (v: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = 0;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(tick);
      }
    }

    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value]);

  return <>{formatter(display)}</>;
}

// ─── Custom Tooltip ──────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString());
  return (
    <div className="rounded-xl border border-white/10 bg-card/95 px-3 py-2 shadow-2xl backdrop-blur-xl">
      {label && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-semibold">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Radial Goal Ring ────────────────────────────────────────────────

function GoalRing({
  name,
  current,
  target,
  unit,
  type,
  period,
}: {
  name: string;
  current: number;
  target: number;
  unit: string | null;
  type: string | null;
  period: string | null;
}) {
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const color = getGoalColor(pct);
  const data = [
    { value: pct },
    { value: 100 - pct },
  ];

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-16 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={22}
              outerRadius={30}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              <Cell fill={color} />
              <Cell fill="var(--muted)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold font-mono" style={{ color }}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDashboardValue(current, unit)} / {formatDashboardValue(target, unit)}{unit && unit !== "$" ? ` ${unit}` : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events?active=true");
        if (res.ok) {
          const data = await res.json();
          setEvents(
            data.map((e: { id: string; name: string }) => ({
              id: e.id,
              name: e.name,
            }))
          );
        }
      } catch {}
    }
    fetchEvents();
  }, []);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const params =
          selectedEventId && selectedEventId !== "all"
            ? `?eventId=${selectedEventId}`
            : "";
        const res = await fetch(`/api/dashboard${params}`);
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [selectedEventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your meeting coordination activity.
          </p>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {error ?? "Failed to load dashboard data. Please try again."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, upcomingMeetings, goals, pipelineSummary, recentActivity } =
    data;

  const totalPipeline = pipelineSummary.reduce(
    (sum, s) => sum + s.totalAmount,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your meeting coordination activity.
          </p>
        </div>
        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="w-[220px]">
            <Filter className="size-4 mr-2" />
            <SelectValue placeholder="All Events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CONFIGS.map((stat) => (
          <Card
            key={stat.title}
            className="group transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/10"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div
                className={`flex size-8 items-center justify-center rounded-lg ${stat.bg} transition-transform duration-300 group-hover:scale-110`}
              >
                <stat.icon className={`size-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight font-mono">
                <AnimatedValue
                  value={stats[stat.key] as number}
                  formatter={stat.format}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stat.description(stats)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Pipeline Donut + Goal Rings ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pipeline Donut */}
        <Card className="transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pipeline Summary</CardTitle>
                <CardDescription>
                  Opportunity dollar amounts by stage
                </CardDescription>
              </div>
              {totalPipeline > 0 && (
                <div className="flex items-center gap-1 text-sm font-medium text-emerald-500">
                  <TrendingUp className="size-4" />
                  {formatCurrency(totalPipeline)}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pipelineSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pipeline data available.
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pipelineSummary}
                      dataKey="totalAmount"
                      nameKey="stageName"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={100}
                      strokeWidth={2}
                      stroke="var(--background)"
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {pipelineSummary.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIPELINE_COLORS[index % PIPELINE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={
                        <ChartTooltip valueFormatter={formatCurrency} />
                      }
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    {/* Center label */}
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-foreground text-2xl font-bold font-mono"
                    >
                      {formatCurrency(totalPipeline)}
                    </text>
                    <text
                      x="50%"
                      y="55%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-muted-foreground text-xs"
                    >
                      Total Pipeline
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goal Progress Rings */}
        <Card className="transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/10">
          <CardHeader>
            <CardTitle>Goal Progress</CardTitle>
            <CardDescription>
              Active goals and their current progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active goals. Create a goal to start tracking progress.
              </p>
            ) : (
              <div className="space-y-5">
                {goals.map((goal) => (
                  <GoalRing
                    key={goal.id}
                    name={goal.name}
                    current={goal.currentValue ?? 0}
                    target={goal.targetValue}
                    unit={goal.unit}
                    type={goal.type}
                    period={goal.period}
                  />
                ))}

                {/* Bar chart — only show when goals share the same unit */}
                {goals.length > 1 && new Set(goals.map((g) => g.unit)).size === 1 && (
                  <div className="mt-2 h-44 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={goals.map((g) => ({
                          name:
                            g.name.length > 12
                              ? `${g.name.slice(0, 12)}...`
                              : g.name,
                          current: g.currentValue ?? 0,
                          target: g.targetValue,
                        }))}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={35}
                        />
                        <RechartsTooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="current"
                          name="Current"
                          fill="#0070f3"
                          radius={[6, 6, 0, 0]}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                        <Bar
                          dataKey="target"
                          name="Target"
                          fill="var(--muted)"
                          radius={[6, 6, 0, 0]}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Meetings + Activity ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming Meetings */}
        <Card className="transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/10">
          <CardHeader>
            <CardTitle>Upcoming Meetings</CardTitle>
            <CardDescription>
              Next 7 days of scheduled meetings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Calendar className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No upcoming meetings in the next 7 days.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className={`flex items-start gap-3 rounded-lg border border-l-4 ${getRsvpColor(meeting.externalRsvpStatus)} p-3 transition-all duration-200 hover:bg-accent/50 hover:-translate-y-0.5 hover:shadow-sm`}
                  >
                    <div className="flex flex-col items-center justify-center rounded-md bg-muted px-2 py-1 text-center min-w-[52px]">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        {format(parseISO(meeting.startTime), "EEE")}
                      </span>
                      <span className="text-sm font-bold font-mono">
                        {format(parseISO(meeting.startTime), "h:mm")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(meeting.startTime), "a")}
                      </span>
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium leading-none truncate">
                          {meeting.title}
                        </p>
                        <Badge
                          variant={getRsvpBadgeVariant(
                            meeting.externalRsvpStatus
                          )}
                          className="shrink-0"
                        >
                          {getRsvpLabel(meeting.externalRsvpStatus)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {meeting.durationMinutes} min
                      </p>
                      {meeting.externalAttendeeName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {meeting.externalAttendeeName}
                          {meeting.externalAttendeeCompany
                            ? ` at ${meeting.externalAttendeeCompany}`
                            : ""}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/10">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest changes and updates across your meetings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Clock className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No recent activity to display.
                </p>
              </div>
            ) : (
              <div className="relative space-y-0 max-h-[380px] overflow-y-auto pr-1">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                {recentActivity.map((entry) => {
                  const Icon = getActivityIcon(entry.action);
                  return (
                    <div
                      key={entry.id}
                      className="relative flex items-start gap-3 py-3 pl-0"
                    >
                      <div
                        className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full ${getActivityDot(entry.action)}`}
                      >
                        <Icon className="size-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">
                            {getActionLabel(entry.action)}
                          </p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {entry.entityType}
                          </Badge>
                        </div>
                        {entry.createdAt && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(
                              parseISO(entry.createdAt),
                              "MMM d 'at' h:mm a"
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
