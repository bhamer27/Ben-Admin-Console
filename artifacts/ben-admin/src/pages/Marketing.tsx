import { ComingSoonPage } from "./ComingSoonPage";
import { Megaphone } from "lucide-react";

export default function Marketing() {
  return (
    <ComingSoonPage
      title="Marketing Insights"
      description="Consolidated performance data from Google Search Console, Google Ads, and Instantly.ai campaigns will be available here."
      icon={<Megaphone className="h-10 w-10" />}
    />
  );
}
