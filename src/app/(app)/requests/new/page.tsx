"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

interface Event {
  id: string;
  name: string;
  endDate: string | null;
  isActive: boolean | null;
}

interface Person {
  id: string;
  name: string;
  email: string;
  type: string;
}

export default function NewRequestPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  const [form, setForm] = useState({
    eventId: "",
    meetingType: "" as "" | "prospect" | "customer",
    noRoomRequired: false,
    accountName: "",
    estimatedDealSize: "",
    businessImpact: "",
    guestName: "",
    guestEmail: "",
    guestTitle: "",
    guestCompany: "",
    additionalGuests: [] as Array<{ name: string; email: string; title: string; company: string }>,
    goalOutcome: "",
    requiresExec: false,
    requestedExecIds: [] as string[],
    needsSe: false,
    preferredDateWindow: "",
    notes: "",
    requesterName: "",
    requesterEmail: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, peopleRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/people"),
      ]);
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        const now = new Date();
        setEvents(data.filter((e: Event) => e.isActive && (!e.endDate || new Date(e.endDate) >= now)));
      }
      if (peopleRes.ok) {
        const data = await peopleRes.json();
        setPeople(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const execs = people.filter((p) => p.type === "exec");

  const [validationFailed, setValidationFailed] = useState(false);

  const handleSubmit = async () => {
    if (
      !form.eventId || !form.meetingType || !form.accountName || !form.estimatedDealSize ||
      !form.businessImpact || !form.guestName || !form.guestEmail || !form.guestTitle ||
      !form.guestCompany || !form.goalOutcome || !form.preferredDateWindow || !form.notes ||
      !form.requesterName || !form.requesterEmail
    ) {
      setValidationFailed(true);
      setTimeout(() => setValidationFailed(false), 1000);
      toast.error("Please fill in all required fields");
      return;
    }
    setValidationFailed(false);

    setSaving(true);
    try {
      const payload = {
        ...form,
        additionalGuests: form.additionalGuests.filter((g) => g.name && g.email).length > 0
          ? form.additionalGuests.filter((g) => g.name && g.email)
          : undefined,
        requestedExecIds: form.requestedExecIds.length > 0 ? form.requestedExecIds : undefined,
      };

      const res = await fetch("/api/meeting-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }

      toast.success("Meeting request submitted");
      router.push("/requests");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/requests")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Meeting Request</h2>
          <p className="text-muted-foreground">
            Submit a meeting request for review
          </p>
        </div>
      </div>

      {/* Event Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event</CardTitle>
          <CardDescription>Which event is this meeting for?</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={form.eventId} onValueChange={(v) => set("eventId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an event *" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Account Name *</Label>
            <Input
              value={form.accountName}
              onChange={(e) => set("accountName", e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Meeting Type *</Label>
              <Select value={form.meetingType} onValueChange={(v) => set("meetingType", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated Deal Size *</Label>
              <Input
                value={form.estimatedDealSize}
                onChange={(e) => set("estimatedDealSize", e.target.value)}
                placeholder="$500K"
              />
            </div>
          </div>
          <div>
            <Label>Business Impact *</Label>
            <Textarea
              value={form.businessImpact}
              onChange={(e) => set("businessImpact", e.target.value)}
              placeholder="Strategic account, expansion opportunity..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Guest Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Guest Information</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  additionalGuests: [...p.additionalGuests, { name: "", email: "", title: "", company: "" }],
                }))
              }
            >
              <Plus className="size-3 mr-1" />
              Add Guest
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Primary guest</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.guestName}
                onChange={(e) => set("guestName", e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.guestEmail}
                onChange={(e) => set("guestEmail", e.target.value)}
                placeholder="jane@acme.com"
              />
            </div>
            <div>
              <Label>Title *</Label>
              <Input
                value={form.guestTitle}
                onChange={(e) => set("guestTitle", e.target.value)}
                placeholder="VP Engineering"
              />
            </div>
            <div>
              <Label>Company *</Label>
              <Input
                value={form.guestCompany}
                onChange={(e) => set("guestCompany", e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          </div>
          {form.additionalGuests.map((guest, idx) => (
            <div key={idx} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Guest {idx + 2}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      additionalGuests: p.additionalGuests.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  <X className="size-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={guest.name}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      additionalGuests: p.additionalGuests.map((g, i) =>
                        i === idx ? { ...g, name: e.target.value } : g
                      ),
                    }))
                  }
                  placeholder="Name"
                />
                <Input
                  type="email"
                  value={guest.email}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      additionalGuests: p.additionalGuests.map((g, i) =>
                        i === idx ? { ...g, email: e.target.value } : g
                      ),
                    }))
                  }
                  placeholder="Email"
                />
                <Input
                  value={guest.company}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      additionalGuests: p.additionalGuests.map((g, i) =>
                        i === idx ? { ...g, company: e.target.value } : g
                      ),
                    }))
                  }
                  placeholder="Company"
                />
                <Input
                  value={guest.title}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      additionalGuests: p.additionalGuests.map((g, i) =>
                        i === idx ? { ...g, title: e.target.value } : g
                      ),
                    }))
                  }
                  placeholder="Title"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Meeting Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Goal / Outcome *</Label>
            <Textarea
              value={form.goalOutcome}
              onChange={(e) => set("goalOutcome", e.target.value)}
              placeholder="Product demo, technical deep dive, executive alignment..."
              rows={2}
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.noRoomRequired}
                onCheckedChange={(v) => set("noRoomRequired", v)}
              />
              <Label>No Room Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.requiresExec}
                onCheckedChange={(v) => set("requiresExec", v)}
              />
              <Label>Requires Executive</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.needsSe}
                onCheckedChange={(v) => set("needsSe", v)}
              />
              <Label>Needs SE</Label>
            </div>
          </div>
          {form.noRoomRequired && (
            <p className="text-xs text-muted-foreground">
              This meeting will not require a room or send a Cal.com invite. It will be tracked as an AE meeting.
            </p>
          )}
          {form.requiresExec && execs.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Include Executive(s) on Invite</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {execs.map((p) => (
                  <Badge
                    key={p.id}
                    variant={form.requestedExecIds.includes(p.id) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() =>
                      set(
                        "requestedExecIds",
                        form.requestedExecIds.includes(p.id)
                          ? form.requestedExecIds.filter((id) => id !== p.id)
                          : [...form.requestedExecIds, p.id]
                      )
                    }
                  >
                    {p.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label>Preferred Date/Time Window *</Label>
            <Input
              value={form.preferredDateWindow}
              onChange={(e) => set("preferredDateWindow", e.target.value)}
              placeholder="Tuesday afternoon, or anytime Wednesday"
            />
          </div>
          <div>
            <Label>Notes *</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any additional context..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Requester Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Your Name *</Label>
              <Input
                value={form.requesterName}
                onChange={(e) => set("requesterName", e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Your Email *</Label>
              <Input
                type="email"
                value={form.requesterEmail}
                onChange={(e) => set("requesterEmail", e.target.value)}
                placeholder="john@company.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => router.push("/requests")}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Submit Request
        </Button>
      </div>
    </div>
  );
}
