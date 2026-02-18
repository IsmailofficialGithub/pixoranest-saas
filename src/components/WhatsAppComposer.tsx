import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { toast } from 'sonner';

export function WhatsAppComposer() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const { sendMessage, isSending } = useWhatsApp();

  const handleSend = async () => {
    if (!phoneNumber || !message) {
      toast.error('Phone number and message are required');
      return;
    }

    try {
      await sendMessage({ to: phoneNumber, message, type: 'text' });
      toast.success('Message sent successfully!');
      setMessage('');
    } catch (error: any) {
      toast.error('Failed to send message', { description: error.message });
    }
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="+91 98765 43210"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />
      <div className="relative">
        <Textarea
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4096}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {message.length} / 4096 characters
        </span>
        <Button
          onClick={handleSend}
          disabled={isSending || !phoneNumber || !message}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {isSending ? 'Sending...' : 'Send Message'}
        </Button>
      </div>
    </div>
  );
}
