import { ComingSoonPage } from "./ComingSoonPage";
import { TrendingUp } from "lucide-react";

export default function Kalshi() {
  return (
    <ComingSoonPage
      title="Kalshi Bot"
      description="Live hit rates, open positions, account balance, and P&L from your droplet-hosted trading bot will stream here."
      icon={<TrendingUp className="h-10 w-10" />}
    />
  );
}
