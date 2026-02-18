import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/contexts/ClientContext";
import { toast } from "sonner";
import type { CatalogService } from "@/hooks/useServiceCatalog";

interface RequestAccessDialogProps {
  service: CatalogService | null;
  preselectedPlanId?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  primaryColor: string;
}

export function RequestAccessDialog({
  service, preselectedPlanId, open, onClose, onSuccess, primaryColor,
}: RequestAccessDialogProps) {
  const { client } = useClient();
  const [planId, setPlanId] = useState<string | undefined>(preselectedPlanId);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!service || !client) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Insert purchase request
      const { error } = await supabase.from("service_purchase_requests" as any).insert({
        client_id: client.id,
        service_id: service.id,
        plan_id: planId || null,
        message: message.trim() || null,
        admin_id: client.admin_id,
        status: "pending",
      });

      if (error) throw error;

      // Notify admin
      const { data: admin } = await supabase
        .from("admins")
        .select("user_id")
        .eq("id", client.admin_id)
        .maybeSingle();

      if (admin) {
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: "Service Access Request",
          message: `${client.company_name} requested access to "${service.name}".`,
          type: "info" as const,
          action_url: `/admin/clients/${client.id}`,
        });
      }

      toast.success("Access request submitted successfully!");
      setMessage("");
      setPlanId(undefined);
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err?.code === "23505") {
        toast.error("You already have a pending request for this service.");
      } else {
        toast.error("Failed to submit request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Access</DialogTitle>
          <DialogDescription>
            Request access to <strong>{service.name}</strong>. Your administrator will review and approve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan selection */}
          {service.available_plans.length > 0 && (
            <div className="space-y-2">
              <Label>Preferred Plan (optional)</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan..." />
                </SelectTrigger>
                <SelectContent>
                  {service.available_plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.plan_name}
                      {p.monthly_price != null && ` — ₹${p.monthly_price.toLocaleString()}/mo`}
                      {p.price_per_unit != null && ` — ₹${p.price_per_unit}/unit`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label>Message to Admin (optional)</Label>
            <Textarea
              placeholder="Tell your admin why you need this service..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
