import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export function ComingSoonPage({ title, description, icon }: ComingSoonPageProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[80vh] flex flex-col items-center justify-center text-center"
    >
      <div className="relative mb-8 group">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative h-20 w-20 rounded-2xl bg-card border border-border shadow-lg flex items-center justify-center text-primary transition-transform duration-500 group-hover:scale-110">
          {icon}
        </div>
      </div>
      
      <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">{title}</h1>
      <p className="text-muted-foreground max-w-md text-base leading-relaxed">
        {description}
      </p>
      
      <div className="mt-10 inline-flex items-center rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground tracking-wide uppercase">
        <span className="flex h-2 w-2 rounded-full bg-primary/50 mr-2 animate-pulse"></span>
        Pending Integration
      </div>
    </motion.div>
  );
}
