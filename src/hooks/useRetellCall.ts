import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InitiateCallOptions {
  toNumber: string;
  script: string;
  voiceSettings?: {
    voice: string;
    speed: number;
    language: string;
  };
  customData?: Record<string, any>;
}

export function useRetellCall() {
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateCall = async (options: InitiateCallOptions) => {
    setIsInitiating(true);
    setError(null);

    try {
      const { data, error: callError } = await supabase.functions.invoke(
        'initiate-retell-call',
        {
          body: {
            to_number: options.toNumber,
            script: options.script,
            voice_settings: options.voiceSettings,
            custom_data: options.customData,
          },
        }
      );

      if (callError) throw callError;
      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to initiate call';
      setError(message);
      throw err;
    } finally {
      setIsInitiating(false);
    }
  };

  return { initiateCall, isInitiating, error };
}
