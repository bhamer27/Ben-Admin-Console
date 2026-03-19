import { useState } from "react";
import { ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SetupProps {
  token: string;
  uid: string;
  onClaimed: () => void;
}

export default function Setup({ token, uid, onClaimed }: SetupProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function claimAdmin() {
    setStatus("loading");
    try {
      const res = await fetch(
        `/api/auth/claim-admin?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (res.ok) {
        setStatus("success");
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || `Error ${res.status}`);
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8"
      >
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl shadow-black/30 text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <ShieldAlert className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">First-time setup</h1>
            <p className="text-sm text-muted-foreground mt-2">
              BenAdmin has no owner registered yet. Claim this console as the admin to get started.
            </p>
          </div>

          {status === "success" ? (
            <div className="flex flex-col items-center gap-2 text-green-400">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-sm font-medium">Ownership claimed. Redirecting…</p>
            </div>
          ) : (
            <>
              <Button
                onClick={claimAdmin}
                disabled={status === "loading"}
                className="w-full h-11"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Claiming…
                  </>
                ) : (
                  "Claim admin ownership"
                )}
              </Button>

              {status === "error" && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}

              <p className="text-xs text-muted-foreground/60 px-2">
                This can only be done once. After you claim ownership, no other account can access BenAdmin.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
