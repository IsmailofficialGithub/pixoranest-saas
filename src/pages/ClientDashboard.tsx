import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function ClientDashboard() {
  const { profile, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Client Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {profile?.full_name || profile?.email}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </header>
      <main className="p-6">
        <p className="text-muted-foreground">Client dashboard coming soon.</p>
      </main>
    </div>
  );
}
