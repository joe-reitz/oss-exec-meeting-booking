"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const emptyFormData: PersonFormData = {
  name: "",
  email: "",
  type: "exec",
  title: "",
  calcomUsername: "",
  calcomEventTypeId: "",
  googleCalendarId: "",
  sfdcOwnerId: "",
};

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
    googleCalendarId: data.email || undefined,
  };
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [formData, setFormData] = useState<PersonFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/people");
      if (!res.ok) throw new Error("Failed to fetch people");
      const data = await res.json();
      setPeople(data);
    } catch {
      toast.error("Failed to load people");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const filteredPeople =
    activeTab === "all"
      ? people
      : people.filter((p) => p.type === activeTab);

  // Add person
  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataToPayload(formData)),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create person");
      }
      toast.success("Person created successfully");
      setAddOpen(false);
      setFormData(emptyFormData);
      fetchPeople();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create person"
      );
    } finally {
      setSaving(false);
    }
  };

  // Edit person
  const handleEdit = async () => {
    if (!selectedPerson) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${selectedPerson.id}`, {
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
      setSelectedPerson(null);
      setFormData(emptyFormData);
      fetchPeople();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update person"
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete person
  const handleDelete = async () => {
    if (!selectedPerson) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${selectedPerson.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete person");
      }
      toast.success("Person deleted successfully");
      setDeleteOpen(false);
      setSelectedPerson(null);
      fetchPeople();
    } catch {
      toast.error("Failed to delete person");
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (person: Person) => {
    setSelectedPerson(person);
    setFormData(personToFormData(person));
    setEditOpen(true);
  };

  const openDeleteDialog = (person: Person) => {
    setSelectedPerson(person);
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
          <h2 className="text-2xl font-bold tracking-tight">People</h2>
          <p className="text-muted-foreground">
            Manage executives and account executives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                const res = await fetch("/api/people/sync-calcom", {
                  method: "POST",
                });
                if (!res.ok) {
                  const data = await res.json();
                  throw new Error(data.error || "Sync failed");
                }
                const data = await res.json();
                toast.success(
                  `Synced Cal.com usernames: ${data.updated} updated, ${data.skipped} skipped`
                );
                fetchPeople();
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Failed to sync"
                );
              } finally {
                setSyncing(false);
              }
            }}
          >
            {syncing ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Sync Cal.com
          </Button>
          <Button onClick={openAddDialog}>
            <Plus />
            Add Person
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="exec">Executives</TabsTrigger>
          <TabsTrigger value="ae">Account Executives</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPeople.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No people found.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={openAddDialog}
              >
                <Plus />
                Add your first person
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeople.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/people/${person.id}`}
                          className="hover:underline"
                        >
                          {person.name}
                        </Link>
                      </TableCell>
                      <TableCell>{person.email}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            person.type === "exec"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          }
                        >
                          {person.type === "exec"
                            ? "Executive"
                            : "Account Executive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{person.title ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEditDialog(person)}
                          >
                            <Pencil />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openDeleteDialog(person)}
                          >
                            <Trash2 className="text-destructive" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Person Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Person</DialogTitle>
            <DialogDescription>
              Add a new executive or account executive.
            </DialogDescription>
          </DialogHeader>
          <PersonForm formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Add Person
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Person Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
            <DialogDescription>
              Update the person&apos;s information.
            </DialogDescription>
          </DialogHeader>
          <PersonForm formData={formData} setFormData={setFormData} />
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
            <DialogTitle>Delete Person</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{selectedPerson?.name}</span>?
              This action cannot be undone.
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

function PersonForm({
  formData,
  setFormData,
}: {
  formData: PersonFormData;
  setFormData: React.Dispatch<React.SetStateAction<PersonFormData>>;
}) {
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
          placeholder="John Doe"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="email" className="text-right">
          Email *
        </Label>
        <Input
          id="email"
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
        <Label htmlFor="type" className="text-right">
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
        <Label htmlFor="title" className="text-right">
          Title
        </Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
          className="col-span-3"
          placeholder="VP of Sales"
        />
      </div>
    </div>
  );
}
