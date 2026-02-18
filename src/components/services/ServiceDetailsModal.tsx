import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, Lock, Send, Star, Sparkles, IndianRupee } from "lucide-react";
import type { CatalogService } from "@/hooks/useServiceCatalog";
import { getServiceFeatures } from "@/lib/service-features";
import { getRouteSlug } from "@/lib/service-routes";

interface ServiceDetailsModalProps {
  service: CatalogService | null;
  open: boolean;
  onClose: () => void;
  onRequestAccess: (service: CatalogService, planId?: string) => void;
  primaryColor: string;
}

export function ServiceDetailsModal({
  service, open, onClose, onRequestAccess, primaryColor,
}: ServiceDetailsModalProps) {
  if (!service) return null;

  const features = getServiceFeatures(getRouteSlug(service.slug));
  const hasPendingRequest = service.request_status === "pending";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {service.icon_url ? (
              <img src={service.icon_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Sparkles className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
            )}
            <div>
              <DialogTitle className="text-lg">{service.name}</DialogTitle>
              <DialogDescription className="text-xs">
                <Badge variant="outline" className="capitalize">{service.category}</Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {service.description && (
          <p className="text-sm text-muted-foreground">{service.description}</p>
        )}

        <Separator />

        {/* Features */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Star className="h-4 w-4" style={{ color: primaryColor }} />
            Features Included
          </h4>
          <div className="grid gap-2">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                <span className="text-foreground">{f}</span>
              </div>
            ))}
            {features.length === 0 && (
              <p className="text-xs text-muted-foreground">Feature details coming soon.</p>
            )}
          </div>
        </div>

        {/* Plans (for locked services) */}
        {service.is_locked && service.available_plans.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <IndianRupee className="h-4 w-4" style={{ color: primaryColor }} />
                Available Plans
              </h4>
              <div className="grid gap-3">
                {service.available_plans.map((plan) => (
                  <Card key={plan.id} className="border-dashed">
                    <CardContent className="pt-4 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{plan.plan_name}</p>
                          {plan.plan_tier && (
                            <Badge variant="secondary" className="text-[10px] capitalize mt-0.5">
                              {plan.plan_tier}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {plan.price_per_unit != null && (
                            <p className="text-sm font-bold">
                              ₹{plan.price_per_unit}<span className="text-xs font-normal text-muted-foreground">/unit</span>
                            </p>
                          )}
                          {plan.monthly_price != null && (
                            <p className="text-xs text-muted-foreground">
                              ₹{plan.monthly_price.toLocaleString()}/mo
                            </p>
                          )}
                        </div>
                      </div>
                      {plan.usage_limit != null && (
                        <p className="text-xs text-muted-foreground">
                          {plan.usage_limit.toLocaleString()} units/month
                        </p>
                      )}
                      {!hasPendingRequest && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs mt-2"
                          onClick={() => onRequestAccess(service, plan.id)}
                        >
                          <Send className="mr-1 h-3 w-3" />
                          Request This Plan
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Action buttons */}
        <div className="flex gap-2">
          {service.is_locked ? (
            hasPendingRequest ? (
              <Button disabled className="flex-1" variant="secondary">
                ⏳ Request Pending
              </Button>
            ) : (
              <Button
                className="flex-1 text-white"
                style={{ backgroundColor: primaryColor }}
                onClick={() => onRequestAccess(service)}
              >
                <Send className="mr-2 h-4 w-4" />
                Request Access
              </Button>
            )
          ) : (
            <Badge className="text-sm px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600">
              ✓ Active
            </Badge>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
