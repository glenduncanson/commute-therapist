import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import DriveMode from "@/pages/DriveMode";
import SessionScreen from "@/pages/Session";
import { Journal, JournalDetail } from "@/pages/Journal";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/drive/:id" component={DriveMode} />
          <Route path="/session/:id" component={SessionScreen} />
          <Route path="/journal" component={Journal} />
          <Route path="/journal/:id" component={JournalDetail} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
