"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  X,
  Loader2,
  MapPin,
  Calendar,
  Clock,
  Check,
  HelpCircle,
  XCircle,
  Inbox,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  parseISO,
  addDays,
  subDays,
  isBefore,
  isAfter,
  startOfDay,
  isSameDay,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

// ─── Types ───────────────────────────────────────────────────────────

interface EventData {
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
  roomCount: number;
  meetingCount: number;
}

interface Room {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  capacity: number | null;
  sortOrder: number | null;
}

interface Participant {
  id: string;
  personId: string;
  role: string | null;
  person: {
    id: string;
    name: string;
    email: string;
    type: string;
  } | null;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  eventId: string | null;
  roomId: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string | null;
  externalAttendeeName: string | null;
  externalAttendeeEmail: string | null;
  externalAttendeeCompany: string | null;
  externalAttendeeTitle: string | null;
  externalRsvpStatus: string | null;
  sfdcOpportunityId: string | null;
  calcomBookingUid: string | null;
  googleEventId: string | null;
  noRoomRequired: boolean | null;
  silentlyModified: boolean | null;
  participants: Participant[];
  room: { id: string; name: string } | null;
}

interface Person {
  id: string;
  name: string;
  email: string;
  type: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const SLOT_HEIGHT = 40; // px per 30-min slot
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 20;
const SLOT_MINUTES = 30;

function generateTimeSlots(startHour: number, endHour: number) {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
}

function getRsvpIcon(status: string | null) {
  switch (status) {
    case "accepted":
      return <Check className="size-3" />;
    case "tentative":
      return <HelpCircle className="size-3" />;
    case "declined":
      return <XCircle className="size-3" />;
    default:
      return <Clock className="size-3" />;
  }
}

function getRsvpColor(status: string | null) {
  switch (status) {
    case "accepted":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "tentative":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "declined":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

// ─── Main Component ──────────────────────────────────────────────────

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<EventData | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Dialogs
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [editRoomOpen, setEditRoomOpen] = useState(false);
  const [deleteRoomOpen, setDeleteRoomOpen] = useState(false);
  const [bookMeetingOpen, setBookMeetingOpen] = useState(false);
  const [meetingDetailOpen, setMeetingDetailOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [calcomEventTypeId, setCalcomEventTypeId] = useState("");
  const [calcomDuration, setCalcomDuration] = useState("30");
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [bookingValidationFailed, setBookingValidationFailed] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleDuration, setRescheduleDuration] = useState("30");
  const [rescheduleRoomId, setRescheduleRoomId] = useState("");

  // Room form
  const [roomForm, setRoomForm] = useState({
    name: "",
    description: "",
    capacity: "",
  });

  // Edit event form
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    sfdcExecCampaignId: "",
    sfdcAeCampaignId: "",
    color: "#3b82f6",
    isActive: true,
  });

  // Book meeting form
  const [participantSearch, setParticipantSearch] = useState("");
  const emptyAttendee = { name: "", email: "", company: "", title: "" };
  const [meetingForm, setMeetingForm] = useState({
    roomId: "",
    startTime: "",
    durationMinutes: "30",
    title: "",
    externalAttendees: [{ ...emptyAttendee }] as Array<{ name: string; email: string; company: string; title: string }>,
    participantIds: [] as string[],
    sfdcOpportunityId: "",
  });

  // ─── Data Fetching ─────────────────────────────────────────────────

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${params.eventId}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Event not found");
          router.push("/events");
          return;
        }
        throw new Error("Failed to fetch event");
      }
      const data = await res.json();
      setEvent(data);
      setCalcomEventTypeId(data.calcomEventTypeId?.toString() ?? "");

      // Set initial date to event start date if available
      if (data.startDate) {
        const d = parseISO(data.startDate);
        setSelectedDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
    } catch {
      toast.error("Failed to load event");
    }
  }, [params.eventId, router]);

  const fetchPendingRequestCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/meeting-requests?status=pending&eventId=${params.eventId}`);
      if (!res.ok) return;
      const data = await res.json();
      setPendingRequestCount(data.length);
    } catch {
      // silently fail
    }
  }, [params.eventId]);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${params.eventId}/rooms`);
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data);
    } catch {
      // silently fail
    }
  }, [params.eventId]);

  const fetchMeetings = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const res = await fetch(
        `/api/events/${params.eventId}/meetings?date=${dateStr}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setMeetings(data);
    } catch {
      // silently fail
    }
  }, [params.eventId, selectedDate]);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch("/api/people");
      if (!res.ok) return;
      const data = await res.json();
      setPeople(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchEvent(), fetchRooms(), fetchPeople(), fetchPendingRequestCount()]);
      setLoading(false);
    }
    load();
  }, [fetchEvent, fetchRooms, fetchPeople, fetchPendingRequestCount]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // ─── Date Navigation ───────────────────────────────────────────────

  const eventStartDate = event?.startDate
    ? (() => { const d = parseISO(event.startDate); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })()
    : null;
  const eventEndDate = event?.endDate
    ? (() => { const d = parseISO(event.endDate); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })()
    : null;

  const canGoBack =
    !eventStartDate || !isBefore(subDays(selectedDate, 1), eventStartDate);
  const canGoForward =
    !eventEndDate || !isAfter(addDays(selectedDate, 1), eventEndDate);

  // ─── Grid Meeting Placement ────────────────────────────────────────

  const meetingsByRoom = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    for (const room of rooms) {
      map[room.id] = [];
    }
    // Track meetings with no room (including no-room-required AE meetings)
    map["no-room"] = [];
    map["unassigned"] = [];

    for (const meeting of meetings) {
      if (meeting.noRoomRequired) {
        map["no-room"].push(meeting);
      } else {
        const key = meeting.roomId ?? "unassigned";
        if (!map[key]) map[key] = [];
        map[key].push(meeting);
      }
    }
    return map;
  }, [meetings, rooms]);

  const hasNoRoomMeetings = meetingsByRoom["no-room"]?.length > 0;

  const eventTimezone = event?.timezone ?? "America/Los_Angeles";

  // Compute dynamic grid time range based on meetings
  const { startHour, endHour, timeSlots } = useMemo(() => {
    let minHour = DEFAULT_START_HOUR;
    let maxHour = DEFAULT_END_HOUR;

    for (const meeting of meetings) {
      const zonedStart = toZonedTime(parseISO(meeting.startTime), eventTimezone);
      const zonedEnd = toZonedTime(parseISO(meeting.endTime), eventTimezone);
      const meetingStartHour = zonedStart.getHours();
      const meetingEndHour = zonedEnd.getHours() + (zonedEnd.getMinutes() > 0 ? 1 : 0);

      if (meetingStartHour < minHour) minHour = meetingStartHour;
      if (meetingEndHour > maxHour) maxHour = Math.min(meetingEndHour, 24);
    }

    return {
      startHour: minHour,
      endHour: maxHour,
      timeSlots: generateTimeSlots(minHour, maxHour),
    };
  }, [meetings, eventTimezone]);

  function getMeetingPosition(meeting: Meeting) {
    const utcDate = parseISO(meeting.startTime);
    const zonedDate = toZonedTime(utcDate, eventTimezone);
    const startMinutes = zonedDate.getHours() * 60 + zonedDate.getMinutes();
    const gridStartMinutes = startHour * 60;
    const topSlots = (startMinutes - gridStartMinutes) / SLOT_MINUTES;
    const durationSlots = meeting.durationMinutes / SLOT_MINUTES;
    return {
      top: topSlots * SLOT_HEIGHT,
      height: Math.max(durationSlots * SLOT_HEIGHT, SLOT_HEIGHT),
    };
  }

  // ─── Stats ─────────────────────────────────────────────────────────

  const dayMeetingCount = meetings.length;
  const acceptedCount = meetings.filter(
    (m) => m.externalRsvpStatus === "accepted"
  ).length;
  const rsvpRate =
    dayMeetingCount > 0
      ? Math.round((acceptedCount / dayMeetingCount) * 100)
      : 0;

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleAddRoom = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${params.eventId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomForm.name,
          description: roomForm.description || undefined,
          capacity: roomForm.capacity ? parseInt(roomForm.capacity) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create room");
      toast.success("Room added");
      setAddRoomOpen(false);
      setRoomForm({ name: "", description: "", capacity: "" });
      fetchRooms();
    } catch {
      toast.error("Failed to add room");
    } finally {
      setSaving(false);
    }
  };

  const handleEditRoom = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/events/${params.eventId}/rooms/${selectedRoom.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: roomForm.name,
            description: roomForm.description || undefined,
            capacity: roomForm.capacity
              ? parseInt(roomForm.capacity)
              : undefined,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to update room");
      toast.success("Room updated");
      setEditRoomOpen(false);
      fetchRooms();
    } catch {
      toast.error("Failed to update room");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/events/${params.eventId}/rooms/${selectedRoom.id}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) throw new Error("Failed");
      toast.success("Room deleted");
      setDeleteRoomOpen(false);
      fetchRooms();
      fetchMeetings();
    } catch {
      toast.error("Failed to delete room");
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${params.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eventForm.name,
          description: eventForm.description || undefined,
          location: eventForm.location || undefined,
          startDate: eventForm.startDate || undefined,
          endDate: eventForm.endDate || undefined,
          sfdcExecCampaignId: eventForm.sfdcExecCampaignId || null,
          sfdcAeCampaignId: eventForm.sfdcAeCampaignId || null,
          color: eventForm.color || undefined,
          isActive: eventForm.isActive,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Event updated");
      setEditEventOpen(false);
      fetchEvent();
    } catch {
      toast.error("Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const submitBooking = async () => {
    setSaving(true);
    try {
      const tz = event?.timezone ?? "America/Los_Angeles";
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const venueStart = new Date(`${dateStr}T${meetingForm.startTime}:00`);
      const utcStart = fromZonedTime(venueStart, tz);
      const startISO = utcStart.toISOString();
      const duration = parseInt(meetingForm.durationMinutes);
      const utcEnd = new Date(utcStart.getTime() + duration * 60000);
      const endISO = utcEnd.toISOString();

      const primary = meetingForm.externalAttendees[0];
      const additional = meetingForm.externalAttendees.slice(1).filter((a) => a.name && a.email);

      const body = {
        title:
          meetingForm.title ||
          `${primary.company || "Meeting"} - ${primary.name}`,
        eventId: params.eventId,
        roomId: meetingForm.roomId || undefined,
        startTime: startISO,
        endTime: endISO,
        timezone: event?.timezone ?? "America/Los_Angeles",
        durationMinutes: duration,
        participantIds: meetingForm.participantIds,
        externalAttendeeName: primary.name,
        externalAttendeeEmail: primary.email,
        externalAttendeeCompany: primary.company || undefined,
        externalAttendeeTitle: primary.title || undefined,
        additionalAttendees: additional.length > 0 ? additional : undefined,
        sfdcOpportunityId: meetingForm.sfdcOpportunityId || undefined,
      };

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || "Failed to book meeting");
      }

      const result = await res.json();
      if (result._inviteError) {
        toast.error(`Meeting saved but invite failed: ${result._inviteError}`);
      } else if (result.status === "draft") {
        toast.warning("Meeting saved as draft — no calendar invite was sent");
      } else {
        toast.success("Meeting booked — calendar invite sent");
      }
      setBookMeetingOpen(false);
      setMeetingForm({
        roomId: "",
        startTime: "",
        durationMinutes: "30",
        title: "",
        externalAttendees: [{ ...emptyAttendee }],
        participantIds: [],
        sfdcOpportunityId: "",
      });
      fetchMeetings();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to book meeting"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBookMeeting = async () => {
    const primary = meetingForm.externalAttendees[0];
    if (!meetingForm.startTime || !primary?.name || !primary?.email) {
      setBookingValidationFailed(true);
      // Reset animation after it plays
      setTimeout(() => setBookingValidationFailed(false), 1000);
      return;
    }
    setBookingValidationFailed(false);
    await submitBooking();
  };

  const handleCancelMeeting = async (meetingId: string) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Meeting cancelled");
      setMeetingDetailOpen(false);
      fetchMeetings();
    } catch {
      toast.error("Failed to cancel meeting");
    }
  };

  const handleRefreshRsvp = async (meetingId: string) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/rsvp`);
      if (!res.ok) throw new Error("Failed");
      toast.success("RSVP refreshed");
      fetchMeetings();
    } catch {
      toast.error("Failed to refresh RSVP");
    }
  };

  const handleReschedule = async () => {
    if (!selectedMeeting || !rescheduleDate || !rescheduleTime) return;
    setSaving(true);
    try {
      const tz = event?.timezone ?? "America/Los_Angeles";
      const dur = parseInt(rescheduleDuration, 10);
      const venueStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      const utcStart = fromZonedTime(venueStart, tz);
      const utcEnd = new Date(utcStart.getTime() + dur * 60000);

      const res = await fetch(`/api/meetings/${selectedMeeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: utcStart.toISOString(),
          endTime: utcEnd.toISOString(),
          roomId: rescheduleRoomId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || "Failed to reschedule");
      }
      toast.success("Meeting rescheduled");
      setRescheduleOpen(false);
      setMeetingDetailOpen(false);
      fetchMeetings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reschedule");
    } finally {
      setSaving(false);
    }
  };

  // ─── Cell Click Handler ────────────────────────────────────────────

  const handleEmptyCellClick = (roomId: string, timeSlot: string) => {
    setMeetingForm({
      roomId,
      startTime: timeSlot,
      durationMinutes: "30",
      title: "",
      externalAttendees: [{ ...emptyAttendee }],
      participantIds: [],
      sfdcOpportunityId: "",
    });
    setBookMeetingOpen(true);
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setMeetingDetailOpen(true);
  };

  // ─── Loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) return null;

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Event Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/events")}
        >
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {event.color && (
              <span
                className="inline-block size-4 rounded-full shrink-0"
                style={{ backgroundColor: event.color }}
              />
            )}
            <h2 className="text-2xl font-bold tracking-tight">
              {event.name}
            </h2>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {event.startDate && event.endDate && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {(() => {
                  const parseUTC = (s: string) => {
                    const d = parseISO(s);
                    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
                  };
                  return `${format(parseUTC(event.startDate), "MMM d")} - ${format(parseUTC(event.endDate), "MMM d, yyyy")}`;
                })()}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {event.location}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEventForm({
              name: event.name,
              description: event.description ?? "",
              location: event.location ?? "",
              startDate: event.startDate
                ? new Date(event.startDate).toISOString().split("T")[0]
                : "",
              endDate: event.endDate
                ? new Date(event.endDate).toISOString().split("T")[0]
                : "",
              sfdcExecCampaignId: event.sfdcExecCampaignId ?? "",
              sfdcAeCampaignId: event.sfdcAeCampaignId ?? "",
              color: event.color ?? "#3b82f6",
              isActive: event.isActive ?? true,
            });
            setEditEventOpen(true);
          }}
        >
          <Pencil className="size-4" />
          Edit
        </Button>
      </div>

      {/* ── Rooms Bar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">
          Rooms:
        </span>
        {rooms.map((room) => (
          <Badge
            key={room.id}
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80 gap-1"
            onClick={() => {
              setSelectedRoom(room);
              setRoomForm({
                name: room.name,
                description: room.description ?? "",
                capacity: room.capacity?.toString() ?? "",
              });
              setEditRoomOpen(true);
            }}
          >
            {room.name}
            {room.capacity && (
              <span className="text-muted-foreground ml-1">
                ({room.capacity})
              </span>
            )}
          </Badge>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRoomForm({ name: "", description: "", capacity: "" });
            setAddRoomOpen(true);
          }}
        >
          <Plus className="size-3" />
          Add Room
        </Button>
      </div>

      {/* ── Day Selector ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={!canGoBack}
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
            <span className="ml-1.5 text-xs text-muted-foreground font-normal">
              ({eventTimezone.replace(/_/g, " ")})
            </span>
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={!canGoForward}
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {dayMeetingCount} meeting{dayMeetingCount !== 1 ? "s" : ""}
          {dayMeetingCount > 0 && ` | ${rsvpRate}% RSVP`}
        </div>
      </div>

      {/* ── Room x Time Grid ────────────────────────────────────────── */}
      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Add rooms to start scheduling meetings.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setRoomForm({ name: "", description: "", capacity: "" });
                setAddRoomOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add First Room
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <div className="min-w-[600px]">
            {/* Column headers */}
            <div
              className="grid border-b bg-muted/50 sticky top-0 z-10"
              style={{
                gridTemplateColumns: `80px repeat(${rooms.length}, 1fr)${hasNoRoomMeetings ? " 1fr" : ""}`,
              }}
            >
              <div className="p-2 text-xs font-medium text-muted-foreground border-r">
                Time
              </div>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="p-2 text-xs font-medium text-center border-r truncate"
                >
                  {room.name}
                </div>
              ))}
              {hasNoRoomMeetings && (
                <div className="p-2 text-xs font-medium text-center truncate text-muted-foreground">
                  No Room
                </div>
              )}
            </div>

            {/* Grid body */}
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `80px repeat(${rooms.length}, 1fr)${hasNoRoomMeetings ? " 1fr" : ""}`,
              }}
            >
              {/* Time labels column */}
              <div className="border-r">
                {timeSlots.map((slot) => (
                  <div
                    key={slot}
                    className="border-b text-xs text-muted-foreground px-2 flex items-start pt-1"
                    style={{ height: SLOT_HEIGHT }}
                  >
                    {slot}
                  </div>
                ))}
              </div>

              {/* Room columns */}
              {rooms.map((room) => (
                <div key={room.id} className="relative border-r last:border-r-0">
                  {/* Grid lines */}
                  {timeSlots.map((slot) => (
                    <div
                      key={slot}
                      className="border-b hover:bg-muted/30 cursor-pointer"
                      style={{ height: SLOT_HEIGHT }}
                      onClick={() => handleEmptyCellClick(room.id, slot)}
                    />
                  ))}

                  {/* Meeting blocks (absolute positioned) */}
                  {(meetingsByRoom[room.id] ?? []).map((meeting) => {
                    const pos = getMeetingPosition(meeting);
                    return (
                      <div
                        key={meeting.id}
                        className="absolute left-1 right-1 rounded-md px-2 py-1 cursor-pointer overflow-hidden border text-xs z-10"
                        style={{
                          top: pos.top,
                          height: pos.height,
                          backgroundColor: event.color
                            ? `${event.color}20`
                            : "#3b82f620",
                          borderColor: event.color ?? "#3b82f6",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMeetingClick(meeting);
                        }}
                      >
                        <div className="font-medium truncate">
                          {meeting.externalAttendeeCompany || meeting.title}
                        </div>
                        {meeting.externalAttendeeName && (
                          <div className="truncate text-muted-foreground">
                            {meeting.externalAttendeeName}
                          </div>
                        )}
                        {meeting.externalRsvpStatus && (
                          <div className="mt-0.5">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1 py-0 ${getRsvpColor(meeting.externalRsvpStatus)}`}
                            >
                              {getRsvpIcon(meeting.externalRsvpStatus)}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* No Room column for AE meetings */}
              {hasNoRoomMeetings && (
                <div className="relative">
                  {/* Grid lines */}
                  {timeSlots.map((slot) => (
                    <div
                      key={slot}
                      className="border-b"
                      style={{ height: SLOT_HEIGHT }}
                    />
                  ))}

                  {/* No-room meeting blocks */}
                  {(meetingsByRoom["no-room"] ?? []).map((meeting) => {
                    const pos = getMeetingPosition(meeting);
                    return (
                      <div
                        key={meeting.id}
                        className="absolute left-1 right-1 rounded-md px-2 py-1 cursor-pointer overflow-hidden border border-dashed text-xs z-10"
                        style={{
                          top: pos.top,
                          height: pos.height,
                          backgroundColor: event.color
                            ? `${event.color}10`
                            : "#3b82f610",
                          borderColor: event.color
                            ? `${event.color}80`
                            : "#3b82f680",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMeetingClick(meeting);
                        }}
                      >
                        <div className="font-medium truncate">
                          {meeting.externalAttendeeCompany || meeting.title}
                        </div>
                        {meeting.externalAttendeeName && (
                          <div className="truncate text-muted-foreground">
                            {meeting.externalAttendeeName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cal.com + Pending Requests ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 mt-6">
        {/* Cal.com Integration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="size-4" />
              Cal.com Scheduling
            </CardTitle>
            <CardDescription>
              {calcomEventTypeId
                ? "Cal.com is configured for this event"
                : "Set up Cal.com to enable availability checking and calendar invites"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {calcomEventTypeId ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">Connected</Badge>
                  <span className="text-xs text-muted-foreground">
                    Event Type ID: {calcomEventTypeId}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingIntegration}
                  onClick={async () => {
                    setSavingIntegration(true);
                    try {
                      const res = await fetch(`/api/events/${params.eventId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ calcomEventTypeId: null }),
                      });
                      if (!res.ok) throw new Error("Failed");
                      setCalcomEventTypeId("");
                      toast.success("Cal.com disconnected");
                      fetchEvent();
                    } catch {
                      toast.error("Failed to disconnect");
                    } finally {
                      setSavingIntegration(false);
                    }
                  }}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Not connected. Cal.com is normally auto-configured on event creation.
                </p>
                <Button
                  size="sm"
                  disabled={savingIntegration}
                  onClick={async () => {
                    setSavingIntegration(true);
                    try {
                      const res = await fetch(
                        `/api/events/${params.eventId}/calcom-setup`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ lengthInMinutes: 30 }),
                        }
                      );
                      if (!res.ok) {
                        const data = await res.json();
                        throw new Error(data.error || "Failed");
                      }
                      toast.success("Cal.com reconnected");
                      fetchEvent();
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Failed to reconnect Cal.com"
                      );
                    } finally {
                      setSavingIntegration(false);
                    }
                  }}
                >
                  {savingIntegration && (
                    <Loader2 className="animate-spin size-3" />
                  )}
                  Reconnect Cal.com
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Requests */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="size-4" />
              Meeting Requests
            </CardTitle>
            <CardDescription>
              Requests submitted for this event
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingRequestCount > 0 ? (
              <Link href={`/requests?eventId=${params.eventId}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  {pendingRequestCount} pending request{pendingRequestCount !== 1 ? "s" : ""}
                </Badge>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No pending requests</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── DIALOGS ──────────────────────────────────────────────────── */}

      {/* Edit Event Dialog */}
      <Dialog open={editEventOpen} onOpenChange={setEditEventOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name *</Label>
              <Input
                value={eventForm.name}
                onChange={(e) =>
                  setEventForm((p) => ({ ...p, name: e.target.value }))
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Description</Label>
              <Textarea
                value={eventForm.description}
                onChange={(e) =>
                  setEventForm((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                className="col-span-3"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Location</Label>
              <Input
                value={eventForm.location}
                onChange={(e) =>
                  setEventForm((p) => ({ ...p, location: e.target.value }))
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Start Date</Label>
              <Input
                type="date"
                value={eventForm.startDate}
                onChange={(e) =>
                  setEventForm((p) => ({
                    ...p,
                    startDate: e.target.value,
                  }))
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">End Date</Label>
              <Input
                type="date"
                value={eventForm.endDate}
                onChange={(e) =>
                  setEventForm((p) => ({ ...p, endDate: e.target.value }))
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">SFDC Campaign (Exec)</Label>
              <Input
                value={eventForm.sfdcExecCampaignId}
                onChange={(e) =>
                  setEventForm((p) => ({ ...p, sfdcExecCampaignId: e.target.value }))
                }
                className="col-span-3"
                placeholder="701..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs">SFDC Campaign (AE)</Label>
              <Input
                value={eventForm.sfdcAeCampaignId}
                onChange={(e) =>
                  setEventForm((p) => ({ ...p, sfdcAeCampaignId: e.target.value }))
                }
                className="col-span-3"
                placeholder="701..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Color</Label>
              <div className="col-span-3 flex items-center gap-3">
                <Input
                  type="color"
                  value={eventForm.color}
                  onChange={(e) =>
                    setEventForm((p) => ({ ...p, color: e.target.value }))
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={eventForm.color}
                  onChange={(e) =>
                    setEventForm((p) => ({ ...p, color: e.target.value }))
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Active</Label>
              <div className="col-span-3">
                <Switch
                  checked={eventForm.isActive}
                  onCheckedChange={(c) =>
                    setEventForm((p) => ({ ...p, isActive: c }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditEventOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleEditEvent} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Room Dialog */}
      <Dialog open={addRoomOpen} onOpenChange={setAddRoomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Room</DialogTitle>
            <DialogDescription>
              Add a room to {event.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name *</Label>
              <Input
                value={roomForm.name}
                onChange={(e) =>
                  setRoomForm((p) => ({ ...p, name: e.target.value }))
                }
                className="col-span-3"
                placeholder="Suite 401"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Description</Label>
              <Input
                value={roomForm.description}
                onChange={(e) =>
                  setRoomForm((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="Corner suite, 5th floor"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Capacity</Label>
              <Input
                type="number"
                value={roomForm.capacity}
                onChange={(e) =>
                  setRoomForm((p) => ({ ...p, capacity: e.target.value }))
                }
                className="col-span-3"
                placeholder="8"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoomOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRoom} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Add Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={editRoomOpen} onOpenChange={setEditRoomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name *</Label>
              <Input
                value={roomForm.name}
                onChange={(e) =>
                  setRoomForm((p) => ({ ...p, name: e.target.value }))
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Description</Label>
              <Input
                value={roomForm.description}
                onChange={(e) =>
                  setRoomForm((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Capacity</Label>
              <Input
                type="number"
                value={roomForm.capacity}
                onChange={(e) =>
                  setRoomForm((p) => ({ ...p, capacity: e.target.value }))
                }
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEditRoomOpen(false);
                setDeleteRoomOpen(true);
              }}
            >
              <Trash2 className="size-4 text-destructive" />
              <span className="text-destructive">Delete</span>
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setEditRoomOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRoom} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Room Dialog */}
      <Dialog open={deleteRoomOpen} onOpenChange={setDeleteRoomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Delete <span className="font-semibold">{selectedRoom?.name}</span>
              ? Meetings in this room will be unlinked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRoomOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRoom}
              disabled={saving}
            >
              {saving && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book Meeting Dialog */}
      <Dialog open={bookMeetingOpen} onOpenChange={setBookMeetingOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Book Meeting</DialogTitle>
            <DialogDescription>
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
              {meetingForm.startTime && ` at ${meetingForm.startTime}`}
              {" "}({eventTimezone.replace(/_/g, " ")})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Room</Label>
              <Select
                value={meetingForm.roomId || "none"}
                onValueChange={(v) =>
                  setMeetingForm((p) => ({
                    ...p,
                    roomId: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No room</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Start Time *</Label>
              <Input
                type="time"
                value={meetingForm.startTime}
                onChange={(e) =>
                  setMeetingForm((p) => ({
                    ...p,
                    startTime: e.target.value,
                  }))
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Duration</Label>
              <Select
                value={meetingForm.durationMinutes}
                onValueChange={(v) =>
                  setMeetingForm((p) => ({ ...p, durationMinutes: v }))
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Title</Label>
              <Input
                value={meetingForm.title}
                onChange={(e) =>
                  setMeetingForm((p) => ({ ...p, title: e.target.value }))
                }
                className="col-span-3"
                placeholder="Auto-generated if empty"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                External Attendees
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() =>
                  setMeetingForm((p) => ({
                    ...p,
                    externalAttendees: [...p.externalAttendees, { ...emptyAttendee }],
                  }))
                }
              >
                <Plus className="size-3 mr-1" />
                Add Attendee
              </Button>
            </div>
            {meetingForm.externalAttendees.map((attendee, idx) => (
              <div key={idx} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {idx === 0 ? "Primary attendee" : `Attendee ${idx + 1}`}
                  </span>
                  {idx > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() =>
                        setMeetingForm((p) => ({
                          ...p,
                          externalAttendees: p.externalAttendees.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={attendee.name}
                    onChange={(e) =>
                      setMeetingForm((p) => ({
                        ...p,
                        externalAttendees: p.externalAttendees.map((a, i) =>
                          i === idx ? { ...a, name: e.target.value } : a
                        ),
                      }))
                    }
                    placeholder={idx === 0 ? "Name *" : "Name"}
                    className={bookingValidationFailed && idx === 0 && !attendee.name ? "border-red-500 animate-shake" : ""}
                  />
                  <Input
                    type="email"
                    value={attendee.email}
                    onChange={(e) =>
                      setMeetingForm((p) => ({
                        ...p,
                        externalAttendees: p.externalAttendees.map((a, i) =>
                          i === idx ? { ...a, email: e.target.value } : a
                        ),
                      }))
                    }
                    placeholder={idx === 0 ? "Email *" : "Email"}
                    className={bookingValidationFailed && idx === 0 && !attendee.email ? "border-red-500 animate-shake" : ""}
                  />
                  <Input
                    value={attendee.company}
                    onChange={(e) =>
                      setMeetingForm((p) => ({
                        ...p,
                        externalAttendees: p.externalAttendees.map((a, i) =>
                          i === idx ? { ...a, company: e.target.value } : a
                        ),
                      }))
                    }
                    placeholder="Company"
                  />
                  <Input
                    value={attendee.title}
                    onChange={(e) =>
                      setMeetingForm((p) => ({
                        ...p,
                        externalAttendees: p.externalAttendees.map((a, i) =>
                          i === idx ? { ...a, title: e.target.value } : a
                        ),
                      }))
                    }
                    placeholder="Title"
                  />
                </div>
              </div>
            ))}
            <Separator />
            <p className="text-sm font-medium text-muted-foreground">
              Internal Participants
            </p>
            {/* Selected participants */}
            {meetingForm.participantIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {meetingForm.participantIds.map((id) => {
                  const person = people.find((p) => p.id === id);
                  if (!person) return null;
                  return (
                    <Badge
                      key={id}
                      variant="default"
                      className="cursor-pointer"
                      onClick={() =>
                        setMeetingForm((p) => ({
                          ...p,
                          participantIds: p.participantIds.filter(
                            (pid) => pid !== id
                          ),
                        }))
                      }
                    >
                      {person.name}
                      <X className="size-3 ml-1" />
                    </Badge>
                  );
                })}
              </div>
            )}
            {/* Search input */}
            <Input
              placeholder="Search people..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
            />
            {/* Filtered results */}
            {participantSearch.trim() && (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {people
                  .filter(
                    (p) =>
                      !meetingForm.participantIds.includes(p.id) &&
                      (p.name
                        .toLowerCase()
                        .includes(participantSearch.toLowerCase()) ||
                        p.type
                          .toLowerCase()
                          .includes(participantSearch.toLowerCase()))
                  )
                  .map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      onClick={() => {
                        setMeetingForm((p) => ({
                          ...p,
                          participantIds: [...p.participantIds, person.id],
                        }));
                        setParticipantSearch("");
                      }}
                    >
                      <span>{person.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({person.type})
                      </span>
                    </button>
                  ))}
                {people.filter(
                  (p) =>
                    !meetingForm.participantIds.includes(p.id) &&
                    (p.name
                      .toLowerCase()
                      .includes(participantSearch.toLowerCase()) ||
                      p.type
                        .toLowerCase()
                        .includes(participantSearch.toLowerCase()))
                ).length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No results
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">SFDC Opp ID</Label>
              <Input
                value={meetingForm.sfdcOpportunityId}
                onChange={(e) =>
                  setMeetingForm((p) => ({
                    ...p,
                    sfdcOpportunityId: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="006..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBookMeetingOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBookMeeting}
              disabled={saving}
            >
              {saving && <Loader2 className="animate-spin" />}
              Book Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Detail Sheet */}
      <Sheet open={meetingDetailOpen} onOpenChange={setMeetingDetailOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedMeeting && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedMeeting.title}</SheetTitle>
                <SheetDescription>
                  {format(
                    parseISO(selectedMeeting.startTime),
                    "EEE, MMM d 'at' h:mm a"
                  )}{" "}
                  - {selectedMeeting.durationMinutes} min
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                {/* Status Banner */}
                {selectedMeeting.status === "draft" &&
                  !selectedMeeting.calcomBookingUid && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Calendar invite not sent
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Click &quot;Send Invite&quot; below to send a calendar
                        invitation to the attendee.
                      </p>
                    </div>
                  )}

                {/* Status & RSVP */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      selectedMeeting.status === "confirmed"
                        ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                        : selectedMeeting.status === "cancelled"
                          ? "border-red-500/50 text-red-600 dark:text-red-400"
                          : selectedMeeting.status === "draft"
                            ? "border-amber-500/50 text-amber-600 dark:text-amber-400"
                            : ""
                    }
                  >
                    {selectedMeeting.status === "draft"
                      ? "Draft — No invite sent"
                      : selectedMeeting.status === "pending"
                        ? "Pending confirmation"
                        : selectedMeeting.status === "confirmed"
                          ? "Confirmed"
                          : selectedMeeting.status === "cancelled"
                            ? "Cancelled"
                            : selectedMeeting.status === "completed"
                              ? "Completed"
                              : selectedMeeting.status}
                  </Badge>
                  {selectedMeeting.externalRsvpStatus && (
                    <Badge
                      className={getRsvpColor(
                        selectedMeeting.externalRsvpStatus
                      )}
                    >
                      {getRsvpIcon(selectedMeeting.externalRsvpStatus)}
                      <span className="ml-1">
                        {selectedMeeting.externalRsvpStatus === "needsAction"
                          ? "Awaiting response"
                          : selectedMeeting.externalRsvpStatus === "accepted"
                            ? "Accepted"
                            : selectedMeeting.externalRsvpStatus === "tentative"
                              ? "Tentative"
                              : selectedMeeting.externalRsvpStatus === "declined"
                                ? "Declined"
                                : selectedMeeting.externalRsvpStatus}
                      </span>
                    </Badge>
                  )}
                  {selectedMeeting.silentlyModified && (
                    <Badge variant="secondary">Silently modified</Badge>
                  )}
                </div>

                {/* Room */}
                {selectedMeeting.room && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Room
                    </p>
                    <p className="text-sm">{selectedMeeting.room.name}</p>
                  </div>
                )}

                {/* External Attendee */}
                {selectedMeeting.externalAttendeeName && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      External Attendee
                    </p>
                    <p className="text-sm">
                      {selectedMeeting.externalAttendeeName}
                      {selectedMeeting.externalAttendeeTitle &&
                        `, ${selectedMeeting.externalAttendeeTitle}`}
                    </p>
                    {selectedMeeting.externalAttendeeCompany && (
                      <p className="text-sm text-muted-foreground">
                        {selectedMeeting.externalAttendeeCompany}
                      </p>
                    )}
                    {selectedMeeting.externalAttendeeEmail && (
                      <p className="text-sm text-muted-foreground">
                        {selectedMeeting.externalAttendeeEmail}
                      </p>
                    )}
                  </div>
                )}

                {/* Internal Participants */}
                {selectedMeeting.participants.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Internal Participants
                    </p>
                    <div className="space-y-1">
                      {selectedMeeting.participants.map((p) => (
                        <p key={p.id} className="text-sm">
                          {p.person?.name ?? "Unknown"}{" "}
                          <span className="text-muted-foreground">
                            ({p.role})
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* SFDC */}
                {selectedMeeting.sfdcOpportunityId && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Salesforce Opportunity
                    </p>
                    <p className="text-sm font-mono">
                      {selectedMeeting.sfdcOpportunityId}
                    </p>
                  </div>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {selectedMeeting.status === "draft" &&
                    !selectedMeeting.calcomBookingUid && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `/api/meetings/${selectedMeeting.id}/send-invite`,
                              { method: "POST" }
                            );
                            if (!res.ok) {
                              const data = await res.json();
                              throw new Error(data.error || "Failed");
                            }
                            toast.success(
                              "Invite sent! Calendar invitation delivered to the attendee."
                            );
                            fetchMeetings();
                            setSelectedMeeting(null);
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Failed to send invite"
                            );
                          }
                        }}
                      >
                        Send Invite
                      </Button>
                    )}
                  {selectedMeeting.googleEventId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleRefreshRsvp(selectedMeeting.id)
                      }
                    >
                      Refresh RSVP
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const tz = event?.timezone ?? "America/Los_Angeles";
                      const zonedStart = toZonedTime(parseISO(selectedMeeting.startTime), tz);
                      setRescheduleDate(format(zonedStart, "yyyy-MM-dd"));
                      setRescheduleTime(format(zonedStart, "HH:mm"));
                      setRescheduleDuration(String(selectedMeeting.durationMinutes));
                      setRescheduleRoomId(selectedMeeting.roomId ?? "");
                      setRescheduleOpen(true);
                    }}
                  >
                    <Pencil className="size-3 mr-1" />
                    Reschedule
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      handleCancelMeeting(selectedMeeting.id)
                    }
                  >
                    Cancel Meeting
                  </Button>
                </div>

                {/* Reschedule Form */}
                {rescheduleOpen && (
                  <div className="space-y-3 rounded-md border p-3">
                    <h4 className="text-sm font-medium">Reschedule Meeting</h4>
                    {event?.timezone && (
                      <p className="text-xs text-muted-foreground">
                        Times in {event.timezone.replace(/_/g, " ")}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Time</Label>
                        <Input
                          type="time"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Duration</Label>
                        <Select value={rescheduleDuration} onValueChange={setRescheduleDuration}>
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                            <SelectItem value="90">90 min</SelectItem>
                            <SelectItem value="120">120 min</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {rooms.length > 0 && (
                        <div>
                          <Label className="text-xs">Room</Label>
                          <Select
                            value={rescheduleRoomId || "none"}
                            onValueChange={(v) => setRescheduleRoomId(v === "none" ? "" : v)}
                          >
                            <SelectTrigger className="text-xs">
                              <SelectValue placeholder="Select room" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No room</SelectItem>
                              {rooms.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleReschedule} disabled={saving || !rescheduleDate || !rescheduleTime}>
                        {saving && <Loader2 className="animate-spin size-3 mr-1" />}
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRescheduleOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
