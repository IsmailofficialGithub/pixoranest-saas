import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface ServicePlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string;
  serviceName: string;
  pricingModel: string;
}

interface PlanRow {
  id: string;
  plan_name: string;
  plan_tier: string | null;
  usage_limit: number | null;
  price_per_unit: number | null;
  monthly_price: number | null;
  features_included: any;
  is_active: boolean;
  created_at: string;
  client_count: number;
}

type PlanTier = "basic" | "standard" | "premium" | "enterprise";

const tierOrder: Record<string, number> = { basic: 1, standard: 2, premium: 3, enterprise: 4 };
const tierColors: Record<string, string> = {
  basic: "bg-gray-100 text-gray-700",
  standard: "bg-blue-100 text-blue-700",
  premium: "bg-amber-100 text-amber-700",
  enterprise: "bg-purple-100 text-purple-700",
};

const emptyForm = {
  plan_name: "",
  plan_tier: "basic" as PlanTier,
  pricing_type: "usage" as "usage" | "monthly",
  price_per_unit: "",
  monthly_price: "",
  usage_limit: "",
  features: [] as string[],
  is_active: true,
};

function pricingUnitLabel(model: string) {
  switch (model) {
    case "per_minute": return "minute";
    case "per_call": return "call";
    case "per_message": return "message";
    default: return "unit";
  }
}

export default function ServicePlansDialog({ open, onOpenChange, serviceId, serviceName, pricingModel }: ServicePlansDialogProps) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_plans")
      .select("*")
      .eq("service_id", serviceId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const enriched: PlanRow[] = await Promise.all(
      (data ?? []).map(async (p) => {
        const { count } = await supabase
          .from("client_services")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", p.id);
        return { ...p, client_count: count ?? 0 };
      })
    );

    enriched.sort((a, b) => (tierOrder[a.plan_tier ?? "basic"] ?? 5) - (tierOrder[b.plan_tier ?? "basic"] ?? 5));
    setPlans(enriched);
    setLoading(false);
  }, [serviceId, toast]);

  useEffect(() => {
    if (open) fetchPlans();
  }, [open, fetchPlans]);

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setNewFeature("");
    setFormOpen(true);
  };

  const openEdit = (plan: PlanRow) => {
    const features = Array.isArray(plan.features_included)
      ? (plan.features_included as any[]).map((f: any) => (typeof f === "string" ? f : f.name ?? ""))
      : [];

    setEditId(plan.id);
    setForm({
      plan_name: plan.plan_name,
      plan_tier: (plan.plan_tier ?? "basic") as PlanTier,
      pricing_type: plan.monthly_price && Number(plan.monthly_price) > 0 ? "monthly" : "usage",
      price_per_unit: plan.price_per_unit ? String(plan.price_per_unit) : "",
      monthly_price: plan.monthly_price ? String(plan.monthly_price) : "",
      usage_limit: plan.usage_limit ? String(plan.usage_limit) : "",
      features,
      is_active: plan.is_active,
    });
    setNewFeature("");
    setFormOpen(true);
  };

  const addFeature = () => {
    const trimmed = newFeature.trim();
    if (trimmed && !form.features.includes(trimmed)) {
      setForm((f) => ({ ...f, features: [...f.features, trimmed] }));
      setNewFeature("");
    }
  };

  const removeFeature = (idx: number) => {
    setForm((f) => ({ ...f, features: f.features.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.plan_name.trim()) {
      toast({ title: "Plan name is required", variant: "destructive" });
      return;
    }
    setSaving(true);

    const payload = {
      service_id: serviceId,
      plan_name: form.plan_name.trim(),
      plan_tier: form.plan_tier as any,
      price_per_unit: form.pricing_type === "usage" && form.price_per_unit ? Number(form.price_per_unit) : null,
      monthly_price: form.pricing_type === "monthly" && form.monthly_price ? Number(form.monthly_price) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      features_included: form.features.map((name) => ({ name })),
      is_active: form.is_active,
    };

    let error;
    if (editId) {
      const { error: e } = await supabase.from("service_plans").update(payload).eq("id", editId);
      error = e;
    } else {
      const { error: e } = await supabase.from("service_plans").insert(payload);
      error = e;
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Plan ${editId ? "updated" : "created"} successfully` });
      setFormOpen(false);
      fetchPlans();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("service_plans").update({ is_active: false }).eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plan deactivated" });
      fetchPlans();
    }
    setDeleteTarget(null);
  };

  const unit = pricingUnitLabel(pricingModel);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Plans — {serviceName}</DialogTitle>
            <DialogDescription>Create and manage pricing plans for this service</DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Plan</Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
          ) : plans.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No plans created yet.</p>
              <Button className="mt-3" size="sm" onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Create First Plan</Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => {
                const tc = tierColors[plan.plan_tier ?? "basic"] ?? tierColors.basic;
                const features = Array.isArray(plan.features_included)
                  ? (plan.features_included as any[]).map((f: any) => (typeof f === "string" ? f : f.name ?? ""))
                  : [];

                return (
                  <Card key={plan.id} className={`relative flex flex-col ${!plan.is_active ? "opacity-60" : ""}`}>
                    {plan.plan_tier === "standard" && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <Badge className="bg-amber-500 text-white hover:bg-amber-500"><Star className="mr-1 h-3 w-3" /> Popular</Badge>
                      </div>
                    )}
                    <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground">{plan.plan_name}</h4>
                        <Badge className={`${tc} border-0 capitalize`}>{plan.plan_tier ?? "basic"}</Badge>
                      </div>

                      <div className="text-2xl font-bold text-foreground">
                        {plan.monthly_price && Number(plan.monthly_price) > 0
                          ? <>₹{Number(plan.monthly_price).toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/month</span></>
                          : plan.price_per_unit
                            ? <>₹{Number(plan.price_per_unit).toFixed(2)}<span className="text-sm font-normal text-muted-foreground"> per {unit}</span></>
                            : "Free"}
                      </div>

                      {plan.usage_limit && (
                        <p className="text-sm text-muted-foreground">{plan.usage_limit.toLocaleString()} {unit}s/month</p>
                      )}

                      {features.length > 0 && (
                        <ul className="space-y-1.5">
                          {features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="text-xs text-muted-foreground">{plan.client_count} client{plan.client_count !== 1 ? "s" : ""} assigned</p>

                      <div className="mt-auto flex gap-2 border-t pt-3">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(plan)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(plan)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Plan Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Plan" : "Add Plan"}</DialogTitle>
            <DialogDescription>{editId ? "Update plan details" : "Create a new pricing plan"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Plan Name *</Label>
              <Input placeholder="e.g., Standard Telecaller" value={form.plan_name} onChange={(e) => setForm((f) => ({ ...f, plan_name: e.target.value }))} />
            </div>

            <div>
              <Label>Plan Tier *</Label>
              <Select value={form.plan_tier} onValueChange={(v) => setForm((f) => ({ ...f, plan_tier: v as PlanTier }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pricing Type</Label>
              <RadioGroup value={form.pricing_type} onValueChange={(v) => setForm((f) => ({ ...f, pricing_type: v as any }))} className="mt-2 flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="usage" id="pt-usage" />
                  <Label htmlFor="pt-usage" className="font-normal">Usage-based</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="monthly" id="pt-monthly" />
                  <Label htmlFor="pt-monthly" className="font-normal">Monthly subscription</Label>
                </div>
              </RadioGroup>
            </div>

            {form.pricing_type === "usage" ? (
              <div>
                <Label>Price per {unit} (₹)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.price_per_unit} onChange={(e) => setForm((f) => ({ ...f, price_per_unit: e.target.value }))} />
              </div>
            ) : (
              <div>
                <Label>Monthly Price (₹)</Label>
                <Input type="number" min="0" step="1" placeholder="0" value={form.monthly_price} onChange={(e) => setForm((f) => ({ ...f, monthly_price: e.target.value }))} />
              </div>
            )}

            <div>
              <Label>Usage Limit {form.pricing_type === "monthly" ? "(optional)" : ""}</Label>
              <Input type="number" min="0" step="1" placeholder={`e.g., 500 ${unit}s`} value={form.usage_limit} onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))} />
            </div>

            <div>
              <Label>Features Included</Label>
              <div className="mt-2 space-y-2">
                {form.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                    <span className="flex-1 text-sm text-foreground">{feat}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFeature(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a feature..."
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                  />
                  <Button variant="outline" size="sm" onClick={addFeature} disabled={!newFeature.trim()}>Add</Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="plan-active" checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label htmlFor="plan-active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.plan_name.trim()}>
              {saving ? "Saving..." : editId ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deleteTarget?.plan_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.client_count > 0
                ? `This plan is assigned to ${deleteTarget.client_count} client(s). It will be deactivated but existing assignments remain.`
                : "This plan will be deactivated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
