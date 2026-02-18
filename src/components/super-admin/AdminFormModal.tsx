import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AdminFormData {
  company_name: string;
  company_website: string;
  full_name: string;
  email: string;
  phone: string;
  commission_rate: number;
  auto_generate_password: boolean;
  password: string;
}

interface EditAdminData {
  id: string;
  user_id: string;
  company_name: string;
  company_website: string | null;
  full_name: string | null;
  email: string;
  phone?: string | null;
  commission_rate: number | null;
}

interface AdminFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: EditAdminData | null;
  onSuccess: () => void;
}

const initialForm: AdminFormData = {
  company_name: "",
  company_website: "",
  full_name: "",
  email: "",
  phone: "",
  commission_rate: 20,
  auto_generate_password: true,
  password: "",
};

export default function AdminFormModal({ open, onOpenChange, editData, onSuccess }: AdminFormModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<AdminFormData>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const isEdit = !!editData;

  useEffect(() => {
    if (open) {
      setCreatedCredentials(null);
      if (editData) {
        setForm({
          company_name: editData.company_name,
          company_website: editData.company_website ?? "",
          full_name: editData.full_name ?? "",
          email: editData.email,
          phone: editData.phone ?? "",
          commission_rate: editData.commission_rate ?? 20,
          auto_generate_password: true,
          password: "",
        });
      } else {
        setForm(initialForm);
      }
      setErrors({});
    }
  }, [open, editData]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.company_name.trim()) errs.company_name = "Company name is required";
    if (!form.full_name.trim()) errs.full_name = "Full name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email format";
    if (form.company_website && !/^https?:\/\/.+/.test(form.company_website))
      errs.company_website = "Must be a valid URL (https://...)";
    if (form.commission_rate < 0 || form.commission_rate > 100)
      errs.commission_rate = "Must be between 0 and 100";
    if (!isEdit && !form.auto_generate_password) {
      if (!form.password || form.password.length < 8) errs.password = "Min 8 characters";
      else if (!/[A-Z]/.test(form.password)) errs.password = "Must contain an uppercase letter";
      else if (!/[0-9]/.test(form.password)) errs.password = "Must contain a number";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const payload = isEdit
        ? {
            action: "update",
            admin_id: editData!.id,
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
            company_name: form.company_name.trim(),
            company_website: form.company_website.trim() || null,
            commission_rate: form.commission_rate,
          }
        : {
            action: "create",
            email: form.email.trim(),
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
            company_name: form.company_name.trim(),
            company_website: form.company_website.trim() || null,
            commission_rate: form.commission_rate,
            auto_generate_password: form.auto_generate_password,
            password: form.auto_generate_password ? undefined : form.password,
          };

      const res = await supabase.functions.invoke("manage-admin", {
        body: payload,
      });

      if (res.error || res.data?.error) {
        const msg = res.data?.error || res.error?.message || "An error occurred";
        setErrors({ form: msg });
        toast({ title: "Error", description: msg, variant: "destructive" });
      } else {
        if (!isEdit) {
          const pwd = form.auto_generate_password
            ? res.data?.generated_password || "Check email"
            : form.password;
          setCreatedCredentials({ email: form.email, password: pwd });
          toast({ title: "Admin created successfully!" });
          onSuccess();
        } else {
          toast({ title: "Admin updated successfully" });
          onOpenChange(false);
          onSuccess();
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to save admin. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof AdminFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{createdCredentials ? "Admin Created — Credentials" : isEdit ? "Edit Admin" : "Add New Admin"}</DialogTitle>
          <DialogDescription>
            {createdCredentials
              ? "Copy the credentials below and share with the admin."
              : isEdit ? "Update admin details below." : "Create a new reseller admin account."}
          </DialogDescription>
        </DialogHeader>

        {createdCredentials ? (
          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/50 p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-background rounded px-2 py-1">{createdCredentials.email}</code>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdCredentials.email); toast({ title: "Email copied!" }); }}>Copy</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-background rounded px-2 py-1">{createdCredentials.password}</code>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdCredentials.password); toast({ title: "Password copied!" }); }}>Copy</Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">⚠️ This password will not be shown again. Make sure to save it.</p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {errors.form && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{errors.form}</p>
              )}

              {/* Company Name */}
              <div className="space-y-1.5">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  placeholder="e.g., Digital Solutions Inc."
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                />
                {errors.company_name && <p className="text-xs text-destructive">{errors.company_name}</p>}
              </div>

              {/* Company Website */}
              <div className="space-y-1.5">
                <Label htmlFor="company_website">Company Website</Label>
                <Input
                  id="company_website"
                  placeholder="https://example.com"
                  value={form.company_website}
                  onChange={(e) => updateField("company_website", e.target.value)}
                />
                {errors.company_website && <p className="text-xs text-destructive">{errors.company_website}</p>}
              </div>

              {/* Admin Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Admin Full Name *</Label>
                <Input
                  id="full_name"
                  placeholder="John Doe"
                  value={form.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                />
                {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@company.com"
                  value={form.email}
                  disabled={isEdit}
                  onChange={(e) => updateField("email", e.target.value)}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+91 1234567890"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>

              {/* Commission Rate */}
              <div className="space-y-1.5">
                <Label htmlFor="commission_rate">Commission Rate (%) *</Label>
                <Input
                  id="commission_rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="20.0"
                  value={form.commission_rate}
                  onChange={(e) => updateField("commission_rate", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Percentage of revenue admin earns</p>
                {errors.commission_rate && <p className="text-xs text-destructive">{errors.commission_rate}</p>}
              </div>

              {/* Password - Create mode only */}
              {!isEdit && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="auto_password"
                      checked={form.auto_generate_password}
                      onCheckedChange={(checked) => updateField("auto_generate_password", !!checked)}
                    />
                    <Label htmlFor="auto_password" className="cursor-pointer font-normal">
                      Auto-generate password
                    </Label>
                  </div>
                  {!form.auto_generate_password && (
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Min 8 chars, 1 uppercase, 1 number"
                        value={form.password}
                        onChange={(e) => updateField("password", e.target.value)}
                      />
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : isEdit ? "Update Admin" : "Create Admin"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
