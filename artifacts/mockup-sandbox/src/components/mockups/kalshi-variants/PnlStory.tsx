import React, { useState } from "react";
import { ChevronDown, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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

export default function PnlStory() {
  const [showClosed, setShowClosed] = useState(false);

  const winners = POSITIONS.filter((p) => p.pnl > 0).sort((a, b) => b.pnl - a.pnl);
  const losers = POSITIONS.filter((p) => p.pnl <= 0).sort((a, b) => a.pnl - b.pnl); // Sort ascending (worst first)

  const winRate = (winners.length / POSITIONS.length) * 100;
  const returnPct = (STATS.unrealizedPnl / STATS.totalInvested) * 100;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Hero Section */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-gray-400 text-sm font-medium tracking-wide uppercase">Total Unrealized Return</h1>
            <div className="flex items-baseline gap-4">
              <span className={`text-6xl md:text-8xl font-bold tracking-tight ${STATS.unrealizedPnl >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                {STATS.unrealizedPnl >= 0 ? "+" : ""}${Math.abs(STATS.unrealizedPnl).toFixed(2)}
              </span>
              <span className={`text-2xl md:text-4xl font-medium ${STATS.unrealizedPnl >= 0 ? "text-emerald-500/80" : "text-red-400/80"}`}>
                {STATS.unrealizedPnl >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300 font-medium">
                {STATS.openPositions} active positions &middot; {winners.length} winners &middot; {losers.length} losers
              </span>
              <span className="text-gray-500">
                Win Rate: <span className="text-white font-medium">{winRate.toFixed(0)}%</span>
              </span>
            </div>
            
            <div className="h-3 w-full bg-[#222] rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500 ease-in-out" 
                style={{ width: `${winRate}%` }}
              />
              <div 
                className="h-full bg-red-500 transition-all duration-500 ease-in-out" 
                style={{ width: `${100 - winRate}%` }}
              />
            </div>
            
            <div className="pt-4 mt-2 border-t border-[#2a2a2a] flex items-center justify-between text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>${STATS.balance.toFixed(2)} cash</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span>${STATS.totalInvested.toFixed(2)} deployed</span>
              </div>
            </div>
          </div>
        </section>

        {/* Positions List */}
        <section className="space-y-10">
          
          {/* Winners */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-emerald-500">
              <ArrowUpRight className="w-5 h-5" />
              Winners
            </h2>
            <div className="space-y-3">
              {winners.map((pos) => (
                <div 
                  key={pos.ticker} 
                  className="group flex items-center justify-between p-4 bg-[#1a1a1a] border border-[#2a2a2a] border-l-4 border-l-emerald-500 rounded-lg hover:bg-[#222] transition-colors"
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs uppercase border-transparent ${pos.side === 'yes' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>
                        {pos.side}
                      </Badge>
                      <h3 className="font-medium text-white truncate max-w-[200px] sm:max-w-md">{pos.title}</h3>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-3">
                      <span>Cost: ${pos.invested.toFixed(2)}</span>
                      <span>Value: ${pos.currentValue.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="text-right pl-4 flex-shrink-0">
                    <div className="text-xl font-bold text-emerald-500">
                      +${pos.pnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-emerald-500/70 font-medium">
                      +{((pos.pnl / pos.invested) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-[#2a2a2a]" />

          {/* Losers */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-red-400">
              <ArrowDownRight className="w-5 h-5" />
              Losers
            </h2>
            <div className="space-y-3">
              {losers.map((pos) => (
                <div 
                  key={pos.ticker} 
                  className="group flex items-center justify-between p-4 bg-[#1a1a1a] border border-[#2a2a2a] border-l-4 border-l-red-500/70 rounded-lg hover:bg-[#222] transition-colors"
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs uppercase border-transparent ${pos.side === 'yes' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>
                        {pos.side}
                      </Badge>
                      <h3 className="font-medium text-white truncate max-w-[200px] sm:max-w-md">{pos.title}</h3>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-3">
                      <span>Cost: ${pos.invested.toFixed(2)}</span>
                      <span>Value: ${pos.currentValue.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="text-right pl-4 flex-shrink-0">
                    <div className="text-xl font-bold text-red-400">
                      -${Math.abs(pos.pnl).toFixed(2)}
                    </div>
                    <div className="text-xs text-red-400/70 font-medium">
                      {((pos.pnl / pos.invested) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closed Trades Toggle */}
        <section className="pt-8 flex justify-center pb-12">
          <Button 
            variant="outline" 
            className="bg-transparent border-[#333] text-gray-400 hover:text-white hover:bg-[#222] rounded-full px-6"
            onClick={() => setShowClosed(!showClosed)}
          >
            <Activity className="w-4 h-4 mr-2" />
            {showClosed ? "Hide closed trades" : "Show closed trades"}
            <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showClosed ? "rotate-180" : ""}`} />
          </Button>
        </section>
        
        {showClosed && (
          <div className="text-center text-gray-500 pb-20 animate-in fade-in slide-in-from-top-4">
            <p>Closed trades history would appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
