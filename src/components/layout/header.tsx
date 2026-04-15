"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/events": "Events",
  "/people": "People",
  "/goals": "Goals",
  "/my-meetings": "My Meetings",
  "/requests": "Requests",
  "/leaderboard": "Leaderboard",
  "/help": "Help",
};

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0) {
    const baseRoute = "/" + segments[0];
    if (routeTitles[baseRoute]) return routeTitles[baseRoute];
  }

  return "Dashboard";
}

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += "/" + segment;
    const label =
      routeTitles[currentPath] ||
      segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const pageTitle = getPageTitle(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold leading-none font-[family-name:var(--font-geist-pixel-square)]">
          {pageTitle}
        </h1>
        {breadcrumbs.length > 1 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="size-3" />}
                <span
                  className={
                    index === breadcrumbs.length - 1
                      ? "text-foreground"
                      : undefined
                  }
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-36 p-1">
          <button
            onClick={() => setTheme("light")}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${theme === "light" ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            <Sun className="size-3.5" /> Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${theme === "dark" ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            <Moon className="size-3.5" /> Dark
          </button>
          <button
            onClick={() => setTheme("system")}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${theme === "system" ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            <Monitor className="size-3.5" /> System
          </button>
        </PopoverContent>
      </Popover>
    </header>
  );
}
