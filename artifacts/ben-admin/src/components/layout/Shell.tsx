import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import type { AuthUser } from "@workspace/replit-auth-web";

interface ShellProps {
  children: ReactNode;
  user: AuthUser | null;
  logout: () => void;
}

export function Shell({ children, user, logout }: ShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
      <Sidebar user={user} logout={logout} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Subtle top gradient for visual depth */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none z-0" />
        
        <div className="flex-1 overflow-y-auto z-10 p-6 md:p-8 lg:p-10">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
