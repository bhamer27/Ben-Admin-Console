import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useAuth } from "@workspace/replit-auth-web";

import { Shell } from "@/components/layout/Shell";
import { TabDataProvider, useTabData } from "@/lib/tabDataContext";

import LoadingScreen from "@/pages/LoadingScreen";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import Replit from "@/pages/Replit";
import Stripe from "@/pages/Stripe";
import Marketing from "@/pages/Marketing";
import Kalshi from "@/pages/Kalshi";
import Tars from "@/pages/Tars";
import Stocks from "@/pages/Stocks";
import Products from "@/pages/Products";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, logout } = useAuth();
  const { tabData } = useTabData();

  return (
    <Shell user={user} logout={logout} tabData={tabData}>
      <Switch>
        <Route path="/" component={() => <Redirect to="/overview" />} />
        <Route path="/overview" component={Overview} />
        <Route path="/replit" component={Replit} />
        <Route path="/stripe" component={Stripe} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/kalshi" component={Kalshi} />
        <Route path="/tars" component={Tars} />
        <Route path="/stocks" component={Stocks} />
        <Route path="/products" component={Products} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        <Redirect to="/overview" />
      </Route>
      <Route>
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TabDataProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TabDataProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
