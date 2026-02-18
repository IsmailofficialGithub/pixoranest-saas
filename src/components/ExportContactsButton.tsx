import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { exportToCSV } from '@/lib/csv-parser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExportContactsButtonProps {
  campaignId?: string;
}

export function ExportContactsButton({ campaignId }: ExportContactsButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let query = supabase
        .from('campaign_contacts')
        .select('phone_number, contact_name, call_status, contact_data');

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No contacts to export');
        return;
      }

      const exportData = data.map((contact) => ({
        phone_number: contact.phone_number,
        name: contact.contact_name || '',
        call_status: contact.call_status || 'pending',
      }));

      const filename = campaignId
        ? `campaign-contacts-${new Date().toISOString().split('T')[0]}.csv`
        : `all-contacts-${new Date().toISOString().split('T')[0]}.csv`;

      exportToCSV(exportData, filename);
      toast.success(`Exported ${data.length} contacts`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export contacts');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={isExporting} variant="outline">
      {isExporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Export CSV
    </Button>
  );
}
