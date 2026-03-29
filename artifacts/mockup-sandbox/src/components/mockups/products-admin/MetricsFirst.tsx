import React, { useState } from "react";
import { ChevronDown, ChevronUp, DollarSign, Users, Activity, TrendingUp, CheckCircle2, Clock } from "lucide-react";

// --- Mock Data ---
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

// --- Sub-components ---

function KPICard({ title, value, subtitle, icon: Icon, trend }: { title: string, value: string | number, subtitle?: string, icon: React.ElementType, trend?: "up" | "down" | "neutral" }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 rounded-xl flex flex-col justify-between hover:border-[#3a3a3a] transition-colors">
      <div className="flex items-center justify-between text-[#888] mb-4">
        <h3 className="text-sm font-medium uppercase tracking-wider">{title}</h3>
        <Icon className="w-5 h-5 text-[#555]" />
      </div>
      <div>
        <div className="text-4xl font-mono text-white tracking-tight">{value}</div>
        {subtitle && (
          <div className={`text-sm mt-2 flex items-center gap-1 ${trend === 'up' ? 'text-emerald-400' : 'text-[#888]'}`}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({ product, isExpanded, onToggle, maxMrr }: { product: typeof PRODUCTS[0], isExpanded: boolean, onToggle: () => void, maxMrr: number }) {
  const mrrWidth = Math.max((product.mrr / maxMrr) * 100, 2);
  const usersForProduct = USERS.filter(u => u.product === product.id);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4 transition-all duration-300">
      <button 
        onClick={onToggle}
        className="w-full text-left p-5 flex flex-col md:flex-row items-start md:items-center gap-6 hover:bg-[#222] transition-colors"
      >
        {/* Identity */}
        <div className="w-full md:w-48 flex-shrink-0 flex items-center gap-4">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: product.color }} />
          <span className="text-lg font-semibold text-white">{product.name}</span>
        </div>

        {/* Metrics Grid */}
        <div className="w-full flex-grow grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          <div className="flex flex-col">
            <span className="text-xs text-[#888] mb-1 uppercase tracking-wider">Users</span>
            <span className="text-xl font-mono text-white">{product.users}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[#888] mb-1 uppercase tracking-wider">Paying</span>
            <span className="text-xl font-mono text-white">{product.paying}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[#888] mb-1 uppercase tracking-wider">New (7d)</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-mono text-white">{product.newThisWeek}</span>
              {product.newThisWeek > 0 && <span className="flex w-2 h-2 rounded-full bg-emerald-500" />}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[#888] mb-1 uppercase tracking-wider">MRR</span>
            <span className="text-xl font-mono" style={{ color: product.color }}>${product.mrr}</span>
          </div>
        </div>

        {/* Visual MRR Bar (Desktop only) */}
        <div className="hidden lg:flex w-48 h-2 bg-[#0f0f0f] rounded-full overflow-hidden items-center">
          <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${mrrWidth}%`, backgroundColor: product.color }} />
        </div>

        {/* Chevron */}
        <div className="text-[#555] ml-auto flex-shrink-0">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-[#2a2a2a] bg-[#141414] p-6 animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="mb-8">
            <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#888]" />
              Recent Users
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-xs uppercase tracking-wider text-[#888]">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Last Active</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {usersForProduct.length > 0 ? (
                    usersForProduct.map(user => (
                      <tr key={user.id} className="border-b border-[#2a2a2a]/50 hover:bg-[#1a1a1a] transition-colors">
                        <td className="py-3">
                          <div className="font-medium text-white">{user.name}</div>
                          <div className="text-[#888] text-xs">{user.email}</div>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-1 rounded-md bg-[#222] text-[#ccc] text-xs capitalize border border-[#333]">
                            {user.plan}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="capitalize text-[#aaa]">{user.status}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right text-[#888]">{user.lastActive}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#555] text-sm">No recent users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Product Specific Data */}
          {product.id === 'permitradar' && (
            <div>
               <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#888]" />
                Top City Requests
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {CITY_REQUESTS.map((req, i) => (
                  <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium mb-1">{req.city}</div>
                      <div className="text-xs text-[#888]">Latest: {req.latest}</div>
                    </div>
                    <div className="bg-[#2a2a2a] text-[#ccc] w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono">
                      {req.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.id === 'revoo' && (
            <div>
               <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#888]" />
                GMB Waitlist
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {WAITLIST.map((item, i) => (
                  <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium mb-1">{item.business}</div>
                      <div className="text-xs text-[#888]">{item.contact} • {item.date}</div>
                    </div>
                    <div>
                      {item.status === 'activated' ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                          <CheckCircle2 className="w-3 h-3" /> Activated
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MetricsFirst() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Calculate aggregates
  const totalMrr = PRODUCTS.reduce((sum, p) => sum + p.mrr, 0);
  const totalUsers = PRODUCTS.reduce((sum, p) => sum + p.users, 0);
  const totalPaying = PRODUCTS.reduce((sum, p) => sum + p.paying, 0);
  const payingRate = Math.round((totalPaying / totalUsers) * 100);
  const totalNew = PRODUCTS.reduce((sum, p) => sum + p.newThisWeek, 0);
  const maxMrr = Math.max(...PRODUCTS.map(p => p.mrr));

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#ccc] p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Portfolio Metrics</h1>
          <p className="text-[#888]">Aggregate performance across all active products.</p>
        </div>

        {/* Hero KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard 
            title="Total MRR" 
            value={`$${totalMrr.toLocaleString()}`} 
            icon={DollarSign} 
            subtitle="+12% from last month"
            trend="up"
          />
          <KPICard 
            title="Total Users" 
            value={totalUsers} 
            icon={Users} 
            subtitle={`${totalPaying} paying users`}
          />
          <KPICard 
            title="Paying Rate" 
            value={`${payingRate}%`} 
            icon={Activity} 
            subtitle="Across all products"
          />
          <KPICard 
            title="New This Week" 
            value={totalNew} 
            icon={TrendingUp} 
            subtitle="Solid growth"
            trend="up"
          />
        </div>

        {/* Product Rows */}
        <div>
          <h2 className="text-lg font-medium text-white mb-4">Product Breakdown</h2>
          <div className="space-y-4">
            {PRODUCTS.map(product => (
              <ProductRow 
                key={product.id} 
                product={product} 
                isExpanded={expandedId === product.id}
                onToggle={() => setExpandedId(expandedId === product.id ? null : product.id)}
                maxMrr={maxMrr}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
