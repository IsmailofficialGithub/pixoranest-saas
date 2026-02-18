import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Eye, EyeOff, Copy, CheckCircle2, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ClientData = {
  id: string;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  is_active: boolean;
  user_id: string;
  allow_admin_raw_access: boolean | null;
  profile?: {
    email: string;
    full_name: string | null;
    phone: string | null;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientData | null; // null = create mode
  onSuccess?: (clientId?: string) => void;
};

const INDUSTRIES = [
  "Technology", "Healthcare", "Retail", "Education", "Finance",
  "Manufacturing", "Real Estate", "Hospitality", "Other",
];

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

function getPasswordStrength(pw: string): { label: string; color: string; pct: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: "Weak", color: "bg-destructive", pct: 33 };
  if (score <= 3) return { label: "Medium", color: "bg-yellow-500", pct: 66 };
  return { label: "Strong", color: "bg-green-500", pct: 100 };
}

export default function ClientFormModal({ open, onOpenChange, client, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!client;

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [allowRawAccess, setAllowRawAccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("basic");

  // Success state
  const [successData, setSuccessData] = useState<{
    clientId: string;
    generatedPassword?: string;
    companyName: string;
    email: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setSuccessData(null);
      setCopied(false);
      setActiveTab("basic");
      setErrors({});
      if (client) {
        setCompanyName(client.company_name);
        setIndustry(client.industry || "");
        setCompanySize(client.company_size || "");
        setFullName(client.profile?.full_name || "");
        setEmail(client.profile?.email || "");
        setPhone(client.profile?.phone || "");
        setAllowRawAccess(client.allow_admin_raw_access || false);
      } else {
        setCompanyName("");
        setIndustry("");
        setCompanySize("");
        setFullName("");
        setEmail("");
        setPhone("");
        setAutoGenerate(true);
        setPassword("");
        setSendWelcomeEmail(true);
        setAllowRawAccess(false);
      }
    }
  }, [open, client]);

  const pwStrength = useMemo(() => getPasswordStrength(password), [password]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!companyName.trim() || companyName.trim().length < 2) e.companyName = "Company name is required (min 2 chars)";
    if (!fullName.trim()) e.fullName = "Contact name is required";
    if (!isEdit) {
      if (!email.trim()) e.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email format";
      if (!autoGenerate) {
        if (!password || password.length < 8) e.password = "Password must be at least 8 characters";
        else if (!/[A-Z]/.test(password)) e.password = "Must contain an uppercase letter";
        else if (!/[0-9]/.test(password)) e.password = "Must contain a number";
      }
    }
    if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) e.phone = "Invalid phone format";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Navigate to tab with first error
      if (e.companyName) setActiveTab("basic");
      else if (e.fullName || e.email || e.phone) setActiveTab("contact");
      else if (e.password) setActiveTab("account");
    }
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const payload = isEdit
        ? {
            action: "update",
            client_id: client!.id,
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            company_name: companyName.trim(),
            industry: industry || null,
            company_size: companySize || null,
            allow_admin_raw_access: allowRawAccess,
          }
        : {
            action: "create",
            email: email.trim(),
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            company_name: companyName.trim(),
            industry: industry || null,
            company_size: companySize || null,
            allow_admin_raw_access: allowRawAccess,
            auto_generate_password: autoGenerate,
            password: autoGenerate ? undefined : password,
          };

      const res = await supabase.functions.invoke("manage-client", { body: payload });
      if (res.error) throw new Error(res.error.message || "Request failed");
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      if (isEdit) {
        toast.success("Client updated successfully");
        onOpenChange(false);
        onSuccess?.();
      } else {
        setSuccessData({
          clientId: data.client_id,
          generatedPassword: data.generated_password,
          companyName: companyName.trim(),
          email: email.trim(),
        });
      }
    },
    onError: (err: Error) => {
      if (err.message.includes("already exists") || err.message.includes("already been registered")) {
        setErrors({ email: "A user with this email already exists" });
        setActiveTab("contact");
      } else {
        toast.error(err.message || "Failed to save client");
      }
    },
  });

  const handleSubmit = () => {
    if (validate()) mutation.mutate();
  };

  const copyPassword = () => {
    if (successData?.generatedPassword) {
      navigator.clipboard.writeText(successData.generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success view
  if (successData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Client Created Successfully!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Company</span>
                <span className="text-sm font-medium text-foreground">{successData.companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium text-foreground">{successData.email}</span>
              </div>
              {successData.generatedPassword && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Password</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">
                      {successData.generatedPassword}
                    </code>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyPassword}>
                      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Would you like to assign services to <strong>{successData.companyName}</strong> now?
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => { onOpenChange(false); onSuccess?.(successData.clientId); }}>
                View Client
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit Client - ${client?.company_name}` : "Add New Client"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full" style={{ gridTemplateColumns: isEdit ? "1fr 1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            {!isEdit && <TabsTrigger value="account">Account</TabsTrigger>}
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="companyName">Company / Organization Name *</Label>
              <Input
                id="companyName"
                placeholder="e.g., ABC Technologies Pvt Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={errors.companyName ? "border-destructive" : ""}
              />
              {errors.companyName && <p className="text-xs text-destructive mt-1">{errors.companyName}</p>}
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="companySize">Company Size</Label>
              <Select value={companySize} onValueChange={setCompanySize}>
                <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="fullName">Primary Contact Name *</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={errors.fullName ? "border-destructive" : ""}
              />
              {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isEdit}
                className={errors.email ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isEdit ? "Email cannot be changed" : "This will be used for login"}
              </p>
              {errors.email && <p className="text-xs text-destructive mt-0.5">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </div>
          </TabsContent>

          {!isEdit && (
            <TabsContent value="account" className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="autoGen"
                  checked={autoGenerate}
                  onCheckedChange={(v) => setAutoGenerate(!!v)}
                />
                <div>
                  <Label htmlFor="autoGen" className="cursor-pointer">Auto-generate secure password</Label>
                  <p className="text-xs text-muted-foreground">Password will be shown after creation</p>
                </div>
              </div>

              {!autoGenerate && (
                <div>
                  <Label htmlFor="password">Set Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={errors.password ? "border-destructive pr-10" : "pr-10"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${pwStrength.color} transition-all`} style={{ width: `${pwStrength.pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">Strength: {pwStrength.label}</p>
                    </div>
                  )}
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Checkbox
                  id="welcomeEmail"
                  checked={sendWelcomeEmail}
                  onCheckedChange={(v) => setSendWelcomeEmail(!!v)}
                />
                <div>
                  <Label htmlFor="welcomeEmail" className="cursor-pointer">Send welcome email with login credentials</Label>
                  <p className="text-xs text-muted-foreground">Client will receive email with login URL and credentials</p>
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="permissions" className="space-y-4 mt-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Request access to client's raw data</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  If enabled, you'll request permission to view call recordings, messages, etc.
                </p>
              </div>
              <Switch checked={allowRawAccess} onCheckedChange={setAllowRawAccess} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Client"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
