"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Person {
  id: string;
  userId: string | null;
  type: "exec" | "ae";
  name: string;
  email: string;
  title: string | null;
  calcomUsername: string | null;
  calcomEventTypeId: number | null;
  googleCalendarId: string | null;
  sfdcOwnerId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PersonFormData {
  name: string;
  email: string;
  type: "exec" | "ae";
  title: string;
  calcomUsername: string;
  calcomEventTypeId: string;
  googleCalendarId: string;
  sfdcOwnerId: string;
}

function personToFormData(person: Person): PersonFormData {
  return {
    name: person.name,
    email: person.email,
    type: person.type,
    title: person.title ?? "",
    calcomUsername: person.calcomUsername ?? "",
    calcomEventTypeId: person.calcomEventTypeId?.toString() ?? "",
    googleCalendarId: person.googleCalendarId ?? "",
    sfdcOwnerId: person.sfdcOwnerId ?? "",
  };
}

function formDataToPayload(data: PersonFormData) {
  return {
    name: data.name,
    email: data.email,
    type: data.type,
    title: data.title || undefined,
    calcomUsername: data.calcomUsername || undefined,
    calcomEventTypeId: data.calcomEventTypeId
      ? parseInt(data.calcomEventTypeId, 10)
      : undefined,
    googleCalendarId: data.googleCalendarId || undefined,
    sfdcOwnerId: data.sfdcOwnerId || undefined,
  };
}

export default function PersonDetailPage() {
  const params = useParams<{ personId: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState<PersonFormData>({
    name: "",
    email: "",
    type: "exec",
    title: "",
    calcomUsername: "",
    calcomEventTypeId: "",
    googleCalendarId: "",
    sfdcOwnerId: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchPerson = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/people/${params.personId}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Person not found");
          router.push("/people");
          return;
        }
        throw new Error("Failed to fetch person");
      }
      const data = await res.json();
      setPerson(data);
    } catch {
      toast.error("Failed to load person");
    } finally {
      setLoading(false);
    }
  }, [params.personId, router]);

  useEffect(() => {
    fetchPerson();
  }, [fetchPerson]);

  const openEditDialog = () => {
    if (!person) return;
    setFormData(personToFormData(person));
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!person) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataToPayload(formData)),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update person");
      }
      toast.success("Person updated successfully");
      setEditOpen(false);
      fetchPerson();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update person"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!person) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/people")}>
          <ArrowLeft />
          <span className="sr-only">Back to people</span>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{person.name}</h2>
            <Badge
              className={
                person.type === "exec"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              }
            >
              {person.type === "exec" ? "Executive" : "Account Executive"}
            </Badge>
          </div>
          <p className="text-muted-foreground">{person.email}</p>
        </div>
        <Button variant="outline" onClick={openEditDialog}>
          <Pencil />
          Edit
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Person Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Person Details</CardTitle>
            <CardDescription>
              Contact and configuration information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Name
                </dt>
                <dd className="col-span-2 text-sm">{person.name}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Email
                </dt>
                <dd className="col-span-2 text-sm">{person.email}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Type
                </dt>
                <dd className="col-span-2 text-sm">
                  {person.type === "exec" ? "Executive" : "Account Executive"}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Title
                </dt>
                <dd className="col-span-2 text-sm">
                  {person.title || "-"}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Cal.com Username
                </dt>
                <dd className="col-span-2 text-sm">
                  {person.calcomUsername || "-"}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Cal.com Event Type ID
                </dt>
                <dd className="col-span-2 text-sm">
                  {person.calcomEventTypeId ?? "-"}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Google Calendar ID
                </dt>
                <dd className="col-span-2 text-sm">
                  {person.googleCalendarId || "-"}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  SFDC Owner ID
                </dt>
                <dd className="col-span-2 text-sm">
                  {person.sfdcOwnerId || "-"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Upcoming Meetings Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Meetings</CardTitle>
            <CardDescription>
              Scheduled meetings for this person
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Upcoming meetings will appear here.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Person Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
            <DialogDescription>
              Update the person&apos;s information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name *
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="col-span-3"
                placeholder="John Doe"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                Email *
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="col-span-3"
                placeholder="john@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-type" className="text-right">
                Type *
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value: "exec" | "ae") =>
                  setFormData((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exec">Executive</SelectItem>
                  <SelectItem value="ae">Account Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-title" className="text-right">
                Title
              </Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                className="col-span-3"
                placeholder="VP of Sales"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-calcomUsername" className="text-right">
                Cal.com Username
              </Label>
              <Input
                id="edit-calcomUsername"
                value={formData.calcomUsername}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    calcomUsername: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="johndoe"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-calcomEventTypeId" className="text-right">
                Cal.com Event Type ID
              </Label>
              <Input
                id="edit-calcomEventTypeId"
                type="number"
                value={formData.calcomEventTypeId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    calcomEventTypeId: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="12345"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-googleCalendarId" className="text-right">
                Google Calendar ID
              </Label>
              <Input
                id="edit-googleCalendarId"
                value={formData.googleCalendarId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    googleCalendarId: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="john@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-sfdcOwnerId" className="text-right">
                SFDC Owner ID
              </Label>
              <Input
                id="edit-sfdcOwnerId"
                value={formData.sfdcOwnerId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sfdcOwnerId: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="005..."
              />
            </div>
          </div>
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
    </div>
  );
}
