import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeSubscription<T extends { id: string }>(
  table: string,
  filter?: { column: string; value: string },
  callback?: (payload: any) => void
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const setupSubscription = async () => {
      // Initial fetch
      let query = (supabase.from as any)(table).select('*');

      if (filter) {
        query = query.eq(filter.column, filter.value);
      }

      const { data: initialData, error } = await query;

      if (!error && initialData) {
        setData(initialData as T[]);
      }
      setLoading(false);

      // Setup realtime subscription
      channelRef.current = supabase
        .channel(`${table}-${filter?.value || 'all'}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setData((prev) => [...prev, payload.new as T]);
            } else if (payload.eventType === 'UPDATE') {
              setData((prev) =>
                prev.map((item) =>
                  item.id === (payload.new as any).id ? (payload.new as T) : item
                )
              );
            } else if (payload.eventType === 'DELETE') {
              setData((prev) =>
                prev.filter((item) => item.id !== (payload.old as any).id)
              );
            }

            callback?.(payload);
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, filter?.column, filter?.value]);

  return { data, loading, setData };
}
