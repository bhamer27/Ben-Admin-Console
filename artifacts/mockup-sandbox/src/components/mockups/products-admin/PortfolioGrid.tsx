import React, { useState } from 'react';
import { ChevronDown, Users, DollarSign, Activity, MapPin, Clock, CreditCard, UserPlus } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Mock Data
const PRODUCTS = [
  { id: "permitradar", name: "PermitRadar", users: 34, paying: 12, pending: 4, mrr: 1080, newThisWeek: 3, color: "#6366f1" },
  { id: "revoo",       name: "Re-Voo",       users: 18, paying: 7,  pending: 2, mrr: 490,  newThisWeek: 1, color: "#10b981" },
  { id: "leadpulse",  name: "LeadPulse",   users: 9,  paying: 2,  pending: 1, mrr: 120,  newThisWeek: 0, color: "#f59e0b" },
  { id: "answerdine", name: "AnswerDine",   users: 5,  paying: 1,  pending: 0, mrr: 59,   newThisWeek: 0, color: "#ec4899" },
];

const USERS = [
  { id:1, name:"Mateo García", email:"mateo@example.com", plan:"pro", status:"active", product:"permitradar", createdAt:"2025-12-15", lastActive:"2026-03-28" },
  { id:2, name:"Aisha Johnson", email:"aisha@example.com", plan:"starter", status:"active", product:"permitradar", createdAt:"2026-01-10", lastActive:"2026-03-25" },
  { id:3, name:"Lucas Oliveira", email:"lucas@example.com", plan:"trial", status:"trial", product:"revoo", createdAt:"2026-03-20", lastActive:"2026-03-28" },
  { id:4, name:"Sara Kim", email:"sara@example.com", plan:"monthly", status:"active", product:"revoo", createdAt:"2026-02-05", lastActive:"2026-03-27" },
  { id:5, name:"James Wright", email:"james@example.com", plan:"free", status:"free", product:"leadpulse", createdAt:"2026-03-15", lastActive:"2026-03-22" },
];

const CITY_REQUESTS = [
  { city:"Austin, TX",  count:3, latest:"Mar 28" },
  { city:"Denver, CO",  count:2, latest:"Mar 27" },
  { city:"Phoenix, AZ", count:1, latest:"Mar 25" },
];

const WAITLIST = [
  { business:"Sunrise Café",    contact:"Maria Lopez",  status:"pending",   date:"Mar 28" },
  { business:"Tech Hub Co.",    contact:"Tom Richards", status:"activated", date:"Mar 22" },
  { business:"Green Leaf Yoga", contact:"Priya Nair",   status:"pending",   date:"Mar 18" },
];

export default function PortfolioGrid() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalUsers = PRODUCTS.reduce((acc, p) => acc + p.users, 0);
  const totalMrr = PRODUCTS.reduce((acc, p) => acc + p.mrr, 0);
  const totalPaying = PRODUCTS.reduce((acc, p) => acc + p.paying, 0);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-8 font-sans selection:bg-[#333] selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Strip */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-[#2a2a2a]">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Products</h1>
            <p className="text-[#888] mt-1">Portfolio overview & health</p>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-[#888] uppercase tracking-wider">Total MRR</span>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <span className="text-2xl font-bold">${totalMrr.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-[#2a2a2a]"></div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-[#888] uppercase tracking-wider">Total Users</span>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold">{totalUsers}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-[#2a2a2a]"></div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-[#888] uppercase tracking-wider">Paying</span>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-500" />
                <span className="text-2xl font-bold">{totalPaying}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {PRODUCTS.map((product) => (
            <div key={product.id} className="flex flex-col">
              <button
                onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
                className={cn(
                  "w-full text-left transition-all duration-300 relative rounded-xl overflow-hidden group outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f] focus-visible:ring-white",
                  expandedId === product.id ? "ring-2 ring-[#444]" : "hover:ring-1 hover:ring-[#444]"
                )}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300"
                  style={{ backgroundColor: product.color }}
                />
                
                <Card className="bg-[#1a1a1a] border-[#2a2a2a] rounded-none border-l-0 pl-1.5 h-full transition-colors hover:bg-[#1f1f1f]">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]"
                          style={{ color: product.color, backgroundColor: product.color }}
                        />
                        <h2 className="text-xl font-semibold text-white">{product.name}</h2>
                      </div>
                      <ChevronDown 
                        className={cn(
                          "w-5 h-5 text-[#888] transition-transform duration-300",
                          expandedId === product.id && "rotate-180 text-white"
                        )} 
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-[#888] font-medium mb-1">Users</span>
                        <span className="text-2xl font-bold text-white">{product.users}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-[#888] font-medium mb-1">MRR</span>
                        <span className="text-2xl font-bold text-white">${product.mrr}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-[#888] font-medium mb-1">Paying</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-white">{product.paying}</span>
                          <span className="text-xs text-[#888]">({Math.round((product.paying/product.users)*100)}%)</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-between items-center pt-4 border-t border-[#2a2a2a]/50">
                      <Badge variant="outline" className="bg-[#222] border-[#333] text-[#aaa] font-normal px-2.5">
                        {product.pending} pending
                      </Badge>
                      {product.newThisWeek > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+{product.newThisWeek} this week</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-[#666]">
                          <span>0 new this week</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            </div>
          ))}
        </div>

        {/* Expanded Panel Details below the grid */}
        <div 
          className={cn(
            "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
            expandedId ? "max-h-[1000px] opacity-100 mt-8" : "max-h-0 opacity-0 mt-0"
          )}
        >
          {expandedId && (
            <Card className="bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl overflow-hidden rounded-xl">
              <div className="flex">
                {/* Left Colored Accent */}
                <div 
                  className="w-1.5" 
                  style={{ backgroundColor: PRODUCTS.find(p => p.id === expandedId)?.color }}
                />
                
                <CardContent className="flex-1 p-6 md:p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-[4px]"
                        style={{ backgroundColor: PRODUCTS.find(p => p.id === expandedId)?.color }}
                      />
                      {PRODUCTS.find(p => p.id === expandedId)?.name} Deep Dive
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Users Table */}
                    <div className="lg:col-span-2 space-y-4">
                      <h4 className="text-sm font-medium text-[#888] uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4" /> Recent Users
                      </h4>
                      <div className="rounded-lg border border-[#2a2a2a] overflow-hidden bg-[#111]">
                        <Table>
                          <TableHeader className="bg-[#1a1a1a]">
                            <TableRow className="border-[#2a2a2a] hover:bg-transparent">
                              <TableHead className="text-[#888]">User</TableHead>
                              <TableHead className="text-[#888]">Plan</TableHead>
                              <TableHead className="text-[#888]">Status</TableHead>
                              <TableHead className="text-right text-[#888]">Last Active</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {USERS.filter(u => u.product === expandedId).length > 0 ? (
                              USERS.filter(u => u.product === expandedId).map(user => (
                                <TableRow key={user.id} className="border-[#2a2a2a] hover:bg-[#1a1a1a] transition-colors">
                                  <TableCell className="font-medium text-white">
                                    {user.name}
                                    <div className="text-xs text-[#666] font-normal">{user.email}</div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="bg-[#222] border-[#333] text-[#ddd] capitalize font-medium">
                                      {user.plan}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        user.status === 'active' ? 'bg-emerald-500' :
                                        user.status === 'trial' ? 'bg-amber-500' : 'bg-[#666]'
                                      )} />
                                      <span className="capitalize text-[#aaa] font-medium">{user.status}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-[#888] font-medium">{user.lastActive}</TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-[#666]">
                                  No users found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Extra Data Section */}
                    <div className="space-y-4">
                      {expandedId === 'permitradar' && (
                        <>
                          <h4 className="text-sm font-medium text-[#888] uppercase tracking-wider flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> City Requests
                          </h4>
                          <div className="space-y-3">
                            {CITY_REQUESTS.map((req, i) => (
                              <div key={i} className="flex items-center justify-between p-3.5 rounded-lg bg-[#111] border border-[#2a2a2a] hover:border-[#333] transition-colors">
                                <div>
                                  <div className="font-medium text-white">{req.city}</div>
                                  <div className="text-xs text-[#666] mt-0.5">Latest: {req.latest}</div>
                                </div>
                                <Badge className="bg-[#222] text-[#aaa] hover:bg-[#333] border-none font-medium text-sm">
                                  {req.count}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {expandedId === 'revoo' && (
                        <>
                          <h4 className="text-sm font-medium text-[#888] uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-4 h-4" /> GMB Waitlist
                          </h4>
                          <div className="space-y-3">
                            {WAITLIST.map((entry, i) => (
                              <div key={i} className="flex flex-col p-3.5 rounded-lg bg-[#111] border border-[#2a2a2a] gap-2 hover:border-[#333] transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-white">{entry.business}</div>
                                  <Badge className={cn(
                                    "border-none capitalize font-medium",
                                    entry.status === 'activated' ? "bg-emerald-500/10 text-emerald-400" : "bg-[#222] text-[#aaa]"
                                  )}>
                                    {entry.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between text-xs text-[#666]">
                                  <span>{entry.contact}</span>
                                  <span>{entry.date}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {(expandedId === 'leadpulse' || expandedId === 'answerdine') && (
                        <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)] min-h-[200px] border border-dashed border-[#2a2a2a] rounded-lg bg-[#111]/30 p-6 text-center">
                          <Activity className="w-8 h-8 text-[#444] mb-3" />
                          <p className="text-[#888] font-medium">Activity Stream</p>
                          <p className="text-sm text-[#666] mt-1">No product-specific logs available yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
