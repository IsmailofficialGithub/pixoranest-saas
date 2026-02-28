import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  User, Settings, Mail, Shield, Bell,
  Save, Loader2, RefreshCw, AlertTriangle,
} from "lucide-react";

type SettingsMap = Record<string, string>;

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const fetchSettings = useCallback(async () => {
    const { data, error } = await (supabase as any).from("platform_settings").select("key, value");
    if (error) {
      toast({ title: "Error loading settings", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const map: SettingsMap = {};
    (data || []).forEach((row: { key: string; value: string | null }) => {
      if (row.value !== null) map[row.key] = row.value;
    });
    setSettings(map);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const saveSetting = async (key: string, value: string) => {
    const { error } = await (supabase as any)
      .from("platform_settings")
      .upsert({ key, value, updated_by: user?.id }, { onConflict: "key" });
    if (error) throw error;
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveMultipleSettings = async (entries: Record<string, string>, section: string) => {
    setSaving(section);
    try {
      for (const [key, value] of Object.entries(entries)) {
        await saveSetting(key, value);
      }
      toast({ title: "Settings updated successfully" });
    } catch (e: any) {
      toast({ title: "Error saving settings", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveProfile = async () => {
    setSaving("profile");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone: phone })
        .eq("user_id", user?.id || "");
      if (error) throw error;
      toast({ title: "Profile updated successfully" });
    } catch (e: any) {
      toast({ title: "Error updating profile", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="mt-1 h-4 w-72" /></div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  const notifConfig = (() => {
    try { return JSON.parse(settings.notification_config || "{}"); } catch { return {}; }
  })();

  const platformUrl = window.location.origin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Settings</h1>
        <p className="mt-1 text-muted-foreground">Configure platform-wide settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="profile" className="gap-1.5"><User className="h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="platform" className="gap-1.5"><Settings className="h-4 w-4" />Platform</TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5"><Mail className="h-4 w-4" />Email</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
        </TabsList>

        {/* TAB 1: Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Your personal profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled className="opacity-60" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 1234567890" />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving === "profile"}>
                {saving === "profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Platform */}
        <TabsContent value="platform">
          <PlatformTab settings={settings} saving={saving} onSave={saveMultipleSettings} />
        </TabsContent>

        {/* TAB 3: Email */}
        <TabsContent value="email">
          <EmailTab settings={settings} saving={saving} onSave={saveMultipleSettings} />
        </TabsContent>

        {/* TAB 6: Security */}
        <TabsContent value="security">
          <SecurityTab settings={settings} saving={saving} onSave={saveMultipleSettings} />
        </TabsContent>

        {/* TAB 7: Notifications */}
        <TabsContent value="notifications">
          <NotificationsTab config={notifConfig} saving={saving} onSave={saveMultipleSettings} />
        </TabsContent>
      </Tabs>

    </div>
  );
}

/* ─── Sub-Components ─── */

function PlatformTab({ settings, saving, onSave }: { settings: SettingsMap; saving: string | null; onSave: (e: Record<string, string>, s: string) => Promise<void> }) {
  const [local, setLocal] = useState({
    platform_name: settings.platform_name || "",
    support_email: settings.support_email || "",
    support_phone: settings.support_phone || "",
    primary_brand_color: settings.primary_brand_color || "#3B82F6",
    default_currency: settings.default_currency || "INR",
    timezone: settings.timezone || "Asia/Kolkata",
    date_format: settings.date_format || "DD/MM/YYYY",
  });
  useEffect(() => {
    setLocal({
      platform_name: settings.platform_name || "",
      support_email: settings.support_email || "",
      support_phone: settings.support_phone || "",
      primary_brand_color: settings.primary_brand_color || "#3B82F6",
      default_currency: settings.default_currency || "INR",
      timezone: settings.timezone || "Asia/Kolkata",
      date_format: settings.date_format || "DD/MM/YYYY",
    });
  }, [settings]);

  return (
    <Card>
      <CardHeader><CardTitle>Platform Configuration</CardTitle><CardDescription>Global platform settings</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Platform Name</Label><Input value={local.platform_name} onChange={(e) => setLocal({ ...local, platform_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Support Email</Label><Input type="email" value={local.support_email} onChange={(e) => setLocal({ ...local, support_email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Support Phone</Label><Input value={local.support_phone} onChange={(e) => setLocal({ ...local, support_phone: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Primary Brand Color</Label>
            <div className="flex gap-2">
              <input type="color" value={local.primary_brand_color} onChange={(e) => setLocal({ ...local, primary_brand_color: e.target.value })} className="h-10 w-10 rounded border cursor-pointer" />
              <Input value={local.primary_brand_color} onChange={(e) => setLocal({ ...local, primary_brand_color: e.target.value })} className="font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Default Currency</Label>
            <Select value={local.default_currency} onValueChange={(v) => setLocal({ ...local, default_currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR (₹)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={local.timezone} onValueChange={(v) => setLocal({ ...local, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={local.date_format} onValueChange={(v) => setLocal({ ...local, date_format: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => onSave(local, "platform")} disabled={saving === "platform"}>
          {saving === "platform" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

function EmailTab({ settings, saving, onSave }: { settings: SettingsMap; saving: string | null; onSave: (e: Record<string, string>, s: string) => Promise<void> }) {
  const [local, setLocal] = useState({
    smtp_host: settings.smtp_host || "",
    smtp_port: settings.smtp_port || "587",
    smtp_username: settings.smtp_username || "",
    smtp_password: settings.smtp_password || "",
    from_email: settings.from_email || "",
    from_name: settings.from_name || "",
  });
  useEffect(() => {
    setLocal({
      smtp_host: settings.smtp_host || "",
      smtp_port: settings.smtp_port || "587",
      smtp_username: settings.smtp_username || "",
      smtp_password: settings.smtp_password || "",
      from_email: settings.from_email || "",
      from_name: settings.from_name || "",
    });
  }, [settings]);

  return (
    <Card>
      <CardHeader><CardTitle>Email Settings</CardTitle><CardDescription>Configure SMTP for email notifications</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>SMTP Host</Label><Input value={local.smtp_host} onChange={(e) => setLocal({ ...local, smtp_host: e.target.value })} placeholder="smtp.gmail.com" /></div>
          <div className="space-y-2"><Label>SMTP Port</Label><Input type="number" value={local.smtp_port} onChange={(e) => setLocal({ ...local, smtp_port: e.target.value })} /></div>
          <div className="space-y-2"><Label>SMTP Username</Label><Input value={local.smtp_username} onChange={(e) => setLocal({ ...local, smtp_username: e.target.value })} /></div>
          <div className="space-y-2"><Label>SMTP Password</Label><Input type="password" value={local.smtp_password} onChange={(e) => setLocal({ ...local, smtp_password: e.target.value })} /></div>
          <div className="space-y-2"><Label>From Email</Label><Input type="email" value={local.from_email} onChange={(e) => setLocal({ ...local, from_email: e.target.value })} placeholder="noreply@platform.com" /></div>
          <div className="space-y-2"><Label>From Name</Label><Input value={local.from_name} onChange={(e) => setLocal({ ...local, from_name: e.target.value })} placeholder="AI Services Platform" /></div>
        </div>
        <Button onClick={() => onSave(local, "email")} disabled={saving === "email"}>
          {saving === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Email Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function SecurityTab({ settings, saving, onSave }: { settings: SettingsMap; saving: string | null; onSave: (e: Record<string, string>, s: string) => Promise<void> }) {
  const [local, setLocal] = useState({
    security_min_password_length: settings.security_min_password_length || "8",
    security_require_uppercase: settings.security_require_uppercase || "true",
    security_require_numbers: settings.security_require_numbers || "true",
    security_require_special: settings.security_require_special || "true",
    session_timeout: settings.session_timeout || "8",
    ip_whitelist: settings.ip_whitelist || "",
  });
  useEffect(() => {
    setLocal({
      security_min_password_length: settings.security_min_password_length || "8",
      security_require_uppercase: settings.security_require_uppercase || "true",
      security_require_numbers: settings.security_require_numbers || "true",
      security_require_special: settings.security_require_special || "true",
      session_timeout: settings.session_timeout || "8",
      ip_whitelist: settings.ip_whitelist || "",
    });
  }, [settings]);

  return (
    <Card>
      <CardHeader><CardTitle>Security Settings</CardTitle><CardDescription>Password policies and session management</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Minimum Password Length</Label>
            <Input type="number" min={6} max={32} value={local.security_min_password_length} onChange={(e) => setLocal({ ...local, security_min_password_length: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Session Timeout</Label>
            <Select value={local.session_timeout} onValueChange={(v) => setLocal({ ...local, session_timeout: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={local.security_require_uppercase === "true"} onCheckedChange={(c) => setLocal({ ...local, security_require_uppercase: String(c) })} />
            <Label>Require uppercase letters</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={local.security_require_numbers === "true"} onCheckedChange={(c) => setLocal({ ...local, security_require_numbers: String(c) })} />
            <Label>Require numbers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={local.security_require_special === "true"} onCheckedChange={(c) => setLocal({ ...local, security_require_special: String(c) })} />
            <Label>Require special characters</Label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>IP Whitelist (one per line, leave empty for no restriction)</Label>
          <Textarea rows={4} value={local.ip_whitelist} onChange={(e) => setLocal({ ...local, ip_whitelist: e.target.value })} placeholder="192.168.1.1&#10;10.0.0.0/24" className="font-mono text-xs" />
        </div>
        <Button onClick={() => onSave(local, "security")} disabled={saving === "security"}>
          {saving === "security" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Security Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function NotificationsTab({ config, saving, onSave }: { config: Record<string, boolean>; saving: string | null; onSave: (e: Record<string, string>, s: string) => Promise<void> }) {
  const [local, setLocal] = useState(config);
  useEffect(() => { setLocal(config); }, [config]);

  const toggleKey = (key: string) => setLocal((prev) => ({ ...prev, [key]: !prev[key] }));

  const notifItems = [
    { key: "new_client_registered", label: "New client registered", desc: "Notify admin" },
    { key: "service_assigned", label: "Service assigned", desc: "Notify client" },
    { key: "workflow_activated", label: "Workflow activated", desc: "Notify client" },
    { key: "usage_limit_80", label: "Usage limit reached 80%", desc: "Notify client" },
    { key: "usage_limit_exceeded", label: "Usage limit exceeded", desc: "Notify client and admin" },
    { key: "campaign_completed", label: "Campaign completed", desc: "Notify client" },
    { key: "new_lead_captured", label: "New lead captured", desc: "Notify client" },
    { key: "invoice_generated", label: "Invoice generated", desc: "Notify client" },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Notification Settings</CardTitle><CardDescription>Configure when admins and clients receive notifications</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {notifItems.map((item) => (
          <div key={item.key} className="flex items-start gap-3 py-2 border-b last:border-0">
            <Checkbox checked={!!local[item.key]} onCheckedChange={() => toggleKey(item.key)} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
        <Button
          className="mt-4"
          onClick={() => onSave({ notification_config: JSON.stringify(local) }, "notifications")}
          disabled={saving === "notifications"}
        >
          {saving === "notifications" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Notification Settings
        </Button>
      </CardContent>
    </Card>
  );
}
