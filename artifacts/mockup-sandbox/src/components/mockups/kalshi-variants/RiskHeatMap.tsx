import React, { useState, useMemo } from "react";
import { Info, ChevronDown, ChevronUp, Clock, Target, DollarSign, TrendingUp, TrendingDown, LayoutGrid, List } from "lucide-react";

// --- Mock Data ---
const STATS = {
  balance: 231.69,
  portfolioValue: 484.94,
  totalInvested: 253.25,
  unrealizedPnl: 47.44,
  openPositions: 13,
  cashPct: 43,
  investedPct: 57,
};

type Position = {
  ticker: string;
  title: string;
  side: "yes" | "no";
  contracts: number;
  invested: number;
  currentValue: number;
  pnl: number;
  bid: number;
  ask: number;
  closeTime: string;
};

const POSITIONS: Position[] = [
  { ticker: "KXDJTVOSTARIFFS", title: "Trump tariffs above 15%?", side: "no", contracts: 200, invested: 82.00, currentValue: 96.00, pnl: 14.00, bid: 0.47, ask: 0.49, closeTime: "Jun 30, 2026" },
  { ticker: "KXCABLEAVE-FEB",  title: "EUR/USD above 1.08?",       side: "no", contracts: 100, invested: 26.00, currentValue: 34.00, pnl: 8.00,  bid: 0.33, ask: 0.35, closeTime: "Apr 15, 2026" },
  { ticker: "KXCPI-MAY",       title: "CPI under 3% in May?",      side: "no", contracts: 50,  invested: 15.00, currentValue: 18.50, pnl: 3.50,  bid: 0.35, ask: 0.38, closeTime: "May 15, 2026" },
  { ticker: "KXINX-25DEC31",   title: "S&P 500 above 5500?",       side: "yes", contracts: 20, invested: 9.00,  currentValue: 11.80, pnl: 2.80,  bid: 0.58, ask: 0.61, closeTime: "Dec 31, 2025" },
  { ticker: "KXGDP-Q1",        title: "Q1 GDP growth above 2%?",   side: "yes", contracts: 30, invested: 6.30,  currentValue: 9.30,  pnl: 3.00,  bid: 0.30, ask: 0.32, closeTime: "Apr 30, 2026" },
  { ticker: "KXBTC-25DEC31",   title: "BTC above $60K at year-end?",side: "yes",contracts: 15, invested: 4.35,  currentValue: 7.50,  pnl: 3.15,  bid: 0.47, ask: 0.52, closeTime: "Dec 31, 2025" },
  { ticker: "KXFED-MAY",       title: "Fed rate cut in May?",       side: "yes", contracts: 40, invested: 12.00, currentValue: 10.40, pnl: -1.60, bid: 0.25, ask: 0.27, closeTime: "May 7, 2026" },
  { ticker: "KXOIL-APR",       title: "Oil above $80 in April?",    side: "no", contracts: 60, invested: 22.20, currentValue: 18.60, pnl: -3.60, bid: 0.30, ask: 0.32, closeTime: "Apr 30, 2026" },
  { ticker: "KXGOLD-JUN",      title: "Gold above $2200 in June?",  side: "yes", contracts: 25, invested: 17.50, currentValue: 19.75, pnl: 2.25,  bid: 0.77, ask: 0.79, closeTime: "Jun 28, 2026" },
  { ticker: "KXUNRATE-MAY",    title: "Unemployment below 4%?",     side: "yes", contracts: 80, invested: 36.00, currentValue: 40.00, pnl: 4.00,  bid: 0.49, ask: 0.51, closeTime: "May 2, 2026" },
  { ticker: "KXSPY-MAY",       title: "SPY above 550 in May?",      side: "yes", contracts: 45, invested: 15.75, currentValue: 17.55, pnl: 1.80,  bid: 0.38, ask: 0.40, closeTime: "May 30, 2026" },
  { ticker: "KXETH-JUN",       title: "ETH above $3000 in June?",   side: "no", contracts: 90, invested: 6.30,  currentValue: 5.40,  pnl: -0.90, bid: 0.06, ask: 0.07, closeTime: "Jun 30, 2026" },
  { ticker: "KXINFLATION-Q2",  title: "Inflation stays above 2.5%?",side: "yes", contracts: 55, invested: 0.55,  currentValue: 0.66,  pnl: 0.11,  bid: 0.01, ask: 0.02, closeTime: "Jul 15, 2026" },
];

// --- Helpers ---
const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(val);

const formatPnl = (val: number) => {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${formatCurrency(val)}`;
};

// Interpolate color based on PnL
const getHeatmapColor = (pnl: number, maxAbsPnl: number) => {
  if (pnl === 0) return "hsl(0, 0%, 20%)"; // neutral gray
  
  // Normalize intensity between 0.2 and 1.0 based on PnL relative to max
  const intensity = Math.min(1, Math.max(0.2, Math.abs(pnl) / maxAbsPnl));
  
  if (pnl > 0) {
    // Green: 142 hue. Lightness from 15% (dark) to 40% (bright)
    const lightness = 15 + (intensity * 25);
    return `hsl(142, 70%, ${lightness}%)`;
  } else {
    // Red: 0 hue. Lightness from 15% (dark) to 45% (bright)
    const lightness = 15 + (intensity * 30);
    return `hsl(0, 84%, ${lightness}%)`;
  }
};

// Tooltip Component
const Tooltip = ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl text-sm">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
        </div>
      )}
    </div>
  );
};

export default function RiskHeatMap() {
  const [showTable, setShowTable] = useState(false);

  // Compute max absolute PnL for color scaling
  const maxAbsPnl = useMemo(() => {
    return Math.max(...POSITIONS.map(p => Math.abs(p.pnl)));
  }, []);

  // Compute max invested for size scaling
  const maxInvested = useMemo(() => {
    return Math.max(...POSITIONS.map(p => p.invested));
  }, []);

  // Sort positions by Invested amount (largest first) for the heatmap flow
  const heatmapPositions = useMemo(() => {
    return [...POSITIONS].sort((a, b) => b.invested - a.invested);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6 font-sans selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header / Stats Pills */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Risk Heatmap</h1>
            <p className="text-zinc-400 text-sm mt-1">Portfolio exposure & performance visualization</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-4 py-2 rounded-full">
              <DollarSign className="w-4 h-4 text-zinc-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider leading-none mb-1">Cash Balance</span>
                <span className="text-sm font-medium leading-none">{formatCurrency(STATS.balance)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-4 py-2 rounded-full">
              <Target className="w-4 h-4 text-zinc-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider leading-none mb-1">Total Invested</span>
                <span className="text-sm font-medium leading-none">{formatCurrency(STATS.totalInvested)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-4 py-2 rounded-full">
              {STATS.unrealizedPnl >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider leading-none mb-1">Unrealized P&L</span>
                <span className={`text-sm font-bold leading-none ${STATS.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatPnl(STATS.unrealizedPnl)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Heatmap Area */}
        <section className="bg-[#141414] border border-zinc-800/80 rounded-xl p-4 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-zinc-500" />
              Exposure Treemap
            </h2>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500/80"></span>
                <span>Loss</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-zinc-700"></span>
                <span>Flat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80"></span>
                <span>Profit</span>
              </div>
              <div className="ml-2 border-l border-zinc-800 pl-4">
                Size = Amount Invested
              </div>
            </div>
          </div>

          <div className="flex flex-wrap content-start gap-2 h-auto min-h-[400px]">
            {heatmapPositions.map((pos) => {
              // Calculate flex properties to simulate a treemap-like wrapping grid
              // Base size relies on invested amount, but clamped so tiny ones are still clickable
              const relativeSize = Math.max(0.15, pos.invested / maxInvested);
              const flexBasis = `${Math.floor(relativeSize * 280)}px`;
              const flexGrow = pos.invested;
              const bgColor = getHeatmapColor(pos.pnl, maxAbsPnl);
              const isProfit = pos.pnl >= 0;

              return (
                <Tooltip 
                  key={pos.ticker}
                  content={
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-zinc-400 font-mono mb-1">{pos.ticker}</div>
                        <div className="font-medium text-zinc-100 leading-snug">{pos.title}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-zinc-800/50 p-2 rounded">
                          <div className="text-zinc-500 mb-0.5">Invested</div>
                          <div className="font-mono text-zinc-200">{formatCurrency(pos.invested)}</div>
                        </div>
                        <div className="bg-zinc-800/50 p-2 rounded">
                          <div className="text-zinc-500 mb-0.5">Current Value</div>
                          <div className="font-mono text-zinc-200">{formatCurrency(pos.currentValue)}</div>
                        </div>
                        <div className="bg-zinc-800/50 p-2 rounded">
                          <div className="text-zinc-500 mb-0.5">Contracts</div>
                          <div className="font-mono text-zinc-200">{pos.contracts} <span className="uppercase text-[10px] ml-1 px-1 py-0.5 rounded bg-zinc-700">{pos.side}</span></div>
                        </div>
                        <div className="bg-zinc-800/50 p-2 rounded">
                          <div className="text-zinc-500 mb-0.5">Est. Close</div>
                          <div className="font-mono text-zinc-200 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {pos.closeTime.split(' ')[0]}
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div
                    className="group relative rounded-lg border border-white/5 overflow-hidden flex flex-col justify-between transition-transform hover:scale-[1.02] hover:z-10 hover:shadow-2xl cursor-pointer"
                    style={{
                      backgroundColor: bgColor,
                      flexBasis: flexBasis,
                      flexGrow: flexGrow,
                      minWidth: '120px',
                      height: `${Math.max(100, relativeSize * 160)}px`,
                    }}
                  >
                    {/* Inner styling overlay to give it some depth */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50" />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />
                    
                    <div className="relative z-10 p-3 flex flex-col h-full justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-white/90 line-clamp-2 leading-tight drop-shadow-md">
                          {pos.title}
                        </span>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-sm shrink-0 shadow-sm ${
                          pos.side === 'yes' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-100 border border-blue-500/30'
                        }`}>
                          {pos.side}
                        </span>
                      </div>
                      
                      <div className="mt-auto flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5">P&L</span>
                          <span className="text-xl font-bold text-white drop-shadow-md tracking-tight">
                            {formatPnl(pos.pnl)}
                          </span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5">At Risk</span>
                          <span className="text-sm font-mono text-white/90 drop-shadow-md">
                            ${Math.round(pos.invested)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </section>

        {/* Portfolio Bar */}
        <section className="bg-[#1a1a1a] border border-zinc-800/80 rounded-xl p-5 shadow-lg">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">Portfolio Allocation</h3>
              <p className="text-xs text-zinc-500 mt-1">Cash vs Deployed Capital</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-white">{formatCurrency(STATS.portfolioValue)}</span>
              <span className="text-xs text-zinc-500 ml-2">Total Value</span>
            </div>
          </div>
          
          <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
            <div 
              className="bg-zinc-600 h-full transition-all duration-1000 ease-out relative overflow-hidden" 
              style={{ width: `${STATS.cashPct}%` }}
            >
              <div className="absolute inset-0 bg-white/10 w-full" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)' }}></div>
            </div>
            <div 
              className="bg-emerald-500/80 h-full transition-all duration-1000 ease-out" 
              style={{ width: `${STATS.investedPct}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs mt-3 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
              <span className="text-zinc-400">Cash ({STATS.cashPct}%)</span>
              <span className="text-zinc-200">{formatCurrency(STATS.balance)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-200">{formatCurrency(STATS.totalInvested)}</span>
              <span className="text-zinc-400">Invested ({STATS.investedPct}%)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500/80"></span>
            </div>
          </div>
        </section>

        {/* View Table Toggle */}
        <section>
          <button
            onClick={() => setShowTable(!showTable)}
            className="w-full py-4 flex items-center justify-center gap-2 text-sm font-medium text-zinc-400 hover:text-white bg-[#141414] hover:bg-[#1a1a1a] border border-zinc-800/80 rounded-xl transition-colors shadow-sm"
          >
            <List className="w-4 h-4" />
            {showTable ? "Hide positions table" : "View compact positions table"}
            {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showTable && (
            <div className="mt-4 bg-[#141414] border border-zinc-800/80 rounded-xl overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-zinc-400 font-medium">
                      <th className="px-4 py-3">Market</th>
                      <th className="px-4 py-3 text-center">Side</th>
                      <th className="px-4 py-3 text-right">Size</th>
                      <th className="px-4 py-3 text-right">Invested</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {POSITIONS.map((pos) => (
                      <tr key={pos.ticker} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-200 truncate max-w-[200px] sm:max-w-[300px]">{pos.title}</div>
                          <div className="text-xs text-zinc-500 font-mono mt-0.5">{pos.ticker}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-sm ${
                            pos.side === 'yes' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {pos.side}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-300">{pos.contracts}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-300">{formatCurrency(pos.invested)}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-300">{formatCurrency(pos.currentValue)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono font-medium ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatPnl(pos.pnl)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
