"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Loader2, TriangleAlert, X } from "lucide-react";
import { format, parseISO, addDays, isAfter } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MeetingRequest {
  id: string;
  eventId: string;
  eventName: string | null;
  status: string;
  meetingType: string | null;
  accountName: string;
  estimatedDealSize: string | null;
  businessImpact: string | null;
  guestName: string;
  guestEmail: string;
  guestTitle: string | null;
  guestCompany: string | null;
  additionalGuests: Array<{ name: string; email: string; title?: string; company?: string }> | null;
  noRoomRequired: boolean;
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

interface RequestDetailSheetProps {
  request: MeetingRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  people: Person[];
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventTimezone: string | null;
  onStatusChange: () => void;
}

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

export function RequestDetailSheet({
  request,
  open,
  onOpenChange,
  rooms,
  people,
  eventStartDate,
  eventEndDate,
  eventTimezone,
  onStatusChange,
}: RequestDetailSheetProps) {
  const [action, setAction] = useState<"approve" | "reject" | "info" | null>(null);
  const [saving, setSaving] = useState(false);

  // Approve form
  const [roomId, setRoomId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");

  // Pre-populate participants from requested exec IDs
  useEffect(() => {
    if (request?.requestedExecIds?.length) {
      setParticipantIds(request.requestedExecIds);
    } else {
      setParticipantIds([]);
    }
  }, [request?.id]);

  // Booked slots for conflict display
  const [bookedSlots, setBookedSlots] = useState<Array<{ start: string; end: string }>>([]);

  // Fetch existing meetings when room + date change
  const fetchBookedSlots = useCallback(async () => {
    if (!roomId || !selectedDate || !request?.eventId) {
      setBookedSlots([]);
      return;
    }
    try {
      const res = await fetch(`/api/events/${request.eventId}/meetings?date=${selectedDate}`);
      if (!res.ok) return;
      const meetings = await res.json();
      setBookedSlots(
        meetings
          .filter((m: { roomId: string | null; status: string }) => m.roomId === roomId && m.status !== "cancelled")
          .map((m: { startTime: string; endTime: string }) => ({ start: m.startTime, end: m.endTime }))
      );
    } catch {
      // silently fail
    }
  }, [roomId, selectedDate, request?.eventId]);

  useEffect(() => {
    fetchBookedSlots();
  }, [fetchBookedSlots]);

  // Reject / Info form
  const [reason, setReason] = useState("");

  // Generate event date options
  const eventDateOptions = useMemo(() => {
    if (!eventStartDate || !eventEndDate) return [];
    // Parse as UTC dates to avoid browser timezone shifting the day
    const startStr = eventStartDate.slice(0, 10); // "YYYY-MM-DD"
    const endStr = eventEndDate.slice(0, 10);
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const [ey, em, ed] = endStr.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd); // local midnight, correct date
    const end = new Date(ey, em - 1, ed);
    const dates: { value: string; label: string }[] = [];
    let current = start;
    while (!isAfter(current, end)) {
      dates.push({
        value: format(current, "yyyy-MM-dd"),
        label: format(current, "EEE, MMM d"),
      });
      current = addDays(current, 1);
    }
    return dates;
  }, [eventStartDate, eventEndDate]);

  // Time slot options with conflict marking
  const timeSlots = useMemo(() => {
    const tz = eventTimezone ?? "America/Los_Angeles";
    const dur = parseInt(durationMinutes, 10) || 30;
    const slots: { value: string; label: string; booked: boolean }[] = [];
    for (let h = 7; h < 20; h++) {
      for (const m of [0, 30]) {
        const hh = h.toString().padStart(2, "0");
        const mm = m.toString().padStart(2, "0");
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;

        // Check if this slot conflicts with any booked meeting
        let booked = false;
        if (selectedDate && bookedSlots.length > 0) {
          const slotStart = fromZonedTime(new Date(`${selectedDate}T${hh}:${mm}:00`), tz);
          const slotEnd = new Date(slotStart.getTime() + dur * 60000);
          booked = bookedSlots.some((b) => {
            const bStart = new Date(b.start);
            const bEnd = new Date(b.end);
            return slotStart < bEnd && slotEnd > bStart;
          });
        }

        slots.push({
          value: `${hh}:${mm}`,
          label: `${h12}:${mm} ${ampm}${booked ? " (booked)" : ""}`,
          booked,
        });
      }
    }
    return slots;
  }, [bookedSlots, selectedDate, eventTimezone, durationMinutes]);

  const resetForms = () => {
    setAction(null);
    setRoomId("");
    setSelectedDate("");
    setSelectedTime("");
    setDurationMinutes("30");
    setParticipantIds([]);
    setParticipantSearch("");
    setReason("");
  };

  const handleApprove = async () => {
    const isNoRoom = request?.noRoomRequired;
    if (!request || !selectedDate || !selectedTime) return;
    if (!isNoRoom && !roomId) return;
    setSaving(true);
    try {
      const dur = parseInt(durationMinutes, 10);
      const tz = eventTimezone ?? "America/Los_Angeles";
      const venueStart = new Date(`${selectedDate}T${selectedTime}:00`);
      const start = fromZonedTime(venueStart, tz);
      const end = new Date(start.getTime() + dur * 60_000);

      const payload: Record<string, unknown> = {
        status: "approved",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes: dur,
        participantIds,
      };
      if (!isNoRoom) {
        payload.roomId = roomId;
      }

      const res = await fetch(`/api/meeting-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }
      toast.success("Request approved — meeting created");
      resetForms();
      onOpenChange(false);
      onStatusChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!request || !reason) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/meeting-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", rejectionReason: reason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      toast.success("Request rejected");
      resetForms();
      onOpenChange(false);
      onStatusChange();
    } catch {
      toast.error("Failed to reject request");
    } finally {
      setSaving(false);
    }
  };

  const handleInfoRequest = async () => {
    if (!request || !reason) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/meeting-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "info_requested", infoRequestMessage: reason }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Info requested");
      resetForms();
      onOpenChange(false);
      onStatusChange();
    } catch {
      toast.error("Failed to request info");
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  const isActionable = request.status === "pending" || request.status === "info_requested";

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForms(); }}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {request.accountName}
            {statusBadge(request.status)}
          </SheetTitle>
          <SheetDescription>
            Submitted by {request.requesterName} via {request.source === "moperator" ? "mOperator" : "in-app form"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          {/* Account Info */}
          <div>
            <h4 className="text-sm font-medium mb-2">Account</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Account</dt>
              <dd>{request.accountName}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="capitalize">{request.meetingType || "—"}</dd>
              <dt className="text-muted-foreground">Deal Size</dt>
              <dd>{request.estimatedDealSize || "—"}</dd>
              <dt className="text-muted-foreground">Impact</dt>
              <dd>{request.businessImpact || "—"}</dd>
            </dl>
          </div>

          <Separator />

          {/* Guest Info */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              {request.additionalGuests?.length ? "Guests" : "Guest"}
            </h4>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">{request.guestName}</span>
                {request.guestTitle && <span className="text-muted-foreground">, {request.guestTitle}</span>}
                {request.guestCompany && <span className="text-muted-foreground"> at {request.guestCompany}</span>}
                <div className="text-muted-foreground text-xs">{request.guestEmail}</div>
              </div>
              {request.additionalGuests?.map((g, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{g.name}</span>
                  {g.title && <span className="text-muted-foreground">, {g.title}</span>}
                  {g.company && <span className="text-muted-foreground"> at {g.company}</span>}
                  <div className="text-muted-foreground text-xs">{g.email}</div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Request Details */}
          <div>
            <h4 className="text-sm font-medium mb-2">Details</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Event</dt>
              <dd>{request.eventName || "—"}</dd>
              <dt className="text-muted-foreground">Goal</dt>
              <dd>{request.goalOutcome || "—"}</dd>
              <dt className="text-muted-foreground">No Room Required</dt>
              <dd>{request.noRoomRequired ? <Badge variant="secondary" className="text-xs">Yes</Badge> : "No"}</dd>
              <dt className="text-muted-foreground">Exec on Invite</dt>
              <dd>
                {request.requestedExecIds?.length
                  ? request.requestedExecIds
                      .map((id) => people.find((p) => p.id === id)?.name)
                      .filter(Boolean)
                      .join(", ") || "Yes"
                  : request.requiresExec
                    ? "Yes (none selected)"
                    : "No"}
              </dd>
              <dt className="text-muted-foreground">Needs SE</dt>
              <dd>{request.needsSe ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Preferred Window</dt>
              <dd>{request.preferredDateWindow || "—"}</dd>
            </dl>
            {request.notes && (
              <p className="mt-2 text-sm text-muted-foreground border-l-2 pl-3">
                {request.notes}
              </p>
            )}
          </div>

          {/* Rejection / Info messages */}
          {request.rejectionReason && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-1">Rejection Reason</h4>
                <p className="text-sm text-muted-foreground">{request.rejectionReason}</p>
              </div>
            </>
          )}
          {request.infoRequestMessage && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-1">Info Requested</h4>
                <p className="text-sm text-muted-foreground">{request.infoRequestMessage}</p>
              </div>
            </>
          )}

          {/* ── Actions for pending requests ───────────────────── */}
          {isActionable && (
            <>
              <Separator />
              <div className="space-y-3">
                {!action && (
                  <>
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3">
                    <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      Only event owners should approve requests. Approving will automatically send calendar invites to all attendees.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setAction("approve")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setAction("reject")}>
                      Reject
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAction("info")}>
                      Request Info
                    </Button>
                  </div>
                  </>
                )}

                {/* Approve Form */}
                {action === "approve" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <h4 className="text-sm font-medium">Assign Meeting</h4>
                    {request.noRoomRequired && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        No room required — Cal.com invite will not be sent
                      </p>
                    )}
                    {eventTimezone && (
                      <p className="text-xs text-muted-foreground">
                        Times are in {eventTimezone.replace(/_/g, " ")}
                      </p>
                    )}
                    <div className="space-y-2">
                      {!request.noRoomRequired && (
                      <div>
                        <Label className="text-xs">Room *</Label>
                        <Select value={roomId} onValueChange={setRoomId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select room" />
                          </SelectTrigger>
                          <SelectContent>
                            {rooms.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}{r.capacity ? ` (${r.capacity})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Date *</Label>
                          <Select value={selectedDate} onValueChange={setSelectedDate}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select date" />
                            </SelectTrigger>
                            <SelectContent>
                              {eventDateOptions.map((d) => (
                                <SelectItem key={d.value} value={d.value}>
                                  {d.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Time *</Label>
                          <Select value={selectedTime} onValueChange={setSelectedTime}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                            <SelectContent>
                              {timeSlots.map((t) => (
                                <SelectItem key={t.value} value={t.value} disabled={t.booked}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Duration</Label>
                        <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                          <SelectTrigger>
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
                      <div>
                        <Label className="text-xs">Participants</Label>
                        {participantIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 mb-1.5">
                            {participantIds.map((id) => {
                              const person = people.find((p) => p.id === id);
                              if (!person) return null;
                              return (
                                <Badge
                                  key={id}
                                  variant="default"
                                  className="cursor-pointer text-xs"
                                  onClick={() =>
                                    setParticipantIds((prev) =>
                                      prev.filter((pid) => pid !== id)
                                    )
                                  }
                                >
                                  {person.name}
                                  <X className="size-3 ml-1" />
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <Input
                          placeholder="Search people..."
                          value={participantSearch}
                          onChange={(e) => setParticipantSearch(e.target.value)}
                          className="text-xs"
                        />
                        {participantSearch.trim() && (
                          <div className="max-h-32 overflow-y-auto rounded-md border mt-1">
                            {people
                              .filter(
                                (p) =>
                                  !participantIds.includes(p.id) &&
                                  (p.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
                                    p.type.toLowerCase().includes(participantSearch.toLowerCase()))
                              )
                              .map((person) => (
                                <button
                                  key={person.id}
                                  type="button"
                                  className="flex w-full items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent text-left"
                                  onClick={() => {
                                    setParticipantIds((prev) => [...prev, person.id]);
                                    setParticipantSearch("");
                                  }}
                                >
                                  {person.name}
                                  <span className="text-muted-foreground">({person.type})</span>
                                </button>
                              ))}
                            {people.filter(
                              (p) =>
                                !participantIds.includes(p.id) &&
                                (p.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
                                  p.type.toLowerCase().includes(participantSearch.toLowerCase()))
                            ).length === 0 && (
                              <p className="px-2 py-1.5 text-xs text-muted-foreground">No results</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleApprove} disabled={saving || (!request.noRoomRequired && !roomId) || !selectedDate || !selectedTime}>
                        {saving && <Loader2 className="animate-spin size-3" />}
                        Confirm Approval
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAction(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Reject Form */}
                {action === "reject" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <h4 className="text-sm font-medium">Rejection Reason</h4>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why is this request being rejected?"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleReject} disabled={saving || !reason}>
                        {saving && <Loader2 className="animate-spin size-3" />}
                        Confirm Rejection
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAction(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Info Request Form */}
                {action === "info" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <h4 className="text-sm font-medium">Request More Info</h4>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="What additional information is needed?"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleInfoRequest} disabled={saving || !reason}>
                        {saving && <Loader2 className="animate-spin size-3" />}
                        Send Request
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAction(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
