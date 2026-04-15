"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// ─── Types ───────────────────────────────────────────────────────────

interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  timezone?: string | null;
  googleEventId?: string | null;
  googleCalendarId?: string | null;
}

interface SilentEditDialogProps {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Convert an ISO datetime string to a value suitable for datetime-local input.
 * datetime-local expects "YYYY-MM-DDTHH:MM" format without timezone offset.
 */
function toDatetimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

// ─── Component ───────────────────────────────────────────────────────

export function SilentEditDialog({
  meeting,
  open,
  onOpenChange,
  onSuccess,
}: SilentEditDialogProps) {
  const [loading, setLoading] = useState(false);

  // Form state — all optional; empty string means "no change"
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [addEmails, setAddEmails] = useState("");
  const [removeEmails, setRemoveEmails] = useState("");

  function resetForm() {
    setNewTitle("");
    setNewDescription("");
    setNewLocation("");
    setNewStartTime("");
    setNewEndTime("");
    setAddEmails("");
    setRemoveEmails("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Build request body — only include non-empty fields
      const body: Record<string, unknown> = {};

      if (newTitle.trim()) body.newTitle = newTitle.trim();
      if (newDescription.trim()) body.newDescription = newDescription.trim();
      if (newLocation.trim()) body.newLocation = newLocation.trim();

      if (newStartTime) {
        body.newStartTime = new Date(newStartTime).toISOString();
      }
      if (newEndTime) {
        body.newEndTime = new Date(newEndTime).toISOString();
      }

      if (addEmails.trim()) {
        body.addAttendeeEmails = addEmails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
      }
      if (removeEmails.trim()) {
        body.removeAttendeeEmails = removeEmails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
      }

      // Check that at least one change is specified
      if (Object.keys(body).length === 0) {
        toast.error("No changes specified");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/meetings/${meeting.id}/silent-update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to apply silent update");
      }

      toast.success("Meeting updated silently");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply silent update"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Silent Edit: {meeting.title}</DialogTitle>
          <DialogDescription>
            Modify the Google Calendar event without notifying attendees.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>Silent modification</AlertTitle>
          <AlertDescription>
            These changes will be applied silently. The external attendee will
            NOT receive a notification email about these changes.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="silent-title">New title</Label>
            <Input
              id="silent-title"
              placeholder={meeting.title}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="silent-description">New description</Label>
            <Textarea
              id="silent-description"
              placeholder={meeting.description ?? "Add a description..."}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="silent-location">New location</Label>
            <Input
              id="silent-location"
              placeholder="Meeting room or address"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            />
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label htmlFor="silent-start">New start time</Label>
            <Input
              id="silent-start"
              type="datetime-local"
              value={newStartTime || toDatetimeLocal(meeting.startTime)}
              onChange={(e) => setNewStartTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Current: {new Date(meeting.startTime).toLocaleString()}
            </p>
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <Label htmlFor="silent-end">New end time</Label>
            <Input
              id="silent-end"
              type="datetime-local"
              value={newEndTime || toDatetimeLocal(meeting.endTime)}
              onChange={(e) => setNewEndTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Current: {new Date(meeting.endTime).toLocaleString()}
            </p>
          </div>

          {/* Add attendees */}
          <div className="space-y-2">
            <Label htmlFor="silent-add-emails">Add attendee emails</Label>
            <Input
              id="silent-add-emails"
              placeholder="email1@example.com, email2@example.com"
              value={addEmails}
              onChange={(e) => setAddEmails(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated email addresses to add silently
            </p>
          </div>

          {/* Remove attendees */}
          <div className="space-y-2">
            <Label htmlFor="silent-remove-emails">Remove attendee emails</Label>
            <Input
              id="silent-remove-emails"
              placeholder="email@example.com"
              value={removeEmails}
              onChange={(e) => setRemoveEmails(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated email addresses to remove silently
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Applying..." : "Apply Silent Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
