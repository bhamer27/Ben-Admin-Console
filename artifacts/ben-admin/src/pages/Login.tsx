import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { loginWithPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setError(null);
    setLoading(true);
    try {
      await loginWithPassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt=""
          className="w-full h-full object-cover opacity-30 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="flex justify-center mb-6">
            <img
              src={`${import.meta.env.BASE_URL}images/logo-nobg.png`}
              alt="BenAdmin"
              className="h-40 w-40 object-contain"
              style={{ filter: "brightness(1.8) contrast(1.1) saturate(0.75)" }}
            />
          </div>

          <div className="text-center mb-7">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1.5">BenAdmin</h1>
            <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
              <Lock className="h-3.5 w-3.5" /> Private Console Access
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full h-12 rounded-lg border border-border bg-secondary/40 px-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive text-center"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              disabled={loading || !password}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
