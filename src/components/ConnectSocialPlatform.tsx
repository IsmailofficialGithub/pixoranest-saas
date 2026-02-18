import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';

const platforms = [
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-[#1877F2]' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-[#E4405F]' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-[#0A66C2]' },
  { id: 'twitter', name: 'Twitter / X', icon: Twitter, color: 'bg-foreground' },
] as const;

interface ConnectSocialPlatformProps {
  onConnect: (platform: string) => void;
  connectedPlatforms?: string[];
}

export function ConnectSocialPlatform({ onConnect, connectedPlatforms = [] }: ConnectSocialPlatformProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Connect Platforms</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          const isConnected = connectedPlatforms.includes(platform.id);

          return (
            <Button
              key={platform.id}
              variant={isConnected ? 'secondary' : 'outline'}
              className="h-auto py-3 flex flex-col gap-2"
              onClick={() => onConnect(platform.id)}
              disabled={isConnected}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">
                {isConnected ? 'Connected' : `Connect ${platform.name}`}
              </span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
