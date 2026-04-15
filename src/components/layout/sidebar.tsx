"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Inbox,
  Users,
  Target,
  CalendarCheck,
  Trophy,
  HelpCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Requests", href: "/requests", icon: Inbox, showBadge: true },
  { name: "My Meetings", href: "/my-meetings", icon: CalendarCheck },
  { name: "People", href: "/people", icon: Users },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Help", href: "/help", icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch("/api/meeting-requests/count");
      if (!res.ok) return;
      const data = await res.json();
      setPendingCount(data.pending ?? 0);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r bg-sidebar text-sidebar-foreground lg:w-64">
      {/* App title */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <svg className="size-5 shrink-0" viewBox="0 0 76 65" fill="currentColor">
          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
        </svg>
        <span className="hidden text-sm font-semibold lg:inline-block">
          Meeting Booking
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="size-5 shrink-0" />
                  <span className="hidden lg:inline-block">{item.name}</span>
                  {item.showBadge && pendingCount > 0 && (
                    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="lg:hidden">
                {item.name}
                {item.showBadge && pendingCount > 0 && ` (${pendingCount})`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
