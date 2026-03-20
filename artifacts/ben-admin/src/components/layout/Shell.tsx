import { ReactNode, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { ChatSidebar } from "../ChatSidebar";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import type { AuthUser } from "@workspace/replit-auth-web";

interface ShellProps {
  children: ReactNode;
  user: AuthUser | null;
  logout: () => void;
  tabData?: unknown;
}

export function Shell({ children, user, logout, tabData }: ShellProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [location] = useLocation();

  // Derive tab name from current route
  const tabName = location.replace("/", "") || "overview";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
      <Sidebar user={user} logout={logout} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Subtle top gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none z-0" />

        {/* Top bar with chat toggle */}
        <div className="relative z-10 flex items-center justify-end px-6 md:px-8 lg:px-10 pt-4 pb-0">
          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setChatOpen((o) => !o)}
            className="gap-2 text-xs"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {chatOpen ? "Close Chat" : "Ask Kowalski"}
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto z-10 p-6 md:p-8 lg:p-10 pt-4">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </div>

          {chatOpen && (
            <div className="w-[360px] shrink-0 flex flex-col overflow-hidden z-10">
              <ChatSidebar
                tab={tabName}
                tabData={tabData}
                onClose={() => setChatOpen(false)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
