import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { ChatSidebar } from "../ChatSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MessageSquare, Menu } from "lucide-react";
import type { AuthUser } from "@workspace/replit-auth-web";

interface ShellProps {
  children: ReactNode;
  user: AuthUser | null;
  logout: () => void;
  tabData?: unknown;
}

export function Shell({ children, user, logout, tabData }: ShellProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [location] = useLocation();

  const tabName = location.replace("/", "") || "overview";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar user={user} logout={logout} />
      </div>

      {/* Mobile sidebar — sheet drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r border-sidebar-border [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar user={user} logout={logout} onNavClick={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Subtle top gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none z-0" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 md:px-8 lg:px-10 pt-4 pb-0">
          {/* Hamburger — mobile only */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden -ml-1 h-8 w-8 p-0"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>

          {/* Spacer on desktop so chat button stays right-aligned */}
          <div className="hidden md:block" />

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

        <div className="flex-1 overflow-y-auto z-10 p-4 md:p-8 lg:p-10 pt-4">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>

        {/* Chat panel — floats over content, does not shift layout */}
        {chatOpen && (
          <div className="absolute top-0 right-0 bottom-0 w-[320px] md:w-[360px] flex flex-col overflow-hidden z-20 border-l border-border bg-background/95 backdrop-blur-sm shadow-2xl">
            <ChatSidebar
              tab={tabName}
              tabData={tabData}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
