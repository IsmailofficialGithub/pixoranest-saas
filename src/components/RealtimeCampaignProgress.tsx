import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CallStats {
  total: number;
  completed: number;
  answered: number;
  failed: number;
  inProgress: number;
}

export function RealtimeCampaignProgress({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<any>(null);
  const [callStats, setCallStats] = useState<CallStats>({
    total: 0,
    completed: 0,
    answered: 0,
    failed: 0,
    inProgress: 0,
  });

  useEffect(() => {
    const fetchCampaign = async () => {
      const { data } = await supabase
        .from('voice_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      setCampaign(data);
    };

    fetchCampaign();

    const campaignChannel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'voice_campaigns',
          filter: `id=eq.${campaignId}`,
        },
        (payload) => setCampaign(payload.new)
      )
      .subscribe();

    const callsChannel = supabase
      .channel(`campaign-calls-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_contacts',
          filter: `campaign_id=eq.${campaignId}`,
        },
        async () => {
          const { data: contacts } = await supabase
            .from('campaign_contacts')
            .select('call_status')
            .eq('campaign_id', campaignId);

          if (contacts) {
            setCallStats({
              total: contacts.length,
              completed: contacts.filter((c) => c.call_status === 'completed').length,
              answered: contacts.filter((c) => c.call_status === 'answered').length,
              failed: contacts.filter((c) => c.call_status === 'failed').length,
              inProgress: contacts.filter((c) => c.call_status === 'calling').length,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignChannel);
      supabase.removeChannel(callsChannel);
    };
  }, [campaignId]);

  if (!campaign) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const progress =
    campaign.total_contacts > 0
      ? ((campaign.contacts_called ?? 0) / campaign.total_contacts) * 100
      : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Campaign Progress</CardTitle>
          <Badge
            variant={
              campaign.status === 'running'
                ? 'default'
                : campaign.status === 'completed'
                ? 'secondary'
                : 'outline'
            }
          >
            {campaign.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Calls Made</span>
            <span className="font-medium">
              {campaign.contacts_called ?? 0} / {campaign.total_contacts ?? 0}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(1)}% complete</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Clock className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">{callStats.inProgress}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Phone className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold">{callStats.answered}</p>
            <p className="text-[10px] text-muted-foreground">Answered</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <XCircle className="h-4 w-4 mx-auto mb-1 text-destructive" />
            <p className="text-lg font-bold">{callStats.failed}</p>
            <p className="text-[10px] text-muted-foreground">Failed</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <CheckCircle className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{callStats.completed}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
        </div>

        {campaign.status === 'running' && (
          <p className="text-xs text-muted-foreground text-center">
            🕐 Estimated completion: {calculateETA(campaign)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function calculateETA(campaign: any): string {
  const remaining = (campaign.total_contacts ?? 0) - (campaign.contacts_called ?? 0);
  const estimatedSeconds = remaining * 30;
  const minutes = Math.floor(estimatedSeconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `~${hours}h ${minutes % 60}m`;
  return `~${minutes}m`;
}
