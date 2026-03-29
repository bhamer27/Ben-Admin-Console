import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, AlertCircle, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Activity } from 'lucide-react';

const STATS = {
  balance: 231.69,
  portfolioValue: 484.94,
  totalInvested: 253.25,
  unrealizedPnl: 47.44,
  openPositions: 13,
  cashPct: 43,
  investedPct: 57,
};

const POSITIONS = [
  { ticker: "KXDJTVOSTARIFFS", title: "Trump tariffs above 15%?", side: "no" as const, contracts: 200, invested: 82.00, currentValue: 96.00, pnl: 14.00, bid: 0.47, ask: 0.49, closeTime: "Jun 30, 2026" },
  { ticker: "KXCABLEAVE-FEB",  title: "EUR/USD above 1.08?",       side: "no" as const, contracts: 100, invested: 26.00, currentValue: 34.00, pnl: 8.00,  bid: 0.33, ask: 0.35, closeTime: "Apr 15, 2026" },
  { ticker: "KXCPI-MAY",       title: "CPI under 3% in May?",      side: "no" as const, contracts: 50,  invested: 15.00, currentValue: 18.50, pnl: 3.50,  bid: 0.35, ask: 0.38, closeTime: "May 15, 2026" },
  { ticker: "KXINX-25DEC31",   title: "S&P 500 above 5500?",       side: "yes" as const, contracts: 20, invested: 9.00,  currentValue: 11.80, pnl: 2.80,  bid: 0.58, ask: 0.61, closeTime: "Dec 31, 2025" },
  { ticker: "KXGDP-Q1",        title: "Q1 GDP growth above 2%?",   side: "yes" as const, contracts: 30, invested: 6.30,  currentValue: 9.30,  pnl: 3.00,  bid: 0.30, ask: 0.32, closeTime: "Apr 30, 2026" },
  { ticker: "KXBTC-25DEC31",   title: "BTC above $60K at year-end?",side: "yes" as const,contracts: 15, invested: 4.35,  currentValue: 7.50,  pnl: 3.15,  bid: 0.47, ask: 0.52, closeTime: "Dec 31, 2025" },
  { ticker: "KXFED-MAY",       title: "Fed rate cut in May?",       side: "yes" as const, contracts: 40, invested: 12.00, currentValue: 10.40, pnl: -1.60, bid: 0.25, ask: 0.27, closeTime: "May 7, 2026" },
  { ticker: "KXOIL-APR",       title: "Oil above $80 in April?",    side: "no" as const, contracts: 60, invested: 22.20, currentValue: 18.60, pnl: -3.60, bid: 0.30, ask: 0.32, closeTime: "Apr 30, 2026" },
  { ticker: "KXGOLD-JUN",      title: "Gold above $2200 in June?",  side: "yes" as const, contracts: 25, invested: 17.50, currentValue: 19.75, pnl: 2.25,  bid: 0.77, ask: 0.79, closeTime: "Jun 28, 2026" },
  { ticker: "KXUNRATE-MAY",    title: "Unemployment below 4%?",     side: "yes" as const, contracts: 80, invested: 36.00, currentValue: 40.00, pnl: 4.00,  bid: 0.49, ask: 0.51, closeTime: "May 2, 2026" },
  { ticker: "KXSPY-MAY",       title: "SPY above 550 in May?",      side: "yes" as const, contracts: 45, invested: 15.75, currentValue: 17.55, pnl: 1.80,  bid: 0.38, ask: 0.40, closeTime: "May 30, 2026" },
  { ticker: "KXETH-JUN",       title: "ETH above $3000 in June?",   side: "no" as const, contracts: 90, invested: 6.30,  currentValue: 5.40,  pnl: -0.90, bid: 0.06, ask: 0.07, closeTime: "Jun 30, 2026" },
  { ticker: "KXINFLATION-Q2",  title: "Inflation stays above 2.5%?",side: "yes" as const, contracts: 55, invested: 0.55,  currentValue: 0.66,  pnl: 0.11,  bid: 0.01, ask: 0.02, closeTime: "Jul 15, 2026" },
];

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

// Mocking "today" as Dec 25, 2025 so Dec 31 positions are "Expiring Soon"
const TODAY = new Date("Dec 25, 2025");

const getDaysUntil = (dateStr: string) => {
  const diffTime = Math.abs(new Date(dateStr).getTime() - TODAY.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Group positions manually for the design
const GROUPS = [
  {
    id: 'soon',
    title: 'Expiring Soon (< 7 days)',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
    positions: POSITIONS.filter(p => p.closeTime.includes('Dec 31, 2025'))
  },
  {
    id: 'apr2026',
    title: 'April 2026',
    color: 'text-zinc-100',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-800',
    icon: <Clock className="w-4 h-4 text-zinc-400" />,
    positions: POSITIONS.filter(p => p.closeTime.includes('Apr '))
  },
  {
    id: 'may2026',
    title: 'May 2026',
    color: 'text-zinc-100',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-800',
    icon: <Clock className="w-4 h-4 text-zinc-400" />,
    positions: POSITIONS.filter(p => p.closeTime.includes('May '))
  },
  {
    id: 'jun2026',
    title: 'June 2026',
    color: 'text-zinc-100',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-800',
    icon: <Clock className="w-4 h-4 text-zinc-400" />,
    positions: POSITIONS.filter(p => p.closeTime.includes('Jun '))
  },
  {
    id: 'jul2026',
    title: 'July 2026',
    color: 'text-zinc-100',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-800',
    icon: <Clock className="w-4 h-4 text-zinc-400" />,
    positions: POSITIONS.filter(p => p.closeTime.includes('Jul '))
  }
].map(group => {
  const totalInvested = group.positions.reduce((sum, p) => sum + p.invested, 0);
  const totalValue = group.positions.reduce((sum, p) => sum + p.currentValue, 0);
  return { ...group, totalInvested, totalValue };
});

export default function ExpiryCalendar() {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'soon': true,
    'apr2026': true,
    'may2026': false,
    'jun2026': false,
    'jul2026': false,
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 font-sans p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Header & Stats */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Market
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium mb-2">
                <Wallet className="w-4 h-4" />
                Available Cash
              </div>
              <div className="text-2xl font-semibold">{formatCurrency(STATS.balance)}</div>
            </div>
            
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium mb-2">
                <Activity className="w-4 h-4" />
                Total Invested
              </div>
              <div className="text-2xl font-semibold">{formatCurrency(STATS.totalInvested)}</div>
            </div>
            
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <TrendingUp className="w-16 h-16 text-emerald-500" />
              </div>
              <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium mb-2 relative z-10">
                <TrendingUp className="w-4 h-4" />
                Unrealized P&L
              </div>
              <div className="text-2xl font-semibold text-emerald-500 relative z-10">
                +{formatCurrency(STATS.unrealizedPnl)}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline View */}
        <div className="space-y-4 relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-zinc-800 rounded-full z-0"></div>

          {GROUPS.map((group) => {
            const isExpanded = expandedGroups[group.id];
            const pnl = group.totalValue - group.totalInvested;
            const isPositive = pnl >= 0;
            
            return (
              <div key={group.id} className="relative z-10">
                {/* Section Header */}
                <button 
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${group.bgColor} ${group.borderColor} hover:bg-opacity-80`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-[#0f0f0f] border ${group.borderColor}`}>
                      {group.icon}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className={`font-semibold ${group.color}`}>{group.title}</span>
                      <span className="text-xs text-zinc-400 mt-0.5">
                        {group.positions.length} position{group.positions.length !== 1 ? 's' : ''} · {formatCurrency(group.totalInvested)} at stake
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-medium text-zinc-200">
                        Exp. {formatCurrency(group.totalValue)}
                      </div>
                      <div className={`text-xs font-medium ${isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(pnl)}
                      </div>
                    </div>
                    <div className="text-zinc-500">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                  </div>
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="pl-14 pr-2 py-4 space-y-3">
                    {group.positions.map((pos, idx) => {
                      const posIsPositive = pos.pnl >= 0;
                      return (
                        <div key={idx} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-zinc-700 transition-colors group">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            
                            {/* Left Side: Title & Badge */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  pos.side === 'yes' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {pos.side}
                                </span>
                                <span className="text-xs text-zinc-500 font-mono bg-zinc-900 px-1.5 rounded">
                                  {pos.ticker}
                                </span>
                                <div className="text-xs text-zinc-500 flex items-center gap-1.5 ml-auto sm:ml-0">
                                  <Clock className="w-3.5 h-3.5" />
                                  {getDaysUntil(pos.closeTime)} days left
                                </div>
                              </div>
                              <h3 className="font-medium text-zinc-100 line-clamp-1">{pos.title}</h3>
                            </div>

                            {/* Right Side: Stats */}
                            <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8">
                              <div className="text-left sm:text-right">
                                <div className="text-[10px] text-zinc-500 font-medium uppercase mb-0.5">Contracts</div>
                                <div className="text-sm font-mono text-zinc-300">{pos.contracts}</div>
                              </div>
                              
                              <div className="text-left sm:text-right">
                                <div className="text-[10px] text-zinc-500 font-medium uppercase mb-0.5">Current Value</div>
                                <div className="text-sm font-mono text-zinc-100">{formatCurrency(pos.currentValue)}</div>
                              </div>

                              <div className="text-right min-w-[70px]">
                                <div className="text-[10px] text-zinc-500 font-medium uppercase mb-0.5">P&L</div>
                                <div className={`text-sm font-mono font-medium flex items-center justify-end gap-1 ${posIsPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                                  {posIsPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                  {posIsPositive ? '+' : ''}{formatCurrency(pos.pnl)}
                                </div>
                              </div>
                            </div>
                            
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Sticky Footer Portfolio Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-[#2a2a2a] p-4 z-50">
        <div className="max-w-4xl mx-auto flex items-center gap-6">
          <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${STATS.investedPct}%` }}></div>
            <div className="bg-zinc-600 h-full" style={{ width: `${STATS.cashPct}%` }}></div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-zinc-400">Invested {STATS.investedPct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
              <span className="text-zinc-400">Cash {STATS.cashPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
