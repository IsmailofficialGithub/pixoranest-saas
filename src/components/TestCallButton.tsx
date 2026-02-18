import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Loader2 } from 'lucide-react';
import { useRetellCall } from '@/hooks/useRetellCall';
import { toast } from 'sonner';

interface TestCallButtonProps {
  script: string;
  voiceSettings?: {
    voice: string;
    speed: number;
    language: string;
  };
}

export function TestCallButton({ script, voiceSettings }: TestCallButtonProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const { initiateCall, isInitiating } = useRetellCall();

  const handleTestCall = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    try {
      await initiateCall({
        toNumber: phoneNumber,
        script,
        voiceSettings,
      });

      toast.success('Test call initiated!', {
        description: `Calling ${phoneNumber}...`,
      });
    } catch (error: any) {
      toast.error('Failed to initiate call', {
        description: error.message,
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder="+91 98765 43210"
        className="max-w-[200px]"
      />
      <Button onClick={handleTestCall} disabled={isInitiating} size="sm">
        {isInitiating ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Phone className="h-4 w-4 mr-1" />
        )}
        Test Call
      </Button>
    </div>
  );
}
