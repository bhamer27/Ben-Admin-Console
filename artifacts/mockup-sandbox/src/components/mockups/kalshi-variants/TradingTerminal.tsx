import React, { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

type SortField = keyof Position | "mid";
type SortOrder = "asc" | "desc";

export default function TradingTerminal() {
  const [sortField, setSortField] = useState<SortField>("pnl");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentTime] = useState(new Date().toLocaleTimeString("en-US", { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" }));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedPositions = [...POSITIONS].sort((a, b) => {
    let aValue: any = a[sortField as keyof Position];
    let bValue: any = b[sortField as keyof Position];

    if (sortField === "mid") {
      aValue = (a.bid + a.ask) / 2;
      bValue = (b.bid + b.ask) / 2;
    }

    if (typeof aValue === "string") {
      return sortOrder === "asc" 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }

    return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 group-hover:opacity-100" />;
    return sortOrder === "asc" ? <ArrowUp className="w-3 h-3 ml-1 text-white" /> : <ArrowDown className="w-3 h-3 ml-1 text-white" />;
  };

  const formatMoney = (val: number) => `$${val.toFixed(2)}`;
  const formatPnl = (val: number) => `${val >= 0 ? "+" : ""}${val.toFixed(2)}`;
  const getPnlColor = (val: number) => val >= 0 ? "text-emerald-500" : "text-red-400";
  const getSideColor = (side: "yes" | "no") => side === "yes" ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : "text-blue-400 bg-blue-400/10 border-blue-400/20";

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#888] font-mono text-xs flex flex-col selection:bg-white/20 uppercase">
      {/* Top Status Bar */}
      <div className="bg-[#111] border-b border-[#2a2a2a] px-4 py-2 flex items-center justify-between text-white sticky top-0 z-10">
        <div className="flex items-center space-x-6">
          <span className="text-emerald-500 font-bold tracking-wider">TERMINAL //</span>
          <span>CASH {formatMoney(STATS.balance)}</span>
          <span className="text-[#555]">|</span>
          <span>INVESTED {formatMoney(STATS.totalInvested)} ({STATS.investedPct}%)</span>
          <span className="text-[#555]">|</span>
          <span className={cn("font-bold", getPnlColor(STATS.unrealizedPnl))}>
            P&L {STATS.unrealizedPnl >= 0 ? "+" : ""}{formatMoney(STATS.unrealizedPnl)}
          </span>
          <span className="text-[#555]">|</span>
          <span>{STATS.openPositions} POS</span>
        </div>
        <div className="flex items-center space-x-3 text-[#888]">
          <Clock className="w-3 h-3" />
          <span>SYS TIME {currentTime}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#0a0a0a] border-b border-[#2a2a2a] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
          <span className="text-white font-bold tracking-widest">KALSHI POSITIONS</span>
        </div>
        <div className="text-[#555]">LIVE FEED ACTIVE</div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        <div className="w-full min-w-[800px]">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] px-4 py-2 border-b border-[#2a2a2a] bg-[#111] text-[#888] sticky top-0 z-10 uppercase text-[10px] tracking-wider font-semibold">
            <button className="flex items-center group text-left hover:text-white transition-colors" onClick={() => handleSort("ticker")}>
              TICKER / CONTRACT <SortIcon field="ticker" />
            </button>
            <button className="flex items-center group justify-center hover:text-white transition-colors" onClick={() => handleSort("side")}>
              SIDE <SortIcon field="side" />
            </button>
            <button className="flex items-center group justify-end hover:text-white transition-colors" onClick={() => handleSort("contracts")}>
              QTY <SortIcon field="contracts" />
            </button>
            <button className="flex items-center group justify-end hover:text-white transition-colors" onClick={() => handleSort("mid")}>
              MID <SortIcon field="mid" />
            </button>
            <button className="flex items-center group justify-end hover:text-white transition-colors" onClick={() => handleSort("invested")}>
              COST <SortIcon field="invested" />
            </button>
            <button className="flex items-center group justify-end hover:text-white transition-colors" onClick={() => handleSort("currentValue")}>
              VALUE <SortIcon field="currentValue" />
            </button>
            <button className="flex items-center group justify-end hover:text-white transition-colors" onClick={() => handleSort("pnl")}>
              UNREALIZED P&L <SortIcon field="pnl" />
            </button>
          </div>

          {/* Table Body */}
          <div className="flex flex-col">
            {sortedPositions.map((pos, i) => {
              const mid = (pos.bid + pos.ask) / 2;
              return (
                <div 
                  key={pos.ticker}
                  className={cn(
                    "grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] px-4 py-3 border-b border-[#2a2a2a]/50 hover:bg-[#1a1a1a] transition-colors items-center",
                    i % 2 === 0 ? "bg-[#0f0f0f]" : "bg-[#111]"
                  )}
                >
                  <div className="flex flex-col pr-4">
                    <span className="text-white font-medium truncate" title={pos.ticker}>{pos.ticker}</span>
                    <span className="text-[#555] truncate text-[10px] mt-0.5" title={pos.title}>{pos.title}</span>
                  </div>
                  <div className="flex justify-center">
                    <span className={cn("px-2 py-0.5 border rounded-sm text-[10px] font-bold", getSideColor(pos.side))}>
                      {pos.side}
                    </span>
                  </div>
                  <div className="text-right text-white font-medium">{pos.contracts}</div>
                  <div className="text-right text-[#aaa]">
                    <span className="text-white">${mid.toFixed(2)}</span>
                    <div className="text-[10px] text-[#555] mt-0.5">${pos.bid.toFixed(2)} / ${pos.ask.toFixed(2)}</div>
                  </div>
                  <div className="text-right text-[#aaa]">{formatMoney(pos.invested)}</div>
                  <div className="text-right text-white">{formatMoney(pos.currentValue)}</div>
                  <div className={cn("text-right font-bold flex flex-col items-end", getPnlColor(pos.pnl))}>
                    <span>{formatPnl(pos.pnl)}</span>
                    <span className="text-[10px] opacity-70 mt-0.5">
                      {formatPnl((pos.pnl / pos.invested) * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Portfolio Bar */}
      <div className="mt-auto border-t border-[#2a2a2a] bg-[#0a0a0a]">
        <div className="flex w-full h-1">
          <div className="bg-[#444] transition-all duration-1000" style={{ width: \`\${STATS.cashPct}%\` }} />
          <div className="bg-emerald-500 transition-all duration-1000" style={{ width: \`\${STATS.investedPct}%\` }} />
        </div>
        <div className="px-4 py-2 flex justify-between text-[#555] text-[10px]">
          <span>PORTFOLIO ALLOCATION</span>
          <div className="flex space-x-4">
            <span className="flex items-center"><div className="w-2 h-2 bg-[#444] rounded-sm mr-2"></div>CASH {STATS.cashPct}%</span>
            <span className="flex items-center"><div className="w-2 h-2 bg-emerald-500 rounded-sm mr-2"></div>INVESTED {STATS.investedPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
