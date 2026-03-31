import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { ArrowRight, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Abstract geometric background" 
          className="w-full h-full object-cover opacity-30 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md p-8"
      >
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="flex justify-center mb-6">
            <img
              src={`${import.meta.env.BASE_URL}images/logo-nobg.png`}
              alt="BenAdmin"
              className="h-32 w-32 object-contain"
              style={{ filter: "brightness(1.8) contrast(1.1) saturate(0.75)" }}
            />
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">BenAdmin</h1>
            <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
              <Lock className="h-3.5 w-3.5" /> Private Console Access
            </p>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={login} 
              className="w-full h-12 text-base font-medium group"
            >
              Authenticate via Replit
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            
            <p className="text-xs text-center text-muted-foreground/60 px-4">
              Access is strictly restricted to the authorized Replit account owner. All other login attempts will be rejected.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
