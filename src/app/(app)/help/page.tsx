"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Calendar,
  CalendarCheck,
  ChevronRight,
  DollarSign,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Rocket,
  Target,
  Trophy,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LucideIcon } from "lucide-react";

// ─── Scroll-triggered fade-in ────────────────────────────────────────

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Callout ─────────────────────────────────────────────────────────

function Callout({
  children,
  variant = "tip",
}: {
  children: React.ReactNode;
  variant?: "tip" | "info" | "warning";
}) {
  const styles = {
    tip: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-800",
      icon: "text-amber-600 dark:text-amber-400",
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200 dark:border-blue-800",
      icon: "text-blue-600 dark:text-blue-400",
    },
    warning: {
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-800",
      icon: "text-red-600 dark:text-red-400",
    },
  };
  const s = styles[variant];
  return (
    <div
      className={`mt-3 flex items-start gap-2.5 rounded-lg border ${s.border} ${s.bg} px-3.5 py-3 text-sm leading-relaxed`}
    >
      <Lightbulb className={`mt-0.5 size-4 shrink-0 ${s.icon}`} />
      <div>{children}</div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  defaultOpen,
  children,
}: {
  icon: LucideIcon;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <FadeIn>
      <details
        className="group rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow duration-300 hover:shadow-md"
        open={defaultOpen}
      >
        <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-semibold select-none list-none [&::-webkit-details-marker]:hidden">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors duration-200 group-hover:bg-primary/15">
            <Icon className="size-4 text-primary" />
          </div>
          <span className="flex-1">{title}</span>
          <ChevronRight className="size-4 text-muted-foreground transition-transform duration-300 ease-out group-open:rotate-90" />
        </summary>
        <div className="animate-in fade-in slide-in-from-top-1 duration-300 px-5 pb-5 pt-1 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
      </details>
    </FadeIn>
  );
}

// ─── FAQ Item ────────────────────────────────────────────────────────

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b last:border-0">
      <summary className="flex cursor-pointer items-center gap-2 py-4 text-sm font-medium select-none list-none [&::-webkit-details-marker]:hidden transition-colors duration-200 hover:text-primary">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out group-open:rotate-90" />
        <span>{question}</span>
      </summary>
      <div className="animate-in fade-in slide-in-from-top-1 duration-200 pb-4 pl-6 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

// ─── Quick Start Step ────────────────────────────────────────────────

function Step({
  number,
  icon: Icon,
  title,
  description,
  children,
  delay,
}: {
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay}>
      <details className="group h-full rounded-lg border bg-card shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20">
        <summary className="flex cursor-pointer items-start gap-4 p-4 select-none list-none [&::-webkit-details-marker]:hidden">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold transition-transform duration-300 group-hover:scale-110">
            {number}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
          <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out group-open:rotate-90" />
        </summary>
        <div className="animate-in fade-in slide-in-from-top-1 duration-300 border-t px-4 pb-4 pt-3 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
      </details>
    </FadeIn>
  );
}

// ─── Help Page ───────────────────────────────────────────────────────

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16">
      {/* ── Hero ────────────────────────────────────────────── */}
      <FadeIn>
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-primary/5 px-6 py-8">
          <div className="absolute -right-12 -top-12 size-40 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-primary/5 blur-2xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg transition-transform duration-300 hover:scale-105">
                <BookOpen className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  User Guide
                </h1>
                <p className="text-muted-foreground text-sm">
                  Everything you need to know about the Exec Meeting Booking
                  app.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Cal.com", "Google Calendar", "Salesforce", "Slack"].map(
                (name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="pointer-events-none cursor-default"
                  >
                    {name}
                  </Badge>
                )
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      <Separator />

      {/* ── Quick Start ─────────────────────────────────────── */}
      <div className="space-y-4">
        <FadeIn>
          <div className="flex items-center gap-2">
            <Rocket className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Quick Start</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Follow these six steps to go from zero to fully scheduled event.
          </p>
        </FadeIn>

        <div className="grid gap-3 sm:grid-cols-2">
          <Step
            number={1}
            icon={Calendar}
            title="Create an Event"
            description="Set up a conference, trade show, or field event."
            delay={0}
          >
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Go to <strong>Events</strong> in the sidebar.
              </li>
              <li>
                Click <strong>Add Event</strong>.
              </li>
              <li>Fill in name, dates, location, and timezone.</li>
              <li>Pick a color to visually distinguish the event.</li>
              <li>
                Toggle <strong>Active</strong> when ready.
              </li>
            </ol>
          </Step>

          <Step
            number={2}
            icon={LayoutDashboard}
            title="Add Rooms"
            description="Configure the physical meeting spaces."
            delay={75}
          >
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Open your event by clicking <strong>Manage</strong>.
              </li>
              <li>
                Click <strong>Add Room</strong> above the grid.
              </li>
              <li>Enter room name, description, and capacity.</li>
              <li>Repeat for each available room.</li>
            </ol>
          </Step>

          <Step
            number={3}
            icon={Users}
            title="Assign Executives"
            description="Tell the app which execs are attending."
            delay={150}
          >
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                On the Events page, click <strong>Edit</strong> on your event.
              </li>
              <li>
                In <strong>Assign Execs</strong>, check the boxes for attending
                execs.
              </li>
              <li>Save.</li>
            </ol>
            <Callout>
                Execs must be added to the <strong>People</strong> page first.
            </Callout>
          </Step>

          <Step
            number={4}
            icon={Target}
            title="Set Goals"
            description="Track meeting quotas and pipeline targets."
            delay={225}
          >
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                While creating or editing an event, scroll to{" "}
                <strong>Goals</strong>.
              </li>
              <li>
                Click <strong>Add Goal</strong> — enter a name and target value.
              </li>
              <li>
                Optionally break down by segment (Commercial, SMB, Startups,
                Majors).
              </li>
            </ol>
            <p className="mt-2 text-muted-foreground">
              Goals recalculate automatically every hour.
            </p>
          </Step>

          <Step
            number={5}
            icon={CalendarCheck}
            title="Book Meetings"
            description="Three ways to get meetings on the calendar."
            delay={300}
          >
            <div className="space-y-3">
              <div>
                <p className="font-medium">Option A: Click the Grid</p>
                <p className="text-muted-foreground">
                  Click an empty time slot on the room grid, fill in attendee
                  details, and click <strong>Book</strong>. Calendar invites are
                  sent automatically via Cal.com.
                </p>
              </div>
              <div>
                <p className="font-medium">Option B: Submit a Request</p>
                <p className="text-muted-foreground">
                  Go to <strong>Requests &gt; New Request</strong>, fill in the
                  form, and submit. The event owner reviews and approves from the
                  Requests page.
                </p>
              </div>
              <div>
                <p className="font-medium">Option C: AI Assistant</p>
                <p className="text-muted-foreground">
                  Click the chat icon in the bottom-right corner and ask a
                  natural language question like &ldquo;Find a 30-minute slot for
                  Lisa Chen with the VP of Sales at Acme Corp.&rdquo;
                </p>
              </div>
            </div>
          </Step>

          <Step
            number={6}
            icon={Trophy}
            title="Track Progress"
            description="Monitor metrics, prep for meetings, celebrate wins."
            delay={375}
          >
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <strong>Dashboard</strong> — key metrics at a glance.
              </li>
              <li>
                <strong>My Meetings</strong> — your personal schedule with prep
                notes.
              </li>
              <li>
                <strong>Leaderboard</strong> — who&apos;s booking the most,
                generating pipeline, and hitting goals.
              </li>
            </ul>
          </Step>
        </div>
      </div>

      <Separator />

      {/* ── Feature Reference ───────────────────────────────── */}
      <div className="space-y-4">
        <FadeIn>
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Feature Reference</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Detailed guide for every section of the app.
          </p>
        </FadeIn>

        <div className="space-y-3">
          <Section icon={LayoutDashboard} title="Dashboard">
            <p>Your command center. Four stat cards at the top:</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                {
                  label: "Meetings This Week",
                  desc: "Confirmed, pending, and completed meetings this week",
                },
                {
                  label: "RSVP Acceptance Rate",
                  desc: "% of external attendees who accepted their invite",
                },
                {
                  label: "Pipeline Influenced",
                  desc: "Total $ of Salesforce opportunities linked to meetings",
                },
                {
                  label: "Active Goals Progress",
                  desc: "Average completion % across active goals",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border p-3 transition-colors duration-200 hover:bg-muted/50"
                >
                  <p className="text-xs font-semibold">{stat.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {stat.desc}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3">Below the stats:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <strong>Upcoming Meetings</strong> — next 7 days with attendee
                names and RSVP status.
              </li>
              <li>
                <strong>Goal Progress</strong> — progress bars + bar chart of
                current vs. target.
              </li>
              <li>
                <strong>Pipeline Summary</strong> — pie chart by deal stage.
              </li>
              <li>
                <strong>Recent Activity</strong> — audit log of latest changes.
              </li>
            </ul>
            <Callout variant="info">
                Use the <strong>event filter</strong> dropdown at the top right
                to scope everything to a single event.
            </Callout>
          </Section>

          <Section icon={Calendar} title="Events & the Room Grid">
            <p>
              The <strong>Events</strong> page lists all conferences as cards
              showing name, dates, location, room count, and meeting count.
            </p>
            <p className="mt-2 font-medium">The Room &times; Time Grid</p>
            <p>
              Click <strong>Manage</strong> on an event to open the scheduling
              grid — the heart of the app.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>
                <strong>Columns</strong> = rooms. Each room is a column.
              </li>
              <li>
                <strong>Rows</strong> = 30-minute time slots from 7 AM to 8 PM.
              </li>
              <li>
                <strong>Meeting blocks</strong> show company name, attendee, and
                RSVP status.
              </li>
              <li>
                <strong>Empty cells</strong> are clickable — click to book a
                meeting.
              </li>
            </ul>
            <p className="mt-2">
              Use the <strong>date navigator</strong> arrows to move between
              event dates.
            </p>

            <p className="mt-3 font-medium">Meeting Details</p>
            <p>
              Click any meeting block to open the detail sheet. From here you
              can:
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>View and refresh RSVP status from Google Calendar.</li>
              <li>Edit time, room, or attendees.</li>
              <li>
                Use <strong>Silent Update</strong> to change details without
                notifying the attendee.
              </li>
              <li>
                Add or edit <strong>Prep Notes</strong>.
              </li>
              <li>
                Delete the meeting (cancels Cal.com booking + Google Calendar
                event).
              </li>
            </ul>
          </Section>

          <Section icon={Inbox} title="Meeting Requests">
            <div className="space-y-3">
              <div>
                <p className="font-medium">For AEs (submitting requests)</p>
                <ol className="mt-1 list-decimal space-y-1 pl-4">
                  <li>
                    Go to <strong>Requests &gt; New Request</strong>.
                  </li>
                  <li>
                    Fill in guest details, account name, estimated deal size, and
                    business impact.
                  </li>
                  <li>
                    Optionally request a specific exec and indicate if an SE is
                    needed.
                  </li>
                  <li>
                    Submit. Your request enters the queue as{" "}
                    <Badge variant="outline" className="mx-0.5">
                      Pending
                    </Badge>
                    .
                  </li>
                </ol>
              </div>
              <div>
                <p className="font-medium">
                  For Marketing (reviewing requests)
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-4">
                  <li>
                    Go to <strong>Requests</strong> and filter by status tab.
                  </li>
                  <li>Click a request to see full details.</li>
                  <li>
                    Choose: <strong>Approve</strong> (books the meeting),{" "}
                    <strong>Reject</strong> (with a reason), or{" "}
                    <strong>Request Info</strong>.
                  </li>
                </ol>
              </div>
            </div>
            <Callout variant="info">
                The sidebar badge shows how many requests are pending review.
            </Callout>
          </Section>

          <Section icon={CalendarCheck} title="My Meetings">
            <p>
              A personal view of all meetings where you are a participant.
              Designed primarily for AEs preparing for meetings.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Filter by event using the dropdown.</li>
              <li>
                See title, time, room, external attendee, RSVP status, and
                segment.
              </li>
              <li>
                Fill in <strong>Prep Notes</strong> — talking points, account
                context, or follow-ups.
              </li>
              <li>
                Click <strong>Export CSV</strong> for a spreadsheet of your
                schedule.
              </li>
            </ul>
            <Callout>
                You&apos;ll receive a Slack reminder 3 days before each meeting
                to fill in prep notes.
            </Callout>
          </Section>

          <Section icon={Users} title="People">
            <p>
              Manages your database of <strong>Executives</strong> and{" "}
              <strong>Account Executives</strong>. Use the tabs to switch between
              lists.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left font-medium">Field</th>
                    <th className="py-2 text-left font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      Name &amp; Email
                    </td>
                    <td className="py-2">Basic identity (required)</td>
                  </tr>
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      Type
                    </td>
                    <td className="py-2">
                      Exec or AE — determines how they appear in the app
                    </td>
                  </tr>
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      Cal.com Username
                    </td>
                    <td className="py-2">
                      Links to their Cal.com profile for availability
                    </td>
                  </tr>
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      Google Calendar ID
                    </td>
                    <td className="py-2">Used for RSVP polling</td>
                  </tr>
                  <tr className="transition-colors hover:bg-muted/50">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      Salesforce Owner ID
                    </td>
                    <td className="py-2">
                      Links meetings to SFDC opportunities
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-muted-foreground">
              People must be added here before they can be assigned to events or
              added as participants.
            </p>
          </Section>

          <Section icon={Target} title="Goals">
            <p>
              Track measurable targets for your events. Three goal types:
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                {
                  label: "Meeting Quota",
                  desc: "Number of meetings booked",
                },
                {
                  label: "Pipeline Target",
                  desc: "Dollar value of pipeline influenced",
                },
                {
                  label: "Account Coverage",
                  desc: "Number of target accounts met with",
                },
              ].map((type) => (
                <div
                  key={type.label}
                  className="rounded-md border p-3 text-center transition-all duration-200 hover:bg-muted/50 hover:border-primary/20"
                >
                  <p className="text-xs font-semibold">{type.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {type.desc}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3">
              Each goal has a target value, a period
              (weekly/monthly/quarterly/yearly), and an optional{" "}
              <strong>segment breakdown</strong> to track coverage across
              Commercial, SMB, Startups, and Majors.
            </p>
            <p className="mt-1 text-muted-foreground">
              Goals appear on the Dashboard with progress bars and on the
              Leaderboard ranked by completion %.
            </p>
          </Section>

          <Section icon={Trophy} title="Leaderboard">
            <p>Performance rankings across three tabs:</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                {
                  icon: Users,
                  label: "Most Meetings",
                  desc: "Confirmed meetings per person",
                },
                {
                  icon: DollarSign,
                  label: "Pipeline Generated",
                  desc: "Total $ of linked opportunities",
                },
                {
                  icon: Target,
                  label: "Goal Completion",
                  desc: "Average completion %",
                },
              ].map((tab) => (
                <div
                  key={tab.label}
                  className="rounded-md border p-3 text-center transition-all duration-200 hover:bg-muted/50 hover:border-primary/20"
                >
                  <tab.icon className="mx-auto size-4 text-muted-foreground" />
                  <p className="mt-1 text-xs font-semibold">{tab.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tab.desc}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-muted-foreground">
              Top three get gold, silver, and bronze badges. Use the event filter
              to scope rankings.
            </p>
          </Section>

          <Section icon={MessageSquare} title="AI Scheduling Assistant">
            <p>
              The chat widget in the bottom-right corner can help with
              scheduling. Try asking:
            </p>
            <div className="mt-2 space-y-2">
              {[
                "When is Lisa Chen available next Tuesday?",
                "Find a 60-minute slot for the Acme Corp meeting in Room A",
                "What meetings do I have at Dreamforce?",
              ].map((q) => (
                <div
                  key={q}
                  className="rounded-md bg-muted px-3 py-2 text-xs italic text-muted-foreground transition-colors duration-200 hover:bg-muted/80"
                >
                  &ldquo;{q}&rdquo;
                </div>
              ))}
            </div>
            <p className="mt-3 text-muted-foreground">
              The assistant has access to event data, room availability, and
              people information.
            </p>
          </Section>
        </div>
      </div>

      <Separator />

      {/* ── Roles ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <FadeIn>
          <div className="flex items-center gap-2">
            <UserCheck className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Roles</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Different roles have different primary workflows.
          </p>
        </FadeIn>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Target,
              title: "Marketing",
              subtitle: "Event Owner",
              color: "blue",
              steps: [
                "Create events, add rooms, assign execs, set goals.",
                "Review and approve/reject meeting requests.",
                "Use the grid to book or adjust meetings.",
                "Monitor dashboard and leaderboard.",
                "Use silent updates to fix issues quietly.",
              ],
            },
            {
              icon: DollarSign,
              title: "Account Executive",
              subtitle: "Booking Meetings",
              color: "emerald",
              steps: [
                "Submit meeting requests or ask the event owner.",
                <>Check <strong>My Meetings</strong> for your schedule.</>,
                <>Fill in <strong>Prep Notes</strong> before each meeting.</>,
                "Export schedule to CSV for offline use.",
                "Check the Leaderboard to see how you stack up.",
              ],
            },
            {
              icon: Users,
              title: "Executive",
              subtitle: "Taking Meetings",
              color: "violet",
              steps: [
                <>Check <strong>My Meetings</strong> for your calendar.</>,
                "Review prep notes before each meeting.",
                "Accept or decline invites from Google Calendar.",
              ],
            },
          ].map((role, i) => {
            const bgClass =
              role.color === "blue"
                ? "bg-blue-100 dark:bg-blue-950"
                : role.color === "emerald"
                  ? "bg-emerald-100 dark:bg-emerald-950"
                  : "bg-violet-100 dark:bg-violet-950";
            const iconClass =
              role.color === "blue"
                ? "text-blue-600 dark:text-blue-400"
                : role.color === "emerald"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-violet-600 dark:text-violet-400";
            return (
              <FadeIn key={role.title} delay={i * 100}>
                <Card className="h-full transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex size-8 items-center justify-center rounded-full ${bgClass}`}
                      >
                        <role.icon className={`size-4 ${iconClass}`} />
                      </div>
                      <CardTitle className="text-sm">{role.title}</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      {role.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs leading-relaxed">
                    <ol className="list-decimal space-y-1 pl-3.5">
                      {role.steps.map((step, j) => (
                        <li key={j}>{step}</li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <FadeIn>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" />
            <h2 className="text-lg font-bold">FAQ</h2>
          </div>

          <Card className="transition-shadow duration-300 hover:shadow-md">
            <CardContent className="py-2">
              <FaqItem question="How do calendar invites get sent?">
                When a meeting is booked, the app creates a booking through
                Cal.com, which sends calendar invites via Google Calendar. The
                external attendee receives an invite with meeting details, and
                internal participants are added to the event.
              </FaqItem>
              <FaqItem question="What happens when someone declines a meeting?">
                The app polls Google Calendar every 5 minutes for RSVP updates.
                When a decline is detected, the RSVP status updates
                automatically on the grid and dashboard.
              </FaqItem>
              <FaqItem question="Can I move a meeting to a different room or time?">
                Yes. Click the meeting on the grid, then click Edit. You can
                change the room, time, or attendees. Use{" "}
                <strong>Silent Update</strong> if you don&apos;t want the
                attendee to get a change notification.
              </FaqItem>
              <FaqItem question="How does pipeline tracking work?">
                The app syncs opportunities from Salesforce every 2 hours. When a
                meeting is linked to a Salesforce Opportunity ID, that
                opportunity&apos;s dollar amount counts toward your Pipeline
                Influenced metric.
              </FaqItem>
              <FaqItem question="What are segments?">
                Segments categorize meetings by customer type (Commercial, SMB,
                Startups, Majors). Set up goals with segment breakdowns to track
                balanced coverage across your business.
              </FaqItem>
              <FaqItem question="How do Slack reminders work?">
                Three days before each meeting, the app sends a Slack DM to the
                assigned AE reminding them to fill in prep notes. This runs
                automatically.
              </FaqItem>
              <FaqItem question="How does Cal.com integration work?">
                Cal.com is set up automatically when you create an event — you
                choose a meeting duration and the app handles the rest. Cal.com
                powers availability checking and sends calendar invites when
                meetings are booked.
              </FaqItem>
              <FaqItem question="Who can see what?">
                All logged-in users can see all events, meetings, and data. The
                app is scoped to your team — anyone with access can
                view and edit.
              </FaqItem>
            </CardContent>
          </Card>
        </div>
      </FadeIn>
    </div>
  );
}
