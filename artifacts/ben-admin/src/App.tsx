import { Switch, Route, Router as WouterRouter, Redirect, useSearch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useAuth } from "@workspace/replit-auth-web";

import { Shell } from "@/components/layout/Shell";

import LoadingScreen from "@/pages/LoadingScreen";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import Overview from "@/pages/Overview";
import Replit from "@/pages/Replit";
import Stripe from "@/pages/Stripe";
import Marketing from "@/pages/Marketing";
import Kalshi from "@/pages/Kalshi";
import Stocks from "@/pages/Stocks";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, logout } = useAuth();

  return (
    <Shell user={user} logout={logout}>
      <Switch>
        <Route path="/" component={() => <Redirect to="/overview" />} />
        <Route path="/overview" component={Overview} />
        <Route path="/replit" component={Replit} />
        <Route path="/stripe" component={Stripe} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/kalshi" component={Kalshi} />
        <Route path="/stocks" component={Stocks} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function SetupGuard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isSetupPending = params.get("setup") === "pending";

  if (isSetupPending) {
    return <Setup onClaimed={() => { window.location.href = "/"; }} />;
  }
  return null;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isSetupPending = params.get("setup") === "pending";

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isSetupPending) {
    return <Setup onClaimed={() => { window.location.href = "/"; }} />;
  }

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/overview" /> : <Login />}
      </Route>

      <Route path="/.*">
        {!isAuthenticated ? <Redirect to="/login" /> : <ProtectedRoutes />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
