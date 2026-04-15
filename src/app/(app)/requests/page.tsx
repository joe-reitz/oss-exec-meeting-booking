"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Loader2, Inbox, Filter } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestDetailSheet } from "@/components/requests/request-detail-sheet";

// ─── Types ───────────────────────────────────────────────────────────

interface MeetingRequest {
  id: string;
  eventId: string;
  eventName: string | null;
  status: string;
  meetingType: string | null;
  noRoomRequired: boolean;
  accountName: string;
  estimatedDealSize: string | null;
  businessImpact: string | null;
  guestName: string;
  guestEmail: string;
  guestTitle: string | null;
  guestCompany: string | null;
  additionalGuests: Array<{ name: string; email: string; title?: string; company?: string }> | null;
  goalOutcome: string | null;
  requiresExec: boolean | null;
  requestedExecIds: string[] | null;
  needsSe: boolean | null;
  preferredDateWindow: string | null;
  notes: string | null;
  requesterName: string;
  requesterEmail: string;
  source: string;
  rejectionReason: string | null;
  infoRequestMessage: string | null;
  meetingId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Room {
  id: string;
  name: string;
  capacity: number | null;
}

interface Person {
  id: string;
  name: string;
  email: string;
  type: string;
}

type Tab = "pending" | "approved" | "rejected" | "all";

const TABS: { label: string; value: Tab }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    info_requested: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <Badge variant="secondary" className={styles[status] || ""}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <RequestsPageContent />
    </Suspense>
  );
}

function RequestsPageContent() {
  const searchParams = useSearchParams();
  const eventIdFilter = searchParams.get("eventId");

  const [requests, setRequests] = useState<MeetingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [selectedRequest, setSelectedRequest] = useState<MeetingRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>(eventIdFilter || "all");

  // For the approve form
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [eventDates, setEventDates] = useState<{ startDate: string | null; endDate: string | null; timezone: string | null }>({ startDate: null, endDate: null, timezone: null });

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (tab === "pending") {
        params.set("status", "pending,info_requested");
      } else if (tab !== "all") {
        params.set("status", tab);
      }
      const eid = selectedEventFilter && selectedEventFilter !== "all" ? selectedEventFilter : eventIdFilter;
      if (eid) params.set("eventId", eid);

      const res = await fetch(`/api/meeting-requests?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRequests(data);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [tab, eventIdFilter, selectedEventFilter]);

  const fetchRoomsAndPeople = useCallback(async () => {
    try {
      const [roomsRes, peopleRes] = await Promise.all([
        // We need rooms for the event of the selected request
        // Fetch all people for participant selection
        fetch("/api/people"),
        fetch("/api/people"),
      ]);
      if (peopleRes.ok) {
        const data = await peopleRes.json();
        setPeople(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  // Fetch rooms for a specific event
  const fetchRoomsForEvent = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/rooms`);
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchRoomsAndPeople();
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
        }
      } catch {}
    }
    fetchEvents();
  }, [fetchRoomsAndPeople]);

  const handleReview = async (req: MeetingRequest) => {
    setSelectedRequest(req);
    fetchRoomsForEvent(req.eventId);
    try {
      const res = await fetch(`/api/events/${req.eventId}`);
      if (res.ok) {
        const data = await res.json();
        setEventDates({ startDate: data.startDate, endDate: data.endDate, timezone: data.timezone });
      }
    } catch {}
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Meeting Requests</h2>
          <p className="text-muted-foreground">
            Review and approve meeting nominations
            {eventIdFilter && " (filtered by event)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEventFilter} onValueChange={setSelectedEventFilter}>
            <SelectTrigger className="w-[200px]">
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
          <Button asChild>
            <Link href="/requests/new">
              <Plus />
              New Request
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No {tab !== "all" ? tab : ""} requests found.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Deal Size</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.accountName}</TableCell>
                  <TableCell>
                    <div>{req.guestName}</div>
                    {req.guestCompany && (
                      <div className="text-xs text-muted-foreground">{req.guestCompany}</div>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{req.meetingType || "—"}</TableCell>
                  <TableCell>{req.eventName || "—"}</TableCell>
                  <TableCell>{req.estimatedDealSize || "—"}</TableCell>
                  <TableCell className="max-w-[120px] truncate">
                    {req.preferredDateWindow || "—"}
                  </TableCell>
                  <TableCell>{statusBadge(req.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {req.createdAt ? format(parseISO(req.createdAt), "MMM d, h:mm a") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => handleReview(req)}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RequestDetailSheet
        request={selectedRequest}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        rooms={rooms}
        people={people}
        eventStartDate={eventDates.startDate}
        eventEndDate={eventDates.endDate}
        eventTimezone={eventDates.timezone}
        onStatusChange={fetchRequests}
      />
    </div>
  );
}
