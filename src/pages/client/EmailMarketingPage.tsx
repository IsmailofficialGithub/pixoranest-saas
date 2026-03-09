import { useEffect, useState, useCallback } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Mail, CheckCircle, CheckCheck, Zap, MessageSquare,
  Users, FileText, BarChart3, MoreVertical, Plus, Send,
  Clock, X, RefreshCw, Trash2, Eye, MousePointer2,
} from "lucide-react";
import { formatDistanceToNow, format, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

/* ─── Types ─── */
interface EmailCampaign {
  id: string;
  campaign_name: string;
  status: string;
  total_recipients: number;
  emails_sent: number;
  emails_delivered: number;
  emails_opened: number;
  emails_clicked: number;
  created_at: string;
}

interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  activeCampaigns: number;
}

export default function EmailMarketingPage() {
  const { client, assignedServices, isLoading: contextLoading } = useClient();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const emailService = assignedServices.find(s => s.service_slug === "email-marketing");

  const fetchAll = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    // For now, we'll use empty states as it's a new service
    setCampaigns([]);
    setStats({
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      deliveryRate: 0,
      openRate: 0,
      activeCampaigns: 0,
    });
    setIsLoading(false);
  }, [client]);

  useEffect(() => {
    if (!client || contextLoading) return;
    if (!emailService) return;
    fetchAll();
  }, [client, contextLoading, emailService]);

  if (contextLoading || isLoading) return <LoadingSkeleton />;
  if (!emailService) return <Navigate to="/client" replace />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Email Marketing</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Design, send and track email campaigns</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Badge variant="outline" className="text-xs py-1 px-3">
            {emailService.usage_consumed} / {emailService.usage_limit} emails used
          </Badge>
          <Button size="sm" onClick={() => setSendModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatsCard icon={<Send className="h-5 w-5" />} color="#3b82f6" label="Emails Sent" value={stats?.sent ?? 0} subtext="This month" />
        <StatsCard icon={<CheckCircle className="h-5 w-5" />} color="#22c55e" label="Delivery Rate" value={`${stats?.deliveryRate ?? 0}%`} subtext={`${stats?.delivered ?? 0} delivered`} />
        <StatsCard icon={<Eye className="h-5 w-5" />} color="#8b5cf6" label="Open Rate" value={`${stats?.openRate ?? 0}%`} subtext={`${stats?.opened ?? 0} opens`} />
        <StatsCard icon={<Zap className="h-5 w-5" />} color="#f59e0b" label="Active Campaigns" value={stats?.activeCampaigns ?? 0} subtext="Running now" />
      </div>

      {/* Placeholder for no campaigns */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted p-6 mb-6">
            <Mail className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Start your first email campaign</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">Reach your customers directly in their inbox with beautiful, automated email campaigns.</p>
          <Button onClick={() => setSendModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Campaign
          </Button>
        </CardContent>
      </Card>

      {/* Analytics Placeholder */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Engagement Over Time</CardTitle></CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground italic">
            No data available yet
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Device Distribution</CardTitle></CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground italic">
            No data available yet
          </CardContent>
        </Card>
      </div>

      {/* Send Modal (Simplified) */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>New email marketing features are coming soon.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-center">
             <div className="rounded-lg bg-primary/10 p-4 border border-primary/20">
                <p className="text-sm text-primary font-medium">Integration in progress</p>
                <p className="text-xs text-muted-foreground mt-1 text-balance">We are currently setting up the email infrastructure for your account. This service will be available shortly.</p>
             </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSendModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsCard({ icon, color, label, value, subtext }: { icon: React.ReactNode; color: string; label: string; value: string | number; subtext: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{subtext}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
