import { useEffect, useRef, useState } from "react";
import { X, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ChatSidebarProps {
  tab: string;
  tabData?: unknown;
  onClose: () => void;
}

// Kowalski gateway — OpenClaw Control UI served directly
const GATEWAY_URL    = import.meta.env.VITE_KOWALSKI_GATEWAY_URL ?? "http://167.71.108.57:18789";
const GATEWAY_TOKEN  = import.meta.env.VITE_KOWALSKI_TOKEN ?? "";

export function ChatSidebar({ tab, onClose }: ChatSidebarProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  // Build the Control UI URL — passes gatewayUrl in localStorage via fragment token
  // The Control UI reads ?gatewayUrl and #token on load, strips them, and connects
  const chatUrl = `${GATEWAY_URL}/#token=${encodeURIComponent(GATEWAY_TOKEN)}`;

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [tab]);

  // Post tab context into the iframe once it's loaded so Kowalski knows where we are
  const handleLoad = () => {
    setLoading(false);
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "benadmin.context", tab, gatewayUrl: GATEWAY_URL },
        GATEWAY_URL
      );
    } catch { /* cross-origin — ok, just context hint */ }
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">Kowalski</span>
          <Badge variant="outline" className="text-xs capitalize">{tab}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Chat iframe — OpenClaw Control UI */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Can't reach Kowalski at <code className="text-xs bg-muted px-1 rounded">{GATEWAY_URL}</code>
            </p>
            <Button size="sm" variant="outline" onClick={() => { setError(false); setLoading(true); }}>
              Retry
            </Button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={chatUrl}
            onLoad={handleLoad}
            onError={handleError}
            className="w-full h-full border-0"
            title="Kowalski"
            allow="clipboard-read; clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
