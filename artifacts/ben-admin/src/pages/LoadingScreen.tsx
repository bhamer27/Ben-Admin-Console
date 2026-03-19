import { ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background">
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.5, 1, 0.5]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6"
      >
        <ShieldAlert className="h-8 w-8" />
      </motion.div>
      <div className="flex flex-col items-center gap-2">
        <div className="h-1 w-32 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "linear",
            }}
          />
        </div>
        <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">Initializing</p>
      </div>
    </div>
  );
}
