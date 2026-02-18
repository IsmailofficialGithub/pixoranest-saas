import { useEffect, useState, useRef } from "react";
import { X, Plus, Upload, Image as ImageIcon } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Json } from "@/integrations/supabase/types";

type Service = Tables<"services">;

interface Feature {
  name: string;
  description: string;
}

interface ServiceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editService?: Service | null;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function ServiceFormModal({ open, onClose, onSaved, editService }: ServiceFormModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [pricingModel, setPricingModel] = useState<string>("");
  const [basePrice, setBasePrice] = useState("");
  const [setupInstructions, setSetupInstructions] = useState("");
  const [features, setFeatures] = useState<Feature[]>([{ name: "", description: "" }]);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!editService;

  // Populate form when editing
  useEffect(() => {
    if (editService) {
      setName(editService.name);
      setSlug(editService.slug);
      setDescription(editService.description ?? "");
      setCategory(editService.category);
      setPricingModel(editService.base_pricing_model);
      setBasePrice(String(editService.base_price));
      setSetupInstructions(editService.setup_instructions ?? "");
      setIconUrl(editService.icon_url);
      setIconPreview(editService.icon_url);
      const parsed = Array.isArray(editService.features) ? editService.features : [];
      setFeatures(
        parsed.length > 0
          ? (parsed as unknown as Feature[])
          : [{ name: "", description: "" }]
      );
    } else {
      resetForm();
    }
  }, [editService, open]);

  function resetForm() {
    setName("");
    setSlug("");
    setDescription("");
    setCategory("");
    setPricingModel("");
    setBasePrice("");
    setSetupInstructions("");
    setFeatures([{ name: "", description: "" }]);
    setIconUrl(null);
    setIconFile(null);
    setIconPreview(null);
    setErrors({});
  }

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEdit) {
      setSlug(slugify(name));
    }
  }, [name, isEdit]);

  function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  }

  function addFeature() {
    setFeatures((prev) => [...prev, { name: "", description: "" }]);
  }

  function removeFeature(index: number) {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFeature(index: number, field: keyof Feature, value: string) {
    setFeatures((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Service name is required";
    if (!slug.trim()) errs.slug = "Slug is required";
    else if (!slugRegex.test(slug)) errs.slug = "Slug must be lowercase with hyphens only";
    if (!description.trim()) errs.description = "Description is required";
    if (!category) errs.category = "Category is required";
    if (!pricingModel) errs.pricingModel = "Pricing model is required";
    const price = parseFloat(basePrice);
    if (isNaN(price) || price <= 0) errs.basePrice = "Price must be greater than 0";
    const validFeatures = features.filter((f) => f.name.trim());
    if (validFeatures.length === 0) errs.features = "At least 1 feature is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function uploadIcon(): Promise<string | null> {
    if (!iconFile) return iconUrl;
    const ext = iconFile.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("service-icons")
      .upload(path, iconFile, { upsert: true });
    if (error) throw new Error("Icon upload failed: " + error.message);
    const { data } = supabase.storage.from("service-icons").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      // Check slug uniqueness
      const { data: existing } = await supabase
        .from("services")
        .select("id")
        .eq("slug", slug)
        .neq("id", editService?.id ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle();
      if (existing) {
        setErrors((prev) => ({ ...prev, slug: "This slug is already taken" }));
        setSaving(false);
        return;
      }

      const uploadedIconUrl = await uploadIcon();
      const validFeatures = features.filter((f) => f.name.trim());

      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        category: category as "voice" | "messaging" | "social_media",
        base_pricing_model: pricingModel as "per_minute" | "per_call" | "per_message" | "monthly",
        base_price: parseFloat(basePrice),
        features: JSON.parse(JSON.stringify(validFeatures)) as Json,
        setup_instructions: setupInstructions.trim() || null,
        icon_url: uploadedIconUrl,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("services")
          .update(payload)
          .eq("id", editService!.id);
        if (error) throw error;
        toast({ title: "Service updated successfully" });
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
        toast({ title: "Service created successfully" });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Service" : "Add New Service"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Service Name *</Label>
            <Input
              id="name"
              placeholder="e.g., AI Voice Telecaller"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (URL-friendly) *</Label>
            <Input
              id="slug"
              placeholder="ai-voice-telecaller"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description *</Label>
            <Textarea
              id="desc"
              rows={4}
              placeholder="Describe what this service does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* Category + Pricing model row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice">Voice</SelectItem>
                  <SelectItem value="messaging">Messaging</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Base Pricing Model *</Label>
              <Select value={pricingModel} onValueChange={setPricingModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_minute">Per Minute</SelectItem>
                  <SelectItem value="per_call">Per Call</SelectItem>
                  <SelectItem value="per_message">Per Message</SelectItem>
                  <SelectItem value="monthly">Monthly Subscription</SelectItem>
                </SelectContent>
              </Select>
              {errors.pricingModel && <p className="text-xs text-destructive">{errors.pricingModel}</p>}
            </div>
          </div>

          {/* Base Price */}
          <div className="space-y-1.5">
            <Label htmlFor="price">Base Price (₹) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                className="pl-7"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
              />
            </div>
            {errors.basePrice && <p className="text-xs text-destructive">{errors.basePrice}</p>}
          </div>

          {/* Icon Upload */}
          <div className="space-y-1.5">
            <Label>Service Icon</Label>
            <div className="flex items-center gap-4">
              {iconPreview ? (
                <div className="relative h-14 w-14 shrink-0 rounded-lg border bg-muted">
                  <img src={iconPreview} alt="Icon" className="h-full w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => { setIconFile(null); setIconPreview(null); setIconUrl(null); }}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50"
                >
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {iconPreview ? "Change" : "Upload"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleIconChange}
              />
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label>Features *</Label>
            {errors.features && <p className="text-xs text-destructive">{errors.features}</p>}
            <div className="space-y-2">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    placeholder="Feature name"
                    className="flex-1"
                    value={f.name}
                    onChange={(e) => updateFeature(i, "name", e.target.value)}
                  />
                  <Input
                    placeholder="Description"
                    className="flex-1"
                    value={f.description}
                    onChange={(e) => updateFeature(i, "description", e.target.value)}
                  />
                  {features.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFeature(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addFeature}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Feature
            </Button>
          </div>

          {/* Setup Instructions */}
          <div className="space-y-1.5">
            <Label htmlFor="setup">Setup Instructions</Label>
            <Textarea
              id="setup"
              rows={3}
              placeholder="Instructions for configuring this service..."
              value={setupInstructions}
              onChange={(e) => setSetupInstructions(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update Service" : "Create Service"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
