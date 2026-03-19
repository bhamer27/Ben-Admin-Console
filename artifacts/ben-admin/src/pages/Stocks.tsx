import { ComingSoonPage } from "./ComingSoonPage";
import { LineChart } from "lucide-react";

export default function Stocks() {
  return (
    <ComingSoonPage
      title="Stock Portfolios"
      description="Aggregated portfolio value, holdings, and performance metrics from Tradier and Public.com will be visualized here."
      icon={<LineChart className="h-10 w-10" />}
    />
  );
}
