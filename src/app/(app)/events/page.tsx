"use client";

import { useCallback, useEffect, useState, Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Calendar,
  DoorOpen,
  CalendarCheck,
  Settings,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isBefore } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Event {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string | null;
  calcomEventTypeId: number | null;
  sfdcExecCampaignId: string | null;
  sfdcAeCampaignId: string | null;
  color: string | null;
  isActive: boolean | null;
  metadata: Record<string, unknown> | null;
  createdById: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  roomCount: number;
  meetingCount: number;
}

interface Person {
  id: string;
  name: string;
  email: string;
  type: string;
  title: string | null;
}

const GOAL_TYPE_OPTIONS = [
  { value: "Meeting Quota", unit: "meetings" },
  { value: "Pipeline Target", unit: "$" },
  { value: "Account Coverage", unit: "accounts" },
] as const;

const SEGMENT_PRESETS = ["Commercial", "Majors", "Startups"] as const;

interface GoalFormData {
  name: string;
  targetValue: number;
  segments: Array<{ segmentName: string; targetValue: number; enabled: boolean }>;
}

interface EventFormData {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  timezone: string;
  sfdcExecCampaignId: string;
  sfdcAeCampaignId: string;
  color: string;
  isActive: boolean;
  participantIds: string[];
  goals: GoalFormData[];
  meetingDuration: string;
}

// Geist color palette for auto-assigning event colors
const GEIST_COLORS = [
  "#0070F3", // blue
  "#7928CA", // purple
  "#F5A623", // amber
  "#FF0080", // pink
  "#00C853", // green (success)
  "#50E3C2", // cyan
  "#F81CE5", // magenta
  "#EE0000", // red
  "#7B61FF", // violet
  "#0761D1", // geist blue
];

function randomGeistColor(): string {
  return GEIST_COLORS[Math.floor(Math.random() * GEIST_COLORS.length)];
}

function emptyFormData(): EventFormData {
  return {
    name: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    timezone: "America/Los_Angeles",
    sfdcExecCampaignId: "",
    sfdcAeCampaignId: "",
    color: randomGeistColor(),
    isActive: true,
    participantIds: [],
    goals: [],
    meetingDuration: "30",
  };
}

function eventToFormData(event: Event): EventFormData {
  return {
    name: event.name,
    description: event.description ?? "",
    location: event.location ?? "",
    startDate: event.startDate
      ? new Date(event.startDate).toISOString().split("T")[0]
      : "",
    endDate: event.endDate
      ? new Date(event.endDate).toISOString().split("T")[0]
      : "",
    timezone: event.timezone ?? "America/Los_Angeles",
    sfdcExecCampaignId: event.sfdcExecCampaignId ?? "",
    sfdcAeCampaignId: event.sfdcAeCampaignId ?? "",
    color: event.color ?? "#3b82f6",
    isActive: event.isActive ?? true,
    participantIds: [],
    goals: [],
    meetingDuration: "30",
  };
}

function formDataToPayload(data: EventFormData) {
  return {
    name: data.name,
    description: data.description || undefined,
    location: data.location || undefined,
    startDate: data.startDate || undefined,
    endDate: data.endDate || undefined,
    timezone: data.timezone || undefined,
    sfdcExecCampaignId: data.sfdcExecCampaignId || null,
    sfdcAeCampaignId: data.sfdcAeCampaignId || null,
    color: data.color || undefined,
    isActive: data.isActive,
    meetingDuration: parseInt(data.meetingDuration, 10),
    participantIds:
      data.participantIds.length > 0 ? data.participantIds : undefined,
    goals:
      data.goals.length > 0
        ? data.goals.map((g) => ({
            name: g.name,
            targetValue: g.targetValue,
            segments:
              g.segments.filter((s) => s.enabled && s.targetValue > 0).length > 0
                ? g.segments
                    .filter((s) => s.enabled && s.targetValue > 0)
                    .map((s) => ({ segmentName: s.segmentName, targetValue: s.targetValue }))
                : undefined,
          }))
        : undefined,
  };
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate) return null;
  // Parse as UTC to avoid timezone shift (dates are stored as midnight UTC)
  const parseUTC = (s: string) => {
    const d = parseISO(s);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const start = format(parseUTC(startDate), "MMM d");
  if (!endDate) return start;
  const end = format(parseUTC(endDate), "MMM d, yyyy");
  return `${start} - ${end}`;
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<EventFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataToPayload(formData)),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create event");
      }
      const created = await res.json();

      if (created.calcomEventTypeId) {
        toast.success("Event created with Cal.com scheduling enabled", { duration: 5000 });
      } else {
        toast.warning("Event created but Cal.com setup failed. You can retry from the event page.", { duration: 8000 });
      }
      setAddOpen(false);
      setFormData(emptyFormData());
      // Small delay so toast is visible before navigation
      setTimeout(() => router.push(`/events/${created.id}`), 500);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create event"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataToPayload(formData)),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update event");
      }
      toast.success("Event updated successfully");
      setEditOpen(false);
      setSelectedEvent(null);
      setFormData(emptyFormData());
      fetchEvents();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update event"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete event");
      }
      toast.success("Event deleted successfully");
      setDeleteOpen(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Events</h2>
          <p className="text-muted-foreground">
            Manage conferences and their meeting schedules
          </p>
        </div>
        <Button
          onClick={() => {
            setFormData(emptyFormData());
            setAddOpen(true);
          }}
        >
          <Plus />
          Add Event
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No events found.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setFormData(emptyFormData());
              setAddOpen(true);
            }}
          >
            <Plus />
            Add your first event
          </Button>
        </div>
      ) : (
        <>
          {/* Upcoming Events */}
          {events.filter((e) => !e.endDate || !isBefore(parseISO(e.endDate), new Date())).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Upcoming Events</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events
                  .filter((e) => !e.endDate || !isBefore(parseISO(e.endDate), new Date()))
                  .map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={() => {
                        setSelectedEvent(event);
                        setFormData(eventToFormData(event));
                        setEditOpen(true);
                      }}
                      onDelete={() => {
                        setSelectedEvent(event);
                        setDeleteOpen(true);
                      }}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Past Events */}
          {events.filter((e) => e.endDate && isBefore(parseISO(e.endDate), new Date())).length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground select-none list-none [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" />
                Past Events ({events.filter((e) => e.endDate && isBefore(parseISO(e.endDate), new Date())).length})
              </summary>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                {events
                  .filter((e) => e.endDate && isBefore(parseISO(e.endDate), new Date()))
                  .map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={() => {
                        setSelectedEvent(event);
                        setFormData(eventToFormData(event));
                        setEditOpen(true);
                      }}
                      onDelete={() => {
                        setSelectedEvent(event);
                        setDeleteOpen(true);
                      }}
                    />
                  ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* Add Event Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>
              Create a new conference or event.
            </DialogDescription>
          </DialogHeader>
          <EventForm formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update the event&apos;s configuration.
            </DialogDescription>
          </DialogHeader>
          <EventForm formData={formData} setFormData={setFormData} />
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
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{selectedEvent?.name}</span>?
              This will also delete all rooms and unlink meetings. This action
              cannot be undone.
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

function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {event.color && (
                <span
                  className="inline-block size-3 rounded-full shrink-0"
                  style={{ backgroundColor: event.color }}
                />
              )}
              <Link
                href={`/events/${event.id}`}
                className="hover:underline"
              >
                {event.name}
              </Link>
            </CardTitle>
            {event.description && (
              <CardDescription className="line-clamp-2">
                {event.description}
              </CardDescription>
            )}
          </div>
          <Badge
            variant={event.isActive ? "default" : "secondary"}
            className={
              event.isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
            }
          >
            {event.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2">
          {(event.startDate || event.endDate) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              <span>
                {formatDateRange(event.startDate, event.endDate)}
              </span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              <span>{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <DoorOpen className="size-4" />
              <span>
                {event.roomCount} room{event.roomCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CalendarCheck className="size-4" />
              <span>
                {event.meetingCount} meeting
                {event.meetingCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/events/${event.id}`}>
              <Settings className="size-4" />
              Manage
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="size-4 text-destructive" />
            <span className="text-destructive">Delete</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function EventForm({
  formData,
  setFormData,
}: {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
}) {
  const [availableExecs, setAvailableExecs] = useState<Person[]>([]);

  useEffect(() => {
    async function fetchExecs() {
      try {
        const res = await fetch("/api/people?type=exec");
        if (res.ok) {
          const data = await res.json();
          setAvailableExecs(data);
        }
      } catch {}
    }
    fetchExecs();
  }, []);

  const toggleExec = (personId: string) => {
    setFormData((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(personId)
        ? prev.participantIds.filter((id) => id !== personId)
        : [...prev.participantIds, personId],
    }));
  };

  const addGoal = () => {
    setFormData((prev) => ({
      ...prev,
      goals: [
        ...prev.goals,
        {
          name: "",
          targetValue: 0,
          segments: SEGMENT_PRESETS.map((name) => ({
            segmentName: name,
            targetValue: 0,
            enabled: false,
          })),
        },
      ],
    }));
  };

  const removeGoal = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index),
    }));
  };

  const updateGoal = (index: number, field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.map((g, i) =>
        i === index ? { ...g, [field]: value } : g
      ),
    }));
  };

  const toggleSegment = (goalIndex: number, segIndex: number, enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.map((g, i) =>
        i === goalIndex
          ? {
              ...g,
              segments: g.segments.map((s, si) =>
                si === segIndex ? { ...s, enabled } : s
              ),
            }
          : g
      ),
    }));
  };

  const updateSegmentTarget = (goalIndex: number, segIndex: number, value: number) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.map((g, i) =>
        i === goalIndex
          ? {
              ...g,
              segments: g.segments.map((s, si) =>
                si === segIndex ? { ...s, targetValue: value } : s
              ),
            }
          : g
      ),
    }));
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right">
          Name *
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="col-span-3"
          placeholder="AWS re:Invent 2026"
        />
      </div>
      <div className="grid grid-cols-4 items-start gap-4">
        <Label htmlFor="description" className="text-right pt-2">
          Description
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          className="col-span-3"
          rows={2}
          placeholder="Annual cloud computing conference"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="location" className="text-right">
          Location
        </Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, location: e.target.value }))
          }
          className="col-span-3"
          placeholder="Las Vegas, NV"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right">Start Date</Label>
        <div className="col-span-3">
          <DatePicker
            value={formData.startDate}
            onChange={(v) => setFormData((prev) => ({ ...prev, startDate: v }))}
            placeholder="Select start date"
            className="w-full"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right">End Date</Label>
        <div className="col-span-3">
          <DatePicker
            value={formData.endDate}
            onChange={(v) => setFormData((prev) => ({ ...prev, endDate: v }))}
            placeholder="Select end date"
            className="w-full"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right">Timezone</Label>
        <Select
          value={formData.timezone}
          onValueChange={(v) =>
            setFormData((prev) => ({ ...prev, timezone: v }))
          }
        >
          <SelectTrigger className="col-span-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Americas */}
            <SelectItem value="America/Los_Angeles">US Pacific (Los Angeles)</SelectItem>
            <SelectItem value="America/Denver">US Mountain (Denver)</SelectItem>
            <SelectItem value="America/Chicago">US Central (Chicago)</SelectItem>
            <SelectItem value="America/New_York">US Eastern (New York)</SelectItem>
            <SelectItem value="America/Anchorage">US Alaska (Anchorage)</SelectItem>
            <SelectItem value="Pacific/Honolulu">US Hawaii (Honolulu)</SelectItem>
            <SelectItem value="America/Toronto">Canada Eastern (Toronto)</SelectItem>
            <SelectItem value="America/Vancouver">Canada Pacific (Vancouver)</SelectItem>
            <SelectItem value="America/Mexico_City">Mexico (Mexico City)</SelectItem>
            <SelectItem value="America/Sao_Paulo">Brazil (Sao Paulo)</SelectItem>
            <SelectItem value="America/Argentina/Buenos_Aires">Argentina (Buenos Aires)</SelectItem>
            <SelectItem value="America/Bogota">Colombia (Bogota)</SelectItem>
            {/* Europe */}
            <SelectItem value="Europe/London">UK (London)</SelectItem>
            <SelectItem value="Europe/Dublin">Ireland (Dublin)</SelectItem>
            <SelectItem value="Europe/Paris">France (Paris)</SelectItem>
            <SelectItem value="Europe/Berlin">Germany (Berlin)</SelectItem>
            <SelectItem value="Europe/Amsterdam">Netherlands (Amsterdam)</SelectItem>
            <SelectItem value="Europe/Madrid">Spain (Madrid)</SelectItem>
            <SelectItem value="Europe/Rome">Italy (Rome)</SelectItem>
            <SelectItem value="Europe/Zurich">Switzerland (Zurich)</SelectItem>
            <SelectItem value="Europe/Stockholm">Sweden (Stockholm)</SelectItem>
            <SelectItem value="Europe/Helsinki">Finland (Helsinki)</SelectItem>
            <SelectItem value="Europe/Warsaw">Poland (Warsaw)</SelectItem>
            <SelectItem value="Europe/Istanbul">Turkey (Istanbul)</SelectItem>
            <SelectItem value="Europe/Moscow">Russia (Moscow)</SelectItem>
            {/* Middle East & Africa */}
            <SelectItem value="Asia/Dubai">UAE (Dubai)</SelectItem>
            <SelectItem value="Asia/Riyadh">Saudi Arabia (Riyadh)</SelectItem>
            <SelectItem value="Asia/Jerusalem">Israel (Jerusalem)</SelectItem>
            <SelectItem value="Africa/Johannesburg">South Africa (Johannesburg)</SelectItem>
            <SelectItem value="Africa/Lagos">Nigeria (Lagos)</SelectItem>
            <SelectItem value="Africa/Cairo">Egypt (Cairo)</SelectItem>
            {/* Asia Pacific */}
            <SelectItem value="Asia/Kolkata">India (Kolkata)</SelectItem>
            <SelectItem value="Asia/Bangkok">Thailand (Bangkok)</SelectItem>
            <SelectItem value="Asia/Singapore">Singapore</SelectItem>
            <SelectItem value="Asia/Kuala_Lumpur">Malaysia (Kuala Lumpur)</SelectItem>
            <SelectItem value="Asia/Jakarta">Indonesia (Jakarta)</SelectItem>
            <SelectItem value="Asia/Hong_Kong">Hong Kong</SelectItem>
            <SelectItem value="Asia/Shanghai">China (Shanghai)</SelectItem>
            <SelectItem value="Asia/Taipei">Taiwan (Taipei)</SelectItem>
            <SelectItem value="Asia/Seoul">South Korea (Seoul)</SelectItem>
            <SelectItem value="Asia/Tokyo">Japan (Tokyo)</SelectItem>
            <SelectItem value="Australia/Perth">Australia Western (Perth)</SelectItem>
            <SelectItem value="Australia/Sydney">Australia Eastern (Sydney)</SelectItem>
            <SelectItem value="Australia/Melbourne">Australia (Melbourne)</SelectItem>
            <SelectItem value="Pacific/Auckland">New Zealand (Auckland)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="isActive" className="text-right">
          Active
        </Label>
        <div className="col-span-3">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, isActive: checked }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right">Meeting Duration</Label>
        <Select
          value={formData.meetingDuration}
          onValueChange={(v) =>
            setFormData((prev) => ({ ...prev, meetingDuration: v }))
          }
        >
          <SelectTrigger className="col-span-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="60">60 minutes</SelectItem>
            <SelectItem value="90">90 minutes</SelectItem>
            <SelectItem value="120">2 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right text-xs">SFDC Campaign (Exec)</Label>
        <Input
          value={formData.sfdcExecCampaignId}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, sfdcExecCampaignId: e.target.value }))
          }
          className="col-span-3"
          placeholder="701..."
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label className="text-right text-xs">SFDC Campaign (AE)</Label>
        <Input
          value={formData.sfdcAeCampaignId}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, sfdcAeCampaignId: e.target.value }))
          }
          className="col-span-3"
          placeholder="701..."
        />
      </div>

      {/* Assign Execs */}
      <Separator className="my-2" />
      <div className="grid grid-cols-4 items-start gap-4">
        <Label className="text-right pt-2">Assign Execs</Label>
        <div className="col-span-3 space-y-2">
          {availableExecs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No executives found. Add them in the People section first.
            </p>
          ) : (
            <div className="grid gap-2">
              {availableExecs.map((exec) => (
                <label
                  key={exec.id}
                  className="flex items-center gap-3 rounded-md border p-2 cursor-pointer hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={formData.participantIds.includes(exec.id)}
                    onChange={() => toggleExec(exec.id)}
                    className="rounded"
                  />
                  <div>
                    <p className="text-sm font-medium">{exec.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {exec.title ?? exec.email}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Goals */}
      <Separator className="my-2" />
      <div className="grid grid-cols-4 items-start gap-4">
        <Label className="text-right pt-2">Goals</Label>
        <div className="col-span-3 space-y-3">
          {formData.goals.map((goal, index) => (
            <div
              key={index}
              className="rounded-md border p-3 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Select
                  value={goal.name}
                  onValueChange={(v) => updateGoal(index, "name", v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select goal type" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Target"
                  value={goal.targetValue || ""}
                  onChange={(e) =>
                    updateGoal(
                      index,
                      "targetValue",
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="w-24"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGoal(index)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              {/* Segment breakdown presets */}
              <div className="ml-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Segment Targets
                </p>
                {goal.segments.map((seg, segIndex) => (
                  <div key={seg.segmentName} className="flex items-center gap-2">
                    <label className="flex items-center gap-2 min-w-[110px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={seg.enabled}
                        onChange={(e) => toggleSegment(index, segIndex, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">{seg.segmentName}</span>
                    </label>
                    {seg.enabled && (
                      <Input
                        type="number"
                        placeholder="Target"
                        value={seg.targetValue || ""}
                        onChange={(e) =>
                          updateSegmentTarget(index, segIndex, parseInt(e.target.value) || 0)
                        }
                        className="w-24 h-8 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addGoal}
          >
            <Plus className="size-4" />
            Add Goal
          </Button>
        </div>
      </div>
    </div>
  );
}
