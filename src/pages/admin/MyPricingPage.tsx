import { useEffect, useState, useMemo, useCallback } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  DollarSign, Percent, TrendingUp, Zap, Pencil, Trash2, Check, X,
  Download, Lightbulb, Phone, MessageSquare, Share2, Package, History,
} from "lucide-react";

interface ServiceRow {
  id: string;
  name: string;
  category: string;
  base_price: number;
  base_pricing_model: string;
  pricing_id: string | null;
  markup_percentage: number | null;
  custom_price_per_unit: number | null;
  is_custom_pricing: boolean | null;
  clients_using: number;
}

const UNIT_LABELS: Record<string, string> = {
  per_minute: "minute", per_call: "call", per_message: "message", monthly: "month",
};

const CAT_BADGES: Record<string, { label: string; className: string }> = {
  voice: { label: "Voice", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  messaging: { label: "Messaging", className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  social_media: { label: "Social Media", className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
};

const TEMPLATES = [
  { label: "Conservative (20%)", value: 20 },
  { label: "Standard (40%)", value: 40 },
  { label: "Premium (60%)", value: 60 },
];

export default function MyPricingPage() {
  const { admin, primaryColor } = useAdmin();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Modals
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBulkMarkup, setShowBulkMarkup] = useState(false);

  // Quick setup state
  const [setupMethod, setSetupMethod] = useState<"all" | "category" | "template">("all");
  const [setupAllMarkup, setSetupAllMarkup] = useState("");
  const [setupVoice, setSetupVoice] = useState("");
  const [setupMessaging, setSetupMessaging] = useState("");
  const [setupSocial, setSetupSocial] = useState("");
  const [setupTemplate, setSetupTemplate] = useState<string>("");
  const [setupStep, setSetupStep] = useState(1);
  const [isApplying, setIsApplying] = useState(false);

  // Bulk markup
  const [bulkMarkup, setBulkMarkup] = useState("");

  // History
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (admin) fetchData();
  }, [admin]);

  async function fetchData() {
    if (!admin) return;
    setIsLoading(true);

    const [servicesRes, pricingRes, clientsRes] = await Promise.all([
      supabase.from("services").select("id, name, category, base_price, base_pricing_model").eq("is_active", true).order("category").order("name"),
      supabase.from("admin_pricing").select("id, service_id, markup_percentage, custom_price_per_unit, is_custom_pricing").eq("admin_id", admin.id),
      supabase.from("clients").select("id").eq("admin_id", admin.id),
    ]);

    const clientIds = clientsRes.data?.map(c => c.id) || [];
    let csData: any[] = [];
    if (clientIds.length > 0) {
      const { data } = await supabase.from("client_services").select("service_id").in("client_id", clientIds).eq("is_active", true);
      csData = data || [];
    }

    const csCount = new Map<string, number>();
    csData.forEach(r => csCount.set(r.service_id, (csCount.get(r.service_id) || 0) + 1));

    const pMap = new Map(pricingRes.data?.map((p: any) => [p.service_id, p]) || []);

    setRows((servicesRes.data || []).map((s: any) => {
      const p = pMap.get(s.id) as any;
      return {
        ...s,
        pricing_id: p?.id || null,
        markup_percentage: p?.markup_percentage ?? null,
        custom_price_per_unit: p?.custom_price_per_unit ?? null,
        is_custom_pricing: p?.is_custom_pricing ?? null,
        clients_using: csCount.get(s.id) || 0,
      };
    }));
    setIsLoading(false);
  }

  // Summary stats
  const stats = useMemo(() => {
    const withPricing = rows.filter(r => r.pricing_id);
    const avgMarkup = withPricing.length
      ? withPricing.reduce((s, r) => s + (r.markup_percentage || 0), 0) / withPricing.length
      : 0;
    const potentialRevenue = rows.reduce((s, r) => {
      const price = r.custom_price_per_unit || r.base_price;
      return s + price * 500; // estimate 500 units/mo
    }, 0);
    return {
      configured: withPricing.length,
      total: rows.length,
      pct: rows.length ? Math.round((withPricing.length / rows.length) * 100) : 0,
      avgMarkup: Math.round(avgMarkup * 10) / 10,
      potentialRevenue,
    };
  }, [rows]);

  const unitLabel = (m: string) => UNIT_LABELS[m] || m;

  // Inline edit
  const startEdit = (row: ServiceRow) => {
    setEditingId(row.id);
    setEditValue(row.markup_percentage != null ? String(row.markup_percentage) : "");
  };

  const cancelEdit = () => { setEditingId(null); setEditValue(""); };

  const saveInlineEdit = async (row: ServiceRow) => {
    if (!admin) return;
    const markup = parseFloat(editValue);
    if (isNaN(markup) || markup < 0) { toast({ title: "Invalid markup", variant: "destructive" }); return; }

    const price = row.base_price * (1 + markup / 100);
    const payload = {
      admin_id: admin.id,
      service_id: row.id,
      markup_percentage: markup,
      custom_price_per_unit: price,
      is_custom_pricing: false,
    };

    try {
      if (row.pricing_id) {
        const { error } = await supabase.from("admin_pricing").update(payload).eq("id", row.pricing_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admin_pricing").insert(payload);
        if (error) throw error;
      }
      toast({ title: `Markup updated for ${row.name}` });
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Remove pricing
  const removePricing = async (row: ServiceRow) => {
    if (!row.pricing_id) return;
    const { error } = await supabase.from("admin_pricing").delete().eq("id", row.pricing_id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Pricing removed for ${row.name}` });
    fetchData();
  };

  // Selection
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.id)));
  };

  // Bulk apply markup
  const applyBulkMarkup = async () => {
    if (!admin) return;
    const markup = parseFloat(bulkMarkup);
    if (isNaN(markup) || markup < 0) return;
    setIsApplying(true);

    try {
      const targets = rows.filter(r => selected.has(r.id));
      for (const row of targets) {
        const price = row.base_price * (1 + markup / 100);
        const payload = { admin_id: admin.id, service_id: row.id, markup_percentage: markup, custom_price_per_unit: price, is_custom_pricing: false };
        if (row.pricing_id) {
          await supabase.from("admin_pricing").update(payload).eq("id", row.pricing_id);
        } else {
          await supabase.from("admin_pricing").insert(payload);
        }
      }
      toast({ title: `Markup applied to ${targets.length} services` });
      setShowBulkMarkup(false);
      setSelected(new Set());
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  // Bulk remove
  const bulkRemove = async () => {
    const targets = rows.filter(r => selected.has(r.id) && r.pricing_id);
    if (!targets.length) return;
    const ids = targets.map(r => r.pricing_id!);
    const { error } = await supabase.from("admin_pricing").delete().in("id", ids);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Pricing removed from ${targets.length} services` });
    setSelected(new Set());
    fetchData();
  };

  // Quick setup apply
  const getSetupPreviews = useCallback((): { id: string; name: string; base: number; model: string; markup: number; price: number; profit: number }[] => {
    let getMarkup: (cat: string) => number;
    if (setupMethod === "all") {
      const m = parseFloat(setupAllMarkup);
      getMarkup = () => (isNaN(m) ? 0 : m);
    } else if (setupMethod === "category") {
      getMarkup = (cat) => {
        if (cat === "voice") return parseFloat(setupVoice) || 0;
        if (cat === "messaging") return parseFloat(setupMessaging) || 0;
        return parseFloat(setupSocial) || 0;
      };
    } else {
      const t = TEMPLATES.find(t => t.label === setupTemplate);
      getMarkup = () => t?.value || 0;
    }

    return rows.map(r => {
      const markup = getMarkup(r.category);
      const price = r.base_price * (1 + markup / 100);
      return { id: r.id, name: r.name, base: r.base_price, model: r.base_pricing_model, markup, price, profit: price - r.base_price };
    });
  }, [rows, setupMethod, setupAllMarkup, setupVoice, setupMessaging, setupSocial, setupTemplate]);

  const applyQuickSetup = async () => {
    if (!admin) return;
    setIsApplying(true);
    const previews = getSetupPreviews();

    try {
      for (const p of previews) {
        const existing = rows.find(r => r.id === p.id);
        const payload = { admin_id: admin.id, service_id: p.id, markup_percentage: p.markup, custom_price_per_unit: p.price, is_custom_pricing: false };
        if (existing?.pricing_id) {
          await supabase.from("admin_pricing").update(payload).eq("id", existing.pricing_id);
        } else {
          await supabase.from("admin_pricing").insert(payload);
        }
      }
      toast({ title: `Pricing applied to ${previews.length} services` });
      setShowQuickSetup(false);
      setSetupStep(1);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  // History
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_type", "admin_pricing")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistoryData(data || []);
    setIsLoadingHistory(false);
  };

  // Export CSV
  const exportCSV = () => {
    const header = "Service Name,Category,Base Price,Pricing Model,Markup %,Your Price,Profit,Clients Using\n";
    const csvRows = rows.map(r => {
      const yourPrice = r.custom_price_per_unit || r.base_price;
      const profit = yourPrice - r.base_price;
      return `"${r.name}","${r.category}","${r.base_price}","${r.base_pricing_model}","${r.markup_percentage ?? 'N/A'}","${yourPrice}","${profit}","${r.clients_using}"`;
    }).join("\n");
    const blob = new Blob([header + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-pricing.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Recommendation
  const recommendation = useMemo(() => {
    const lowMarkup = rows.find(r => r.pricing_id && (r.markup_percentage || 0) < 25 && r.clients_using > 0);
    if (lowMarkup) return `💡 Consider increasing ${lowMarkup.name} markup to 35%+ based on demand (${lowMarkup.clients_using} active clients).`;
    const unpriced = rows.filter(r => !r.pricing_id);
    if (unpriced.length > 0) return `💡 ${unpriced.length} service(s) don't have pricing set yet. Use Quick Setup to configure them all at once.`;
    return null;
  }, [rows]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Pricing</h1>
          <p className="text-sm text-muted-foreground">Manage your pricing and markup for all services</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowHistory(true); fetchHistory(); }}>
            <History className="h-4 w-4 mr-1" /> History
          </Button>
          <Button size="sm" onClick={() => { setShowQuickSetup(true); setSetupStep(1); }}>
            <Zap className="h-4 w-4 mr-1" /> Quick Setup
          </Button>
        </div>
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="flex items-start gap-2 rounded-md border border-border p-3 bg-muted/30">
          <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
          <p className="text-sm text-muted-foreground">{recommendation}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <DollarSign className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Services with Pricing</p>
                <p className="text-xl font-bold">{stats.configured} of {stats.total}</p>
              </div>
            </div>
            <Progress value={stats.pct} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <Percent className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average Markup</p>
                <p className="text-xl font-bold">{stats.avgMarkup}%</p>
                <p className="text-[10px] text-muted-foreground">Industry average: 35%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <TrendingUp className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Potential Monthly Revenue</p>
                <p className="text-xl font-bold">₹{stats.potentialRevenue.toLocaleString("en-IN")}</p>
                <p className="text-[10px] text-muted-foreground">Based on current pricing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => { setBulkMarkup(""); setShowBulkMarkup(true); }}>
            <Percent className="h-3.5 w-3.5 mr-1" /> Apply Markup
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={bulkRemove}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Pricing
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
        </div>
      )}

      {/* Pricing Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === rows.length && rows.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Your Markup</TableHead>
                  <TableHead>Your Price</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const yourPrice = row.custom_price_per_unit || row.base_price;
                  const profit = yourPrice - row.base_price;
                  const cat = CAT_BADGES[row.category];
                  const isEditing = editingId === row.id;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${cat?.className || ""}`}>
                            {cat?.label || row.category}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        ₹{row.base_price.toLocaleString("en-IN")} / {unitLabel(row.base_pricing_model)}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              className="w-20 h-8 text-sm"
                              type="number"
                              min={0}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveInlineEdit(row);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveInlineEdit(row)}>
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : row.pricing_id ? (
                          <button
                            className="flex items-center gap-1 text-sm hover:underline cursor-pointer"
                            onClick={() => startEdit(row)}
                          >
                            {(row.markup_percentage || 0).toFixed(1)}%
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        ) : (
                          <button
                            className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer hover:underline"
                            onClick={() => startEdit(row)}
                          >
                            Not set <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.pricing_id ? (
                          <span className="text-green-700 dark:text-green-400">
                            ₹{yourPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })} / {unitLabel(row.base_pricing_model)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.pricing_id ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300">
                            ₹{profit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{row.clients_using}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.pricing_id && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removePricing(row)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Export button at bottom */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Export Pricing (CSV)
        </Button>
      </div>

      {/* Quick Setup Modal */}
      <Dialog open={showQuickSetup} onOpenChange={(o) => { if (!o) { setShowQuickSetup(false); setSetupStep(1); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Setup</DialogTitle>
            <DialogDescription>
              {setupStep === 1 ? "Choose how to set pricing for all services" : setupStep === 2 ? "Preview your new pricing" : "Confirm and apply"}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 1 && (
            <RadioGroup value={setupMethod} onValueChange={(v) => setSetupMethod(v as any)} className="space-y-5">
              {/* All same */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="sa" />
                  <Label htmlFor="sa" className="font-medium">Same markup for all services</Label>
                </div>
                {setupMethod === "all" && (
                  <div className="pl-6">
                    <Input type="number" min={0} max={500} placeholder="e.g., 40" value={setupAllMarkup} onChange={(e) => setSetupAllMarkup(e.target.value)} className="w-32" />
                    <p className="text-xs text-muted-foreground mt-1">Markup percentage applied to all</p>
                  </div>
                )}
              </div>
              <Separator />
              {/* By category */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="category" id="sc" />
                  <Label htmlFor="sc" className="font-medium">By category</Label>
                </div>
                {setupMethod === "category" && (
                  <div className="pl-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-600" />
                      <Label className="w-24 text-sm">Voice</Label>
                      <Input type="number" min={0} placeholder="%" value={setupVoice} onChange={(e) => setSetupVoice(e.target.value)} className="w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      <Label className="w-24 text-sm">Messaging</Label>
                      <Input type="number" min={0} placeholder="%" value={setupMessaging} onChange={(e) => setSetupMessaging(e.target.value)} className="w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-purple-600" />
                      <Label className="w-24 text-sm">Social Media</Label>
                      <Input type="number" min={0} placeholder="%" value={setupSocial} onChange={(e) => setSetupSocial(e.target.value)} className="w-24" />
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              {/* Template */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="template" id="st" />
                  <Label htmlFor="st" className="font-medium">From template</Label>
                </div>
                {setupMethod === "template" && (
                  <div className="pl-6">
                    <Select value={setupTemplate} onValueChange={setSetupTemplate}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATES.map(t => (
                          <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </RadioGroup>
          )}

          {setupStep === 2 && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {getSetupPreviews().map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                  <span className="font-medium">{p.name}</span>
                  <div className="text-right">
                    <span className="text-green-600 font-medium">₹{p.price.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground ml-2">(+{p.markup}%)</span>
                  </div>
                </div>
              ))}
              <div className="rounded bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total estimated profit (500 units each)</p>
                <p className="text-lg font-bold text-green-600">
                  ₹{getSetupPreviews().reduce((s, p) => s + p.profit * 500, 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {setupStep === 1 && (
              <Button onClick={() => setSetupStep(2)}>Preview Changes</Button>
            )}
            {setupStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setSetupStep(1)}>Back</Button>
                <Button onClick={applyQuickSetup} disabled={isApplying}>
                  {isApplying ? "Applying..." : "Apply to All"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Markup Modal */}
      <Dialog open={showBulkMarkup} onOpenChange={setShowBulkMarkup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply Markup to {selected.size} services</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Markup Percentage (%)</Label>
            <Input type="number" min={0} max={500} placeholder="e.g., 40" value={bulkMarkup} onChange={(e) => setBulkMarkup(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkMarkup(false)}>Cancel</Button>
            <Button onClick={applyBulkMarkup} disabled={isApplying}>{isApplying ? "Applying..." : "Apply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pricing History</DialogTitle>
            <DialogDescription>Recent pricing changes</DialogDescription>
          </DialogHeader>
          {isLoadingHistory ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : historyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pricing history found.</p>
          ) : (
            <div className="space-y-3">
              {historyData.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 border-b border-border pb-3">
                  <History className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">{log.action}</p>
                    {log.old_values?.markup_percentage != null && log.new_values?.markup_percentage != null && (
                      <p className="text-xs text-muted-foreground">
                        Markup: {log.old_values.markup_percentage}% → {log.new_values.markup_percentage}%
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
