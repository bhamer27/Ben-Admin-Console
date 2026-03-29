import React, { useState } from "react";
import { Users, CreditCard, TrendingUp, Search, Filter, MoreHorizontal, ChevronRight, MapPin, Clock, ArrowUpRight } from "lucide-react";

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

function StatChip({ label, value, icon: Icon, color }: { label: string, value: React.ReactNode, icon: React.ElementType, color?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
      <div className="p-1.5 rounded-md" style={{ backgroundColor: color ? `${color}15` : '#333', color: color || '#888' }}>
        <Icon size={16} />
      </div>
      <div>
        <div className="text-xs text-[#888]">{label}</div>
        <div className="text-sm font-medium text-white">{value}</div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function SplitNavigator() {
  const [selectedProductId, setSelectedProductId] = useState(PRODUCTS[0].id);
  const selectedProduct = PRODUCTS.find(p => p.id === selectedProductId)!;
  
  const productUsers = USERS.filter(u => u.product === selectedProductId);

  return (
    <div className="flex h-screen w-full bg-[#0f0f0f] text-white font-sans overflow-hidden">
      
      {/* Left Rail (Navigator) */}
      <div className="w-[240px] flex-shrink-0 border-r border-[#2a2a2a] bg-[#111] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold tracking-wide text-[#888] uppercase">Products</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {PRODUCTS.map(product => {
            const isSelected = selectedProductId === product.id;
            return (
              <button
                key={product.id}
                onClick={() => setSelectedProductId(product.id)}
                className={`w-full text-left px-3 py-3 rounded-md transition-all duration-200 flex flex-col gap-2 ${
                  isSelected 
                    ? 'shadow-sm' 
                    : 'hover:bg-[#1a1a1a]'
                }`}
                style={{
                  backgroundColor: isSelected ? `${product.color}15` : 'transparent',
                  borderLeft: `2px solid ${isSelected ? product.color : 'transparent'}`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: product.color }} />
                    <span className={`font-medium ${isSelected ? 'text-white' : 'text-[#ccc]'}`}>
                      {product.name}
                    </span>
                  </div>
                  {isSelected && <ChevronRight size={14} style={{ color: product.color }} />}
                </div>
                
                <div className="flex items-center justify-between text-xs px-4">
                  <span className="text-[#888]">{product.users} users</span>
                  <span className="font-medium" style={{ color: isSelected ? product.color : '#888' }}>
                    ${product.mrr}
                  </span>
                </div>
                
                {/* Micro Sparkline / Paying % Bar */}
                <div className="px-4">
                  <div className="h-1 w-full bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${(product.paying / product.users) * 100}%`,
                        backgroundColor: product.color,
                        opacity: isSelected ? 1 : 0.5
                      }} 
                    />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        
        <div className="p-4 border-t border-[#2a2a2a] mt-auto">
          <button className="flex items-center gap-2 text-sm text-[#888] hover:text-white transition-colors">
            <div className="w-5 h-5 rounded border border-[#2a2a2a] flex items-center justify-center bg-[#1a1a1a]">
              +
            </div>
            New Product
          </button>
        </div>
      </div>
      
      {/* Right Panel (Content) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="px-8 py-6 border-b border-[#2a2a2a] flex flex-col gap-6 flex-shrink-0 bg-[#0f0f0f]/80 backdrop-blur-md z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${selectedProduct.color}20`, color: selectedProduct.color }}>
                <Users size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">
                  {selectedProduct.name}
                </h1>
                <p className="text-sm text-[#888]">
                  Managing {selectedProduct.users} users across all plans
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="px-3 py-1.5 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-md text-white hover:bg-[#222] transition-colors flex items-center gap-2">
                <Filter size={14} /> Filter
              </button>
              <button 
                className="px-3 py-1.5 text-sm rounded-md text-white transition-colors flex items-center gap-2 font-medium shadow-sm"
                style={{ backgroundColor: selectedProduct.color }}
              >
                View Live App <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
          
          {/* Stat Chips */}
          <div className="flex gap-4">
            <StatChip 
              label="Total Users" 
              value={selectedProduct.users.toLocaleString()} 
              icon={Users} 
            />
            <StatChip 
              label="Paying Subscribers" 
              value={
                <div className="flex items-center gap-2">
                  {selectedProduct.paying} 
                  <span className="text-xs text-[#888] font-normal">
                    ({Math.round((selectedProduct.paying/selectedProduct.users)*100)}%)
                  </span>
                </div>
              } 
              icon={CreditCard} 
              color={selectedProduct.color}
            />
            <StatChip 
              label="Monthly Recurring" 
              value={`$${selectedProduct.mrr.toLocaleString()}`} 
              icon={TrendingUp} 
              color="#10b981"
            />
          </div>
        </header>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Users Table */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Recent Users</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" size={14} />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#444] w-64"
                />
              </div>
            </div>
            
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a] bg-[#151515] text-[#888]">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium">Last Active</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {productUsers.length > 0 ? (
                    productUsers.map(user => (
                      <tr key={user.id} className="hover:bg-[#222] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{user.name}</div>
                          <div className="text-xs text-[#888]">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-[#ccc]">{user.plan}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            user.status === 'active' ? 'bg-[#10b981]/10 text-[#10b981]' :
                            user.status === 'trial' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                            'bg-[#888]/10 text-[#888]'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#888]">{user.createdAt}</td>
                        <td className="px-4 py-3 text-[#888]">{user.lastActive}</td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-[#888] hover:text-white p-1 rounded-md hover:bg-[#333] transition-colors">
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#888]">
                        No users found for this product.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Product Specific Sections */}
          {selectedProduct.id === "permitradar" && (
            <section>
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-[#6366f1]" /> 
                City Requests
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CITY_REQUESTS.map((req, i) => (
                  <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex items-start justify-between">
                    <div>
                      <div className="font-medium text-white mb-1">{req.city}</div>
                      <div className="text-xs text-[#888]">Latest: {req.latest}</div>
                    </div>
                    <div className="bg-[#6366f1]/10 text-[#6366f1] px-2.5 py-1 rounded-md text-sm font-semibold">
                      {req.count} req
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedProduct.id === "revoo" && (
            <section>
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Clock size={18} className="text-[#10b981]" /> 
                GMB Waitlist
              </h3>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#2a2a2a] bg-[#151515] text-[#888]">
                      <th className="px-4 py-3 font-medium">Business</th>
                      <th className="px-4 py-3 font-medium">Contact</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {WAITLIST.map((item, i) => (
                      <tr key={i} className="hover:bg-[#222] transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{item.business}</td>
                        <td className="px-4 py-3 text-[#ccc]">{item.contact}</td>
                        <td className="px-4 py-3 text-[#888]">{item.date}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            item.status === 'activated' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#f59e0b]/10 text-[#f59e0b]'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.status === 'pending' && (
                            <button className="text-xs font-medium text-[#10b981] hover:text-white transition-colors">
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        </div>
      </div>
      
    </div>
  );
}
