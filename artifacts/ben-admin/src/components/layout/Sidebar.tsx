import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  CreditCard, 
  Megaphone, 
  TrendingUp,
  Cpu,
  LineChart,
  LayoutGrid,
  LogOut,
} from "lucide-react";
import type { AuthUser } from "@workspace/replit-auth-web";

interface SidebarProps {
  user: AuthUser | null;
  logout: () => void;
  onNavClick?: () => void;
}

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/stripe", label: "Stripe Metrics", icon: CreditCard },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/products", label: "Products", icon: LayoutGrid },
  { href: "/kalshi", label: "Kalshi Bot", icon: TrendingUp },
  { href: "/tars", label: "Tars", icon: Cpu },
  { href: "/stocks", label: "Public Portfolio", icon: LineChart },
];

export function Sidebar({ user, logout, onNavClick }: SidebarProps) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col w-64 h-full bg-sidebar border-r border-sidebar-border relative z-10">
      <div className="px-5 py-4 flex items-center gap-2.5">
        <img
          src={`${import.meta.env.BASE_URL}images/logo-nobg.png`}
          alt="BenAdmin"
          className="h-8 w-8 flex-shrink-0 object-contain"
          style={{ filter: "brightness(1.8) contrast(1.1) saturate(0.75)" }}
        />
        <span className="font-semibold text-lg tracking-tight text-sidebar-foreground">BenAdmin</span>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn(
                "h-4 w-4 transition-colors", 
                isActive ? "text-sidebar-foreground" : "text-muted-foreground group-hover:text-sidebar-foreground"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="Avatar" className="h-8 w-8 rounded-full border border-border" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium border border-border">
              {user?.firstName?.[0] || 'B'}
            </div>
          )}
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-sm font-medium truncate text-foreground">{user?.firstName} {user?.lastName}</span>
            <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
          </div>
        </div>
        <button
          onClick={() => { onNavClick?.(); logout(); }}
          className="mt-2 flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
