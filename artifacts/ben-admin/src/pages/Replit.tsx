import { ComingSoonPage } from "./ComingSoonPage";
import { TerminalSquare } from "lucide-react";

export default function Replit() {
  return (
    <ComingSoonPage
      title="Replit Projects"
      description="Usage metrics, signups, and deployment status across all your Replit projects will appear here once the API integration is complete."
      icon={<TerminalSquare className="h-10 w-10" />}
    />
  );
}
