import React, { useState } from "react";
import { 
  UserPlus, 
  MapPin, 
  Clock, 
  ArrowUpCircle,
  Activity,
  Filter,
  Users,
  DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const PRODUCTS = [
  { id: "permitradar", name: "PermitRadar", users: 34, paying: 12, pending: 4, mrr: 1080, newThisWeek: 3, color: "#6366f1" },
  { id: "revoo",       name: "Re-Voo",       users: 18, paying: 7,  pending: 2, mrr: 490,  newThisWeek: 1, color: "#10b981" },
  { id: "leadpulse",  name: "LeadPulse",   users: 9,  paying: 2,  pending: 1, mrr: 120,  newThisWeek: 0, color: "#f59e0b" },
  { id: "answerdine", name: "AnswerDine",   users: 5,  paying: 1,  pending: 0, mrr: 59,   newThisWeek: 0, color: "#ec4899" },
];

const EVENTS = [
  { id: 1, type: "signup",   product: "PermitRadar", user: "Mateo García",   time: "10:30 AM", date: "Today" },
  { id: 2, type: "city_req", product: "PermitRadar", city: "Austin, TX",     time: "09:15 AM", date: "Today" },
  { id: 3, type: "waitlist", product: "Re-Voo",      user: "Lucas Oliveira", time: "08:45 AM", date: "Today" },
  { id: 4, type: "upgrade",  product: "Re-Voo",      user: "Sara Kim",       time: "04:20 PM", date: "Yesterday" },
  { id: 5, type: "signup",   product: "LeadPulse",   user: "James Wright",   time: "11:05 AM", date: "Yesterday" },
  { id: 6, type: "city_req", product: "PermitRadar", city: "Denver, CO",     time: "02:30 PM", date: "Mar 27" },
  { id: 7, type: "signup",   product: "PermitRadar", user: "Aisha Johnson",  time: "09:00 AM", date: "Mar 27" },
];

const getEventIcon = (type: string, color: string) => {
  switch (type) {
    case "signup": return <UserPlus size={16} color={color} />;
    case "city_req": return <MapPin size={16} color={color} />;
    case "waitlist": return <Clock size={16} color={color} />;
    case "upgrade": return <ArrowUpCircle size={16} color={color} />;
    default: return <Activity size={16} color={color} />;
  }
};

const getEventText = (event: typeof EVENTS[0]) => {
  switch (event.type) {
    case "signup": return <span><span className="text-white font-medium">{event.user}</span> signed up</span>;
    case "city_req": return <span>New city request for <span className="text-white font-medium">{event.city}</span></span>;
    case "waitlist": return <span><span className="text-white font-medium">{event.user}</span> joined the waitlist</span>;
    case "upgrade": return <span><span className="text-white font-medium">{event.user}</span> upgraded their plan</span>;
    default: return <span>New activity recorded</span>;
  }
};

export default function ActivityFeed() {
  const [filter, setFilter] = useState<string>("all");

  const filteredEvents = filter === "all" 
    ? EVENTS 
    : EVENTS.filter(e => e.product.toLowerCase().replace("-", "") === filter.toLowerCase().replace("-", ""));

  const groupedEvents = filteredEvents.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, typeof EVENTS>);

  const totalMRR = PRODUCTS.reduce((sum, p) => sum + p.mrr, 0);
  const totalUsers = PRODUCTS.reduce((sum, p) => sum + p.users, 0);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2a2a2a] pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolio Activity</h1>
            <p className="text-[#888] mt-1">Real-time event feed across all products.</p>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
            <Filter size={14} className="text-[#888] mr-2" />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilter("all")}
              className={`rounded-full border-[#2a2a2a] bg-transparent hover:bg-[#1a1a1a] ${filter === "all" ? "bg-[#2a2a2a] text-white" : "text-[#888]"}`}
            >
              All
            </Button>
            {PRODUCTS.map(p => (
              <Button 
                key={p.id}
                variant="outline" 
                size="sm"
                onClick={() => setFilter(p.id)}
                className={`rounded-full border-[#2a2a2a] bg-transparent hover:bg-[#1a1a1a] transition-colors`}
                style={{ 
                  color: filter === p.id ? '#fff' : '#888',
                  backgroundColor: filter === p.id ? `${p.color}20` : 'transparent',
                  borderColor: filter === p.id ? p.color : '#2a2a2a'
                }}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-2" 
                  style={{ backgroundColor: p.color }} 
                />
                {p.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Feed (approx 60%) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {Object.keys(groupedEvents).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-[#2a2a2a] border-dashed rounded-xl bg-[#1a1a1a] text-[#888]">
                <Activity size={32} className="mb-4 opacity-50" />
                <p>No activity found for this filter.</p>
              </div>
            ) : (
              Object.entries(groupedEvents).map(([date, events]) => (
                <div key={date} className="space-y-4">
                  <h3 className="text-sm font-semibold tracking-wider text-[#888] uppercase border-b border-[#2a2a2a] pb-2">
                    {date}
                  </h3>
                  <div className="space-y-3">
                    {events.map(event => {
                      const product = PRODUCTS.find(p => p.name === event.product);
                      const color = product?.color || "#fff";
                      
                      return (
                        <div 
                          key={event.id} 
                          className="group flex items-start gap-4 p-4 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all"
                        >
                          <div 
                            className="mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#2a2a2a]"
                            style={{ backgroundColor: `${color}15` }}
                          >
                            {getEventIcon(event.type, color)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#888] leading-relaxed">
                              {getEventText(event)}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <Badge 
                                variant="outline" 
                                className="text-xs font-normal border-none px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: `${color}15`, color: color }}
                              >
                                {event.product}
                              </Badge>
                              <span className="text-xs text-[#555] flex items-center gap-1">
                                <Clock size={10} />
                                {event.time}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Column: Health Sidebar (approx 40%) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader className="pb-4 border-b border-[#2a2a2a]">
                <CardTitle className="text-sm font-medium text-[#888] flex items-center gap-2">
                  <Activity size={16} />
                  Portfolio Health
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-[#888] text-xs uppercase tracking-wider mb-1">Total MRR</p>
                    <p className="text-2xl font-mono text-white">${totalMRR.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[#888] text-xs uppercase tracking-wider mb-1">Total Users</p>
                    <p className="text-2xl font-mono text-white">{totalUsers}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {PRODUCTS.map(p => (
                    <div 
                      key={p.id} 
                      className="p-4 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] flex flex-col gap-3 transition-opacity"
                      style={{ opacity: filter === "all" || filter === p.id ? 1 : 0.4 }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="font-medium text-white">{p.name}</span>
                        </div>
                        {p.newThisWeek > 0 && (
                          <Badge className="bg-[#1a1a1a] text-xs hover:bg-[#1a1a1a]" style={{ color: p.color }}>
                            +{p.newThisWeek} new
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-[#888]">
                          <Users size={14} />
                          <span>{p.users} users</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#888]">
                          <DollarSign size={14} />
                          <span className="font-mono">${p.mrr}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
