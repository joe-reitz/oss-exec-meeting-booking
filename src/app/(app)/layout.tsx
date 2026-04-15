import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SchedulingChat } from "@/components/chat/scheduling-chat";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col pl-16 lg:pl-64">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* AI Scheduling Chat Widget */}
      <SchedulingChat />
    </div>
  );
}
