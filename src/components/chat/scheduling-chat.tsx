"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Calendar,
  User,
  MapPin,
  Target,
  CheckCircle2,
  Clock,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tool Result Renderers ──────────────────────────────────────────────

function AvailabilityResult({ data }: { data: Record<string, unknown> }) {
  const result = data as {
    success: boolean;
    message?: string;
    participants?: { name: string; type: string; title: string }[];
    room?: { name: string; capacity: number } | null;
    slots?: {
      start: string;
      end: string;
      startFormatted: string;
      endFormatted: string;
    }[];
    totalSlots?: number;
  };

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
        {result.message}
      </div>
    );
  }

  return (
    <Card className="gap-3 py-3">
      <CardHeader className="px-3 py-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar className="size-4 text-primary" />
          Available Time Slots
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-0">
        {result.participants && result.participants.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {result.participants.map((p, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {p.name} ({p.type})
              </Badge>
            ))}
          </div>
        )}
        {result.room && (
          <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="size-3" />
            {result.room.name}
            {result.room.capacity && ` (Cap: ${result.room.capacity})`}
          </div>
        )}
        {result.slots && result.slots.length > 0 ? (
          <div className="space-y-1">
            {result.slots.slice(0, 8).map((slot, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <Clock className="size-3 text-muted-foreground" />
                <span className="font-medium">{slot.startFormatted}</span>
                <span className="text-muted-foreground">to</span>
                <span>{slot.endFormatted}</span>
              </div>
            ))}
            {result.slots.length > 8 && (
              <p className="text-xs text-muted-foreground">
                + {result.slots.length - 8} more slots
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No available slots found in this range.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PersonResult({ data }: { data: Record<string, unknown> }) {
  const result = data as {
    success: boolean;
    message?: string;
    people?: {
      name: string;
      email: string;
      type: string;
      title: string;
      calcomUsername: string;
    }[];
  };

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
        {result.message}
      </div>
    );
  }

  return (
    <Card className="gap-3 py-3">
      <CardHeader className="px-3 py-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="size-4 text-primary" />
          People Found
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-0 space-y-2">
        {result.people?.map((p, i) => (
          <div key={i} className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{p.name}</span>
              <Badge variant="outline" className="text-xs">
                {p.type}
              </Badge>
            </div>
            {p.title && (
              <p className="text-xs text-muted-foreground">{p.title}</p>
            )}
            <p className="text-xs text-muted-foreground">{p.email}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RoomResult({ data }: { data: Record<string, unknown> }) {
  const result = data as {
    success: boolean;
    message?: string;
    event?: { id: string; name: string; location: string };
    rooms?: {
      name: string;
      description: string;
      capacity: number;
    }[];
    total?: number;
  };

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
        {result.message}
      </div>
    );
  }

  return (
    <Card className="gap-3 py-3">
      <CardHeader className="px-3 py-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className="size-4 text-primary" />
          Rooms ({result.total ?? 0})
          {result.event && (
            <span className="text-xs text-muted-foreground font-normal">
              - {result.event.name}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-0 space-y-2">
        {result.rooms?.map((r, i) => (
          <div key={i} className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.name}</span>
              {r.capacity && (
                <Badge variant="secondary" className="text-xs">
                  Cap: {r.capacity}
                </Badge>
              )}
            </div>
            {r.description && (
              <p className="text-xs text-muted-foreground">{r.description}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GoalProgressResult({ data }: { data: Record<string, unknown> }) {
  const result = data as {
    success: boolean;
    message?: string;
    goals?: {
      name: string;
      type: string;
      period: string;
      targetValue: number;
      currentValue: number;
      progressPercent: number;
      unit: string;
      personName: string | null;
    }[];
  };

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
        {result.message}
      </div>
    );
  }

  return (
    <Card className="gap-3 py-3">
      <CardHeader className="px-3 py-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="size-4 text-primary" />
          Goal Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-0 space-y-3">
        {result.goals?.map((g, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{g.name}</span>
              <span className="text-muted-foreground">
                {g.currentValue}/{g.targetValue} {g.unit}
              </span>
            </div>
            {g.personName && (
              <p className="text-[10px] text-muted-foreground">
                {g.personName} - {g.period}
              </p>
            )}
            <Progress value={g.progressPercent} className="h-1.5" />
            <p className="text-[10px] text-right text-muted-foreground">
              {g.progressPercent}%
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BookingConfirmationResult({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const result = data as {
    success: boolean;
    message?: string;
    meeting?: {
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      status: string;
      participants: { name: string; type: string }[];
      externalAttendee: {
        name: string;
        email: string;
        company?: string;
      };
    };
  };

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
        {result.message}
      </div>
    );
  }

  const meeting = result.meeting;
  if (!meeting) return null;

  return (
    <Card className="gap-3 border-green-200 bg-green-50 py-3 dark:border-green-900 dark:bg-green-950/30">
      <CardHeader className="px-3 py-0">
        <CardTitle className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-4" />
          Meeting Booked
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-0 space-y-2 text-xs">
        <div>
          <span className="font-medium">Title:</span> {meeting.title}
        </div>
        <div>
          <span className="font-medium">Time:</span>{" "}
          {new Date(meeting.startTime).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          -{" "}
          {new Date(meeting.endTime).toLocaleString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
        <div>
          <span className="font-medium">Status:</span>{" "}
          <Badge
            variant={meeting.status === "pending" ? "secondary" : "default"}
            className="text-[10px]"
          >
            {meeting.status}
          </Badge>
        </div>
        <div>
          <span className="font-medium">Participants:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {meeting.participants.map((p, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {p.name}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <span className="font-medium">External:</span>{" "}
          {meeting.externalAttendee.name} ({meeting.externalAttendee.email})
          {meeting.externalAttendee.company &&
            ` - ${meeting.externalAttendee.company}`}
        </div>
      </CardContent>
    </Card>
  );
}

function EventsResult({ data }: { data: Record<string, unknown> }) {
  const result = data as {
    success: boolean;
    events?: {
      name: string;
      description: string;
      location: string;
      startDate: string;
      endDate: string;
      timezone: string;
      color: string;
    }[];
  };

  return (
    <Card className="gap-3 py-3">
      <CardHeader className="px-3 py-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar className="size-4 text-primary" />
          Events
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-0 space-y-2">
        {result.events?.map((e, i) => (
          <div key={i} className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{e.name}</span>
              {e.location && (
                <Badge variant="secondary" className="text-xs">
                  {e.location}
                </Badge>
              )}
            </div>
            {e.description && (
              <p className="text-xs text-muted-foreground">{e.description}</p>
            )}
            {e.startDate && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(e.startDate).toLocaleDateString()} - {new Date(e.endDate).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Tool Result Router ─────────────────────────────────────────────────

function ToolResultCard({
  toolName,
  result,
}: {
  toolName: string;
  result: unknown;
}) {
  const data = result as Record<string, unknown>;

  switch (toolName) {
    case "findAvailability":
      return <AvailabilityResult data={data} />;
    case "lookupPerson":
      return <PersonResult data={data} />;
    case "listRooms":
      return <RoomResult data={data} />;
    case "listEvents":
      return <EventsResult data={data} />;
    case "checkGoalProgress":
      return <GoalProgressResult data={data} />;
    case "bookMeeting":
      return <BookingConfirmationResult data={data} />;
    default:
      return null;
  }
}

// ─── Helpers to extract info from parts ─────────────────────────────────

/** Extract text content from a UIMessage by scanning its parts */
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** Get the tool name from a tool-* part type string */
function getToolNameFromPartType(type: string): string {
  // Parts for tools are typed as "tool-<toolName>"
  if (type.startsWith("tool-")) {
    return type.slice(5);
  }
  return type;
}

// ─── Main Chat Component ────────────────────────────────────────────────

export function SchedulingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat();

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue.trim();
    setInputValue("");
    sendMessage({ text });
  };

  return (
    <>
      {/* Floating chat button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg"
        >
          <MessageSquare className="size-6" />
          <span className="sr-only">Open scheduling assistant</span>
        </Button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[400px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-primary-foreground" />
              <div>
                <h3 className="text-sm font-semibold text-primary-foreground">
                  Scheduling Assistant
                </h3>
                <p className="text-xs text-primary-foreground/70">
                  Book meetings, find availability
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {/* Welcome message */}
              {messages.length === 0 && (
                <div className="space-y-3 py-8 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <Calendar className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Hi! I can help you schedule meetings.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try asking me to find availability, look up people, or
                      book a meeting.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <SuggestionButton
                      text="Find availability for next week"
                      onClick={(text) => setInputValue(text)}
                    />
                    <SuggestionButton
                      text="What events and rooms are available?"
                      onClick={(text) => setInputValue(text)}
                    />
                    <SuggestionButton
                      text="Check goal progress"
                      onClick={(text) => setInputValue(text)}
                    />
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((message) => (
                <div key={message.id}>
                  {/* User message */}
                  {message.role === "user" && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                        {getMessageText(message)}
                      </div>
                    </div>
                  )}

                  {/* Assistant message */}
                  {message.role === "assistant" && (
                    <div className="space-y-2">
                      {message.parts.map((part, partIndex) => {
                        // Text parts
                        if (part.type === "text") {
                          const textPart = part as { type: "text"; text: string };
                          if (!textPart.text) return null;
                          return (
                            <div
                              key={partIndex}
                              className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm"
                            >
                              <MessageContent text={textPart.text} />
                            </div>
                          );
                        }

                        // Tool invocation parts (type is "tool-<name>")
                        if (part.type.startsWith("tool-")) {
                          const toolPart = part as {
                            type: string;
                            toolCallId: string;
                            state: string;
                            output?: unknown;
                            input?: unknown;
                          };
                          const toolName = getToolNameFromPartType(
                            toolPart.type
                          );

                          // Tool has completed with output
                          if (
                            toolPart.state === "output-available" &&
                            toolPart.output !== undefined
                          ) {
                            return (
                              <div key={partIndex}>
                                <ToolResultCard
                                  toolName={toolName}
                                  result={toolPart.output}
                                />
                              </div>
                            );
                          }

                          // Tool is still running
                          if (
                            toolPart.state === "input-available" ||
                            toolPart.state === "input-streaming"
                          ) {
                            return (
                              <div
                                key={partIndex}
                                className="flex items-center gap-2 text-xs text-muted-foreground"
                              >
                                <Loader2 className="size-3 animate-spin" />
                                <span>
                                  {getToolLoadingMessage(toolName)}
                                </span>
                              </div>
                            );
                          }

                          // Error state
                          if (toolPart.state === "output-error") {
                            return (
                              <div
                                key={partIndex}
                                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs"
                              >
                                Tool error occurred
                              </div>
                            );
                          }

                          return null;
                        }

                        return null;
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading &&
                messages.length > 0 &&
                messages[messages.length - 1].role === "user" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}

              {/* Error message */}
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Something went wrong. Please try again.
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t px-3 py-3"
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about scheduling..."
              className="flex-1 border-0 bg-muted/50 shadow-none focus-visible:ring-0"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !inputValue.trim()}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────

function SuggestionButton({
  text,
  onClick,
}: {
  text: string;
  onClick: (text: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {text}
    </button>
  );
}

function MessageContent({ text }: { text: string }) {
  // Simple markdown-like rendering for bold and line breaks
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        // Handle bold text
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              j % 2 === 1 ? (
                <strong key={j}>{part}</strong>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}

function getToolLoadingMessage(toolName: string): string {
  switch (toolName) {
    case "findAvailability":
      return "Checking availability...";
    case "lookupPerson":
      return "Looking up person...";
    case "listRooms":
      return "Loading rooms...";
    case "listEvents":
      return "Loading events...";
    case "checkGoalProgress":
      return "Checking goals...";
    case "bookMeeting":
      return "Booking meeting...";
    default:
      return "Processing...";
  }
}
