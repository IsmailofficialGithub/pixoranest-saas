import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, TrendingUp, Calendar, Mail, Lightbulb, Zap } from 'lucide-react';

interface LeadInsightsProps {
  lead: {
    lead_score?: number | null;
    interest_level?: number | null;
    metadata?: {
      qualification_status?: string;
      ai_insights?: string[];
      suggested_actions?: string[];
      scored_at?: string;
    } | null;
    notes?: string | null;
  };
}

export function LeadInsightsCard({ lead }: LeadInsightsProps) {
  const score = lead.lead_score ?? 0;
  const metadata = lead.metadata as LeadInsightsProps['lead']['metadata'];
  const qualificationStatus = metadata?.qualification_status ?? 'unqualified';
  const aiInsights = metadata?.ai_insights ?? [];
  const suggestedActions = metadata?.suggested_actions ?? [];

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    if (s >= 60) return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
    if (s >= 40) return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
    return 'text-muted-foreground bg-muted';
  };

  const qualBadge: Record<string, { variant: 'destructive' | 'default' | 'secondary' | 'outline'; label: string }> = {
    hot: { variant: 'destructive', label: '🔥 Hot Lead' },
    warm: { variant: 'default', label: '⚡ Warm Lead' },
    cold: { variant: 'secondary', label: '❄️ Cold Lead' },
    unqualified: { variant: 'outline', label: 'Unqualified' },
  };

  const badge = qualBadge[qualificationStatus] ?? qualBadge.unqualified;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Lead Insights
          </CardTitle>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Circle */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold ${getScoreColor(score)}`}>
            {score}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Lead Score</p>
            <p className="text-xs text-muted-foreground">
              {score >= 80 ? 'Excellent prospect' : score >= 60 ? 'Good potential' : score >= 40 ? 'Needs nurturing' : 'Low priority'}
            </p>
            {lead.interest_level != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Interest: {'★'.repeat(lead.interest_level)}{'☆'.repeat(Math.max(0, 5 - lead.interest_level))}
              </p>
            )}
          </div>
        </div>

        {/* Reasoning */}
        {lead.notes && (
          <div className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
            {lead.notes}
          </div>
        )}

        {/* AI Insights */}
        {aiInsights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2 text-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
              Key Insights
            </h4>
            <ul className="space-y-1">
              {aiInsights.map((insight: string, i: number) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2 text-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Recommended Actions
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7">
                <Calendar className="h-3 w-3 mr-1" />
                Schedule Follow-up
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7">
                <Mail className="h-3 w-3 mr-1" />
                Send Email
              </Button>
            </div>
          </div>
        )}

        {/* Scored timestamp */}
        {metadata?.scored_at && (
          <p className="text-[10px] text-muted-foreground text-right">
            Scored {new Date(metadata.scored_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
