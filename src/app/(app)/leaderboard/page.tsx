"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Trophy,
  Filter,
  Loader2,
  Users,
  DollarSign,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface LeaderboardEntry {
  personId: string;
  personName: string;
  personEmail: string;
  personType: string;
  value: number;
  rank: number;
  targetValue?: number;
  goalCount?: number;
  completionPct?: number;
}

interface EventOption {
  id: string;
  name: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function getRankStyle(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case 2:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    case 3:
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function LeaderboardPage() {
  const [view, setView] = useState("meetings");
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events?active=true");
        if (res.ok) {
          const json = await res.json();
          setEvents(
            json.map((e: { id: string; name: string }) => ({
              id: e.id,
              name: e.name,
            }))
          );
        }
      } catch {}
    }
    fetchEvents();
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ view });
      if (selectedEventId && selectedEventId !== "all") params.set("eventId", selectedEventId);
      const res = await fetch(`/api/leaderboard?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [view, selectedEventId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leaderboard</h2>
          <p className="text-muted-foreground">
            See who&apos;s making the biggest impact
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

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="meetings">
            <Users className="size-4 mr-1" />
            Most Meetings
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <DollarSign className="size-4 mr-1" />
            Pipeline Generated
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Target className="size-4 mr-1" />
            Goal Completion
          </TabsTrigger>
        </TabsList>

        <TabsContent value={view} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {view === "meetings" && "Most Meetings"}
                {view === "pipeline" && "Pipeline Generated"}
                {view === "goals" && "Goal Completion"}
              </CardTitle>
              <CardDescription>
                {view === "meetings" && "Ranked by confirmed/completed meetings"}
                {view === "pipeline" && "Ranked by total pipeline dollar amount"}
                {view === "goals" && "Ranked by goal completion percentage"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Trophy className="size-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No data yet. Book meetings and set goals to populate the
                    leaderboard.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.map((entry) => (
                    <div
                      key={entry.personId}
                      className="flex items-center gap-4 rounded-lg border p-4"
                    >
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getRankStyle(entry.rank)}`}
                      >
                        {entry.rank}
                      </div>
                      <Avatar className="size-10">
                        <AvatarFallback>
                          {getInitials(entry.personName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {entry.personName}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {entry.personType === "exec" ? "Exec" : "AE"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.personEmail}
                        </p>
                        {view === "goals" && entry.completionPct !== undefined && (
                          <div className="mt-1">
                            <Progress
                              value={Math.min(entry.completionPct, 100)}
                              className="h-2"
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold tabular-nums">
                          {view === "meetings" && entry.value}
                          {view === "pipeline" && formatCurrency(entry.value)}
                          {view === "goals" &&
                            `${entry.completionPct ?? 0}%`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {view === "meetings" &&
                            `meeting${entry.value !== 1 ? "s" : ""}`}
                          {view === "pipeline" && "pipeline"}
                          {view === "goals" &&
                            entry.targetValue &&
                            `${entry.value} / ${entry.targetValue}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
