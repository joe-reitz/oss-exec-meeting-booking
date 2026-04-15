"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Target,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

interface Goal {
  id: string;
  name: string;
  type: "meeting_quota" | "pipeline_target" | "account_coverage" | null;
  period: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  currentValue: number | null;
  unit: string | null;
  personId: string | null;
  eventId: string | null;
  targetAccountList: string[] | null;
  isActive: boolean | null;
  createdById: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  segments: Array<{
    id: string;
    segmentName: string;
    targetValue: number;
    currentValue: number | null;
  }>;
}

interface Person {
  id: string;
  name: string;
  type: "exec" | "ae";
}

interface EventItem {
  id: string;
  name: string;
}

const SEGMENT_PRESETS = ["Commercial", "Majors", "Startups"] as const;

interface SegmentFormData {
  segmentName: string;
  targetValue: string;
  enabled: boolean;
}

interface GoalFormData {
  name: string;
  type: "meeting_quota" | "pipeline_target" | "account_coverage";
  period: "weekly" | "monthly" | "quarterly" | "yearly";
  periodStart: string;
  periodEnd: string;
  targetValue: string;
  unit: string;
  personId: string;
  eventId: string;
  targetAccountList: string;
  isActive: boolean;
  segments: SegmentFormData[];
}

const emptyFormData: GoalFormData = {
  name: "",
  type: "meeting_quota",
  period: "monthly",
  periodStart: "",
  periodEnd: "",
  targetValue: "",
  unit: "meetings",
  personId: "",
  eventId: "",
  targetAccountList: "",
  isActive: true,
  segments: SEGMENT_PRESETS.map((name) => ({
    segmentName: name,
    targetValue: "",
    enabled: false,
  })),
};

function goalToFormData(goal: Goal): GoalFormData {
  const existingSegments = goal.segments ?? [];
  const segmentMap = new Map(existingSegments.map((s) => [s.segmentName, s]));

  return {
    name: goal.name,
    type: goal.type ?? "meeting_quota",
    period: goal.period ?? "monthly",
    periodStart: goal.periodStart
      ? new Date(goal.periodStart).toISOString().split("T")[0]
      : "",
    periodEnd: goal.periodEnd
      ? new Date(goal.periodEnd).toISOString().split("T")[0]
      : "",
    targetValue: goal.targetValue.toString(),
    unit: goal.unit ?? "meetings",
    personId: goal.personId ?? "",
    eventId: goal.eventId ?? "",
    targetAccountList: goal.targetAccountList
      ? goal.targetAccountList.join(", ")
      : "",
    isActive: goal.isActive ?? true,
    segments: SEGMENT_PRESETS.map((name) => {
      const existing = segmentMap.get(name);
      return {
        segmentName: name,
        targetValue: existing ? existing.targetValue.toString() : "",
        enabled: !!existing,
      };
    }),
  };
}

function formDataToPayload(data: GoalFormData) {
  const enabledSegments = data.segments
    .filter((s) => s.enabled && s.targetValue)
    .map((s) => ({
      segmentName: s.segmentName,
      targetValue: parseInt(s.targetValue, 10),
    }));

  return {
    name: data.name,
    type: data.type,
    period: data.period,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    targetValue: parseInt(data.targetValue, 10),
    unit: data.unit,
    personId: data.personId || undefined,
    eventId: data.eventId || undefined,
    targetAccountList: data.targetAccountList
      ? data.targetAccountList
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
    isActive: data.isActive,
    segments: enabledSegments.length > 0 ? enabledSegments : undefined,
  };
}

const TYPE_BADGE_CLASSES: Record<string, string> = {
  meeting_quota:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  pipeline_target:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  account_coverage:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const TYPE_LABELS: Record<string, string> = {
  meeting_quota: "Meeting Quota",
  pipeline_target: "Pipeline Target",
  account_coverage: "Account Coverage",
};

const PERIOD_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const UNIT_OPTIONS = [
  { value: "meetings", label: "Meetings" },
  { value: "$", label: "$ (Dollars)" },
  { value: "accounts", label: "Accounts" },
  { value: "opportunities", label: "Opportunities" },
];

function formatGoalValue(value: number, unit: string | null): string {
  if (unit === "$") {
    return value >= 1_000_000
      ? `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
      : value >= 1_000
        ? `$${(value / 1_000).toFixed(0)}K`
        : `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

function formatGoalProgress(current: number, target: number, unit: string | null): string {
  const c = formatGoalValue(current, unit);
  const t = formatGoalValue(target, unit);
  // For non-currency units, append the unit name
  if (unit && unit !== "$") {
    return `${c} / ${t} ${unit}`;
  }
  return `${c} / ${t}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [eventItems, setEventItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState<GoalFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/goals");
      if (!res.ok) throw new Error("Failed to fetch goals");
      const data = await res.json();
      setGoals(data);
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch("/api/people");
      if (!res.ok) return;
      const data = await res.json();
      setPeople(data);
    } catch {
      // silently fail — people are not critical for goals page
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events?active=true");
      if (!res.ok) return;
      const data = await res.json();
      setEventItems(data);
    } catch {
      // silently fail — events are not critical for goals page
    }
  }, []);

  useEffect(() => {
    fetchGoals();
    fetchPeople();
    fetchEvents();
  }, [fetchGoals, fetchPeople, fetchEvents]);

  // Lookup maps
  const personMap = new Map(people.map((p) => [p.id, p.name]));
  const eventMap = new Map(eventItems.map((e) => [e.id, e.name]));

  // Add goal
  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataToPayload(formData)),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create goal");
      }
      toast.success("Goal created successfully");
      setAddOpen(false);
      setFormData(emptyFormData);
      fetchGoals();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create goal"
      );
    } finally {
      setSaving(false);
    }
  };

  // Edit goal
  const handleEdit = async () => {
    if (!selectedGoal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/goals/${selectedGoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataToPayload(formData)),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update goal");
      }
      toast.success("Goal updated successfully");
      setEditOpen(false);
      setSelectedGoal(null);
      setFormData(emptyFormData);
      fetchGoals();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update goal"
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete goal
  const handleDelete = async () => {
    if (!selectedGoal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/goals/${selectedGoal.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete goal");
      }
      toast.success("Goal deleted successfully");
      setDeleteOpen(false);
      setSelectedGoal(null);
      fetchGoals();
    } catch {
      toast.error("Failed to delete goal");
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (goal: Goal) => {
    setSelectedGoal(goal);
    setFormData(goalToFormData(goal));
    setEditOpen(true);
  };

  const openDeleteDialog = (goal: Goal) => {
    setSelectedGoal(goal);
    setDeleteOpen(true);
  };

  const openAddDialog = () => {
    setFormData(emptyFormData);
    setAddOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Goals</h2>
          <p className="text-muted-foreground">
            Track meeting quotas, pipeline targets, and account coverage
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus />
          Add Goal
        </Button>
      </div>

      {/* Goal cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No goals found.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={openAddDialog}
          >
            <Plus />
            Add your first goal
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const current = goal.currentValue ?? 0;
            const progress =
              goal.targetValue > 0
                ? Math.min((current / goal.targetValue) * 100, 100)
                : 0;

            return (
              <Card key={goal.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{goal.name}</CardTitle>
                    <Badge
                      variant={goal.isActive ? "default" : "secondary"}
                      className={
                        goal.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                      }
                    >
                      {goal.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {goal.type && (
                      <Badge className={TYPE_BADGE_CLASSES[goal.type] ?? ""}>
                        {TYPE_LABELS[goal.type] ?? goal.type}
                      </Badge>
                    )}
                    {goal.period && (
                      <Badge variant="outline">
                        {PERIOD_LABELS[goal.period] ?? goal.period}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-3">
                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {formatGoalProgress(current, goal.targetValue, goal.unit)}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {Math.round(progress)}%
                      </p>
                    </div>

                    {/* Segment breakdowns */}
                    {goal.segments.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t">
                        <p className="text-xs font-medium text-muted-foreground">By Segment</p>
                        {goal.segments.map((seg) => {
                          const segCurrent = seg.currentValue ?? 0;
                          const segProgress = seg.targetValue > 0
                            ? Math.min((segCurrent / seg.targetValue) * 100, 100)
                            : 0;
                          return (
                            <div key={seg.segmentName} className="space-y-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{seg.segmentName}</span>
                                <span>{segCurrent} / {seg.targetValue}</span>
                              </div>
                              <Progress value={segProgress} className="h-1.5" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Date range */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="size-4 shrink-0" />
                      <span>
                        {formatDate(goal.periodStart)} &mdash;{" "}
                        {formatDate(goal.periodEnd)}
                      </span>
                    </div>

                    {/* Linked person */}
                    {goal.personId && personMap.has(goal.personId) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="size-4 shrink-0" />
                        <span>{personMap.get(goal.personId)}</span>
                      </div>
                    )}

                    {/* Linked event */}
                    {goal.eventId &&
                      eventMap.has(goal.eventId) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Target className="size-4 shrink-0" />
                          <span>{eventMap.get(goal.eventId)}</span>
                        </div>
                      )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(goal)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(goal)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                      <span className="text-destructive">Delete</span>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Goal Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Goal</DialogTitle>
            <DialogDescription>
              Create a new goal to track progress.
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            formData={formData}
            setFormData={setFormData}
            people={people}
            events={eventItems}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Add Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>
              Update the goal&apos;s configuration.
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            formData={formData}
            setFormData={setFormData}
            people={people}
            events={eventItems}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{selectedGoal?.name}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalForm({
  formData,
  setFormData,
  people,
  events,
}: {
  formData: GoalFormData;
  setFormData: React.Dispatch<React.SetStateAction<GoalFormData>>;
  people: Person[];
  events: EventItem[];
}) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-name" className="text-right">
          Name *
        </Label>
        <Input
          id="goal-name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="col-span-3"
          placeholder="Q1 Executive Meeting Quota"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-type" className="text-right">
          Type *
        </Label>
        <Select
          value={formData.type}
          onValueChange={(
            value: "meeting_quota" | "pipeline_target" | "account_coverage"
          ) => setFormData((prev) => ({ ...prev, type: value }))}
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="meeting_quota">Meeting Quota</SelectItem>
            <SelectItem value="pipeline_target">Pipeline Target</SelectItem>
            <SelectItem value="account_coverage">Account Coverage</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-period" className="text-right">
          Period *
        </Label>
        <Select
          value={formData.period}
          onValueChange={(
            value: "weekly" | "monthly" | "quarterly" | "yearly"
          ) => setFormData((prev) => ({ ...prev, period: value }))}
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-periodStart" className="text-right">
          Period Start *
        </Label>
        <Input
          id="goal-periodStart"
          type="date"
          value={formData.periodStart}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, periodStart: e.target.value }))
          }
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-periodEnd" className="text-right">
          Period End *
        </Label>
        <Input
          id="goal-periodEnd"
          type="date"
          value={formData.periodEnd}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, periodEnd: e.target.value }))
          }
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-targetValue" className="text-right">
          Target Value *
        </Label>
        <Input
          id="goal-targetValue"
          type="number"
          value={formData.targetValue}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, targetValue: e.target.value }))
          }
          className="col-span-3"
          placeholder="20"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-unit" className="text-right">
          Unit *
        </Label>
        <Select
          value={formData.unit}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, unit: value }))
          }
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select unit" />
          </SelectTrigger>
          <SelectContent>
            {UNIT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-person" className="text-right">
          Person
        </Label>
        <Select
          value={formData.personId || "none"}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              personId: value === "none" ? "" : value,
            }))
          }
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select person (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}{" "}
                <span className="text-muted-foreground">
                  ({person.type === "exec" ? "Executive" : "AE"})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-event" className="text-right">
          Event
        </Label>
        <Select
          value={formData.eventId || "none"}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              eventId: value === "none" ? "" : value,
            }))
          }
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select event (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {events.map((ev) => (
              <SelectItem key={ev.id} value={ev.id}>
                {ev.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {formData.type === "meeting_quota" && (
        <div className="grid grid-cols-4 items-start gap-4">
          <Label className="text-right pt-2">Segments</Label>
          <div className="col-span-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Optional per-segment targets
            </p>
            {formData.segments.map((seg, idx) => (
              <div key={seg.segmentName} className="flex items-center gap-2">
                <label className="flex items-center gap-2 min-w-[120px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seg.enabled}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        segments: prev.segments.map((s, i) =>
                          i === idx ? { ...s, enabled: e.target.checked } : s
                        ),
                      }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">{seg.segmentName}</span>
                </label>
                {seg.enabled && (
                  <Input
                    type="number"
                    value={seg.targetValue}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        segments: prev.segments.map((s, i) =>
                          i === idx ? { ...s, targetValue: e.target.value } : s
                        ),
                      }))
                    }
                    placeholder="Target"
                    className="w-24 h-8 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {formData.type === "account_coverage" && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="goal-targetAccountList" className="text-right">
            Target Accounts
          </Label>
          <Input
            id="goal-targetAccountList"
            value={formData.targetAccountList}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                targetAccountList: e.target.value,
              }))
            }
            className="col-span-3"
            placeholder="Acme Corp, Globex, Initech"
          />
        </div>
      )}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="goal-isActive" className="text-right">
          Active
        </Label>
        <div className="col-span-3">
          <Switch
            id="goal-isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, isActive: checked }))
            }
          />
        </div>
      </div>
    </div>
  );
}
