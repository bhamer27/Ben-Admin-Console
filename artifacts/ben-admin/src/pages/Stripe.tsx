import { ComingSoonPage } from "./ComingSoonPage";
import { CreditCard } from "lucide-react";

export default function Stripe() {
  return (
    <ComingSoonPage
      title="Stripe Metrics"
      description="Sales, MRR, and new subscriber data broken down by price IDs across your connected Stripe profiles will be displayed here."
      icon={<CreditCard className="h-10 w-10" />}
    />
  );
}
