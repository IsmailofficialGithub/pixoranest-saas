import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UsageData {
  usage_consumed: number;
  usage_limit: number;
  service_name: string;
}

export function RealtimeUsageMeter({
  clientId,
  serviceId,
}: {
  clientId: string;
  serviceId: string;
}) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      const { data } = await supabase
        .from('client_services')
        .select('usage_consumed, usage_limit, services(name)')
        .eq('client_id', clientId)
        .eq('service_id', serviceId)
        .maybeSingle();

      if (data) {
        const svc = data.services as any;
        setUsage({
          usage_consumed: data.usage_consumed ?? 0,
          usage_limit: data.usage_limit,
          service_name: svc?.name ?? 'Service',
        });
      }
    };

    fetchUsage();

    const channel = supabase
      .channel(`usage-${clientId}-${serviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'client_services',
          filter: `client_id=eq.${clientId}`,
        },
        () => fetchUsage()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, serviceId]);

  if (!usage) return null;

  const percentage = usage.usage_limit > 0
    ? (usage.usage_consumed / usage.usage_limit) * 100
    : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{usage.service_name}</span>
        <span className="font-medium">
          {usage.usage_consumed} / {usage.usage_limit}
        </span>
      </div>
      <Progress
        value={Math.min(percentage, 100)}
        className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}`}
      />
      {isNearLimit && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            {isAtLimit
              ? 'Usage limit reached! Service may be paused.'
              : `${(100 - percentage).toFixed(0)}% remaining`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
