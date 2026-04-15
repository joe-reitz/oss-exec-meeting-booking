"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck,
  Download,
  Filter,
  Loader2,
  User,
} from "lucide-react";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MyMeeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string | null;
  externalAttendeeName: string | null;
  externalAttendeeCompany: string | null;
  externalRsvpStatus: string | null;
  prepNotes: string | null;
  segment: string | null;
  noRoomRequired: boolean | null;
  timezone: string | null;
  roomName: string | null;
  eventName: string | null;
  eventTimezone: string | null;
  eventId: string | null;
}

interface EventOption {
  id: string;
  name: string;
}

interface PersonOption {
  id: string;
  name: string;
  type: string;
}

function getStatusBadgeVariant(
  status: string | null
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
    case "completed":
      return "default";
    case "pending":
    case "draft":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export default function MyMeetingsPage() {
  const [meetings, setMeetings] = useState<MyMeeting[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Load saved person from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("myMeetingsPersonId");
    if (saved) setSelectedPersonId(saved);
  }, []);

  // Save person selection
  useEffect(() => {
    if (selectedPersonId) {
      localStorage.setItem("myMeetingsPersonId", selectedPersonId);
    }
  }, [selectedPersonId]);

  useEffect(() => {
    async function fetchEventsAndPeople() {
      try {
        const [eventsRes, peopleRes] = await Promise.all([
          fetch("/api/events?active=true"),
          fetch("/api/people"),
        ]);
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents(
            data.map((e: { id: string; name: string }) => ({
              id: e.id,
              name: e.name,
            }))
          );
        }
        if (peopleRes.ok) {
          const data = await peopleRes.json();
          setPeople(
            data.map((p: { id: string; name: string; type: string }) => ({
              id: p.id,
              name: p.name,
              type: p.type,
            }))
          );
        }
      } catch {}
    }
    fetchEventsAndPeople();
  }, []);

  const fetchMeetings = useCallback(async () => {
    if (!selectedPersonId) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ personId: selectedPersonId });
      if (selectedEventId && selectedEventId !== "all") {
        params.set("eventId", selectedEventId);
      }
      const res = await fetch(`/api/my-meetings?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, selectedPersonId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleExportCSV = () => {
    if (!selectedPersonId) return;
    const params = new URLSearchParams({ personId: selectedPersonId, format: "csv" });
    if (selectedEventId && selectedEventId !== "all") {
      params.set("eventId", selectedEventId);
    }
    window.open(`/api/my-meetings?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Meetings</h2>
          <p className="text-muted-foreground">
            Your scheduled meetings across events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Combobox
            options={people.map((p) => ({
              value: p.id,
              label: p.name,
              sublabel: p.type,
            }))}
            value={selectedPersonId}
            onValueChange={setSelectedPersonId}
            placeholder="Select yourself"
            searchPlaceholder="Type your name..."
            emptyText="No one found."
            className="w-[220px]"
            icon={<User className="size-4" />}
          />
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
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
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!selectedPersonId}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {!selectedPersonId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <User className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Select yourself from the dropdown above to see your meetings.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>Meetings</CardTitle>
          <CardDescription>
            {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarCheck className="size-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No meetings found. You&apos;ll see meetings here once you&apos;re added
                as a participant.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>External Attendee</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prep Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">
                        {formatInTimeZone(parseISO(meeting.startTime), meeting.eventTimezone ?? meeting.timezone ?? "America/Los_Angeles", "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatInTimeZone(parseISO(meeting.startTime), meeting.eventTimezone ?? meeting.timezone ?? "America/Los_Angeles", "h:mm a")} --{" "}
                        {meeting.durationMinutes} min
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {meeting.title}
                    </TableCell>
                    <TableCell>
                      {meeting.externalAttendeeName && (
                        <div>
                          <div className="text-sm">
                            {meeting.externalAttendeeName}
                          </div>
                          {meeting.externalAttendeeCompany && (
                            <div className="text-xs text-muted-foreground">
                              {meeting.externalAttendeeCompany}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {meeting.noRoomRequired ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">No room</Badge>
                      ) : (
                        meeting.roomName ?? "--"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {meeting.eventName ?? "--"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(meeting.status)}>
                        {meeting.status ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {meeting.prepNotes ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {meeting.prepNotes}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          None
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
