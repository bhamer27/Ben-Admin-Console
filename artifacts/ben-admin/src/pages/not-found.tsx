import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
      <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground mb-6">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">404</h1>
      <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <Link href="/overview" className="block">
        <Button>Return to Dashboard</Button>
      </Link>
    </div>
  );
}
