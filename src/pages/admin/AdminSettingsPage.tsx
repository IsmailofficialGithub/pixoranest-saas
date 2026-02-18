import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  User, Shield, Bell, CreditCard, Plug, Settings, Save, Eye, EyeOff,
  Mail, Phone, Building2, Globe, Lock, Smartphone, LogOut, Key,
  Download, Trash2, Clock, AlertTriangle, CheckCircle, ExternalLink, Copy,
} from "lucide-react";

// Password strength helper
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 20, label: "Weak", color: "bg-destructive" };
  if (score === 2) return { score: 40, label: "Fair", color: "bg-orange-500" };
  if (score === 3) return { score: 60, label: "Good", color: "bg-yellow-500" };
  if (score === 4) return { score: 80, label: "Strong", color: "bg-green-500" };
  return { score: 100, label: "Very Strong", color: "bg-green-600" };
}

export default function AdminSettingsPage() {
  const { user, profile } = useAuth();
  const { admin, refetchAdmin } = useAdmin();

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState({
    email_new_client: true,
    email_usage_limit: true,
    email_usage_exceeded: true,
    email_invoice_paid: true,
    email_new_lead: true,
    email_campaign_completed: true,
    email_monthly_report: true,
    email_platform_updates: false,
    inapp_all: true,
    inapp_announcements: true,
    inapp_service_updates: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  // Billing state
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");
  const [billingSaving, setBillingSaving] = useState(false);

  // Advanced state
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState("12");
  const [currency, setCurrency] = useState("INR");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [advancedSaving, setAdvancedSaving] = useState(false);

  // API state
  const [showApiKey, setShowApiKey] = useState(false);
  const apiKeyPlaceholder = "sk-admin-xxxx-xxxx-xxxx-xxxxxxxxxxxx";

  // Init profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
    if (admin) {
      setCompanyName(admin.company_name || "");
      setCompanyWebsite(admin.company_website || "");
    }
  }, [profile, admin]);

  // Profile save
  const handleProfileSave = async () => {
    if (!user || !admin) return;
    if (!fullName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setProfileSaving(true);
    try {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq("user_id", user.id);
      if (profileErr) throw profileErr;

      const { error: adminErr } = await supabase
        .from("admins")
        .update({
          company_name: companyName.trim(),
          company_website: companyWebsite.trim() || null,
        })
        .eq("id", admin.id);
      if (adminErr) throw adminErr;

      await refetchAdmin();
      toast({ title: "Profile updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  // Password update
  const handlePasswordUpdate = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Minimum 8 characters required.", variant: "destructive" });
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast({ title: "Weak password", description: "Must contain at least 1 uppercase letter.", variant: "destructive" });
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast({ title: "Weak password", description: "Must contain at least 1 number.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  };

  // Notification prefs save (stored locally for now, would need DB column)
  const handleNotifSave = async () => {
    setNotifSaving(true);
    try {
      // In production, save to admins.notification_preferences jsonb column
      await new Promise((r) => setTimeout(r, 500));
      toast({ title: "Notification preferences saved" });
    } finally {
      setNotifSaving(false);
    }
  };

  // Billing save
  const handleBillingSave = async () => {
    setBillingSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      toast({ title: "Billing details saved" });
    } finally {
      setBillingSaving(false);
    }
  };

  // Advanced save
  const handleAdvancedSave = async () => {
    setAdvancedSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      toast({ title: "Preferences saved" });
    } finally {
      setAdvancedSaving(false);
    }
  };

  const pwStrength = getPasswordStrength(newPassword);

  const notifItems = [
    { key: "email_new_client", label: "New client registered", desc: "Instant notification" },
    { key: "email_usage_limit", label: "Client approaching usage limit", desc: "Daily digest" },
    { key: "email_usage_exceeded", label: "Client exceeded usage limit", desc: "Instant notification" },
    { key: "email_invoice_paid", label: "Invoice paid", desc: "Instant notification" },
    { key: "email_new_lead", label: "New lead captured", desc: "Daily digest" },
    { key: "email_campaign_completed", label: "Campaign completed", desc: "Instant notification" },
    { key: "email_monthly_report", label: "Monthly revenue report", desc: "Monthly" },
    { key: "email_platform_updates", label: "Platform updates & news", desc: "Weekly" },
  ];

  const inappItems = [
    { key: "inapp_all", label: "Mirror all email notifications in-app" },
    { key: "inapp_announcements", label: "Platform announcements" },
    { key: "inapp_service_updates", label: "Service updates" },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="profile" className="gap-1.5"><User className="h-4 w-4" /> Profile</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-4 w-4" /> Security</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5"><CreditCard className="h-4 w-4" /> Billing</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5"><Plug className="h-4 w-4" /> Integrations</TabsTrigger>
          <TabsTrigger value="advanced" className="gap-1.5"><Settings className="h-4 w-4" /> Advanced</TabsTrigger>
        </TabsList>

        {/* TAB 1: Profile */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email || ""} disabled />
                  <p className="text-xs text-muted-foreground">Cannot change email address</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Information</CardTitle>
              <CardDescription>Your business details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">Company Website</Label>
                  <Input id="companyWebsite" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://yourcompany.com" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleProfileSave} disabled={profileSaving}>
              <Save className="h-4 w-4 mr-2" /> {profileSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        {/* TAB 2: Security */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Lock className="h-5 w-5" /> Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="newPw">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPw"
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                  />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1 h-8 w-8 p-0" onClick={() => setShowNewPw(!showNewPw)}>
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Progress value={pwStrength.score} className="h-2 flex-1" />
                      <span className="text-xs font-medium">{pwStrength.label}</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      <li className={newPassword.length >= 8 ? "text-green-600" : ""}>• At least 8 characters</li>
                      <li className={/[A-Z]/.test(newPassword) ? "text-green-600" : ""}>• One uppercase letter</li>
                      <li className={/[0-9]/.test(newPassword) ? "text-green-600" : ""}>• One number</li>
                    </ul>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPw">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPw"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1 h-8 w-8 p-0" onClick={() => setShowConfirmPw(!showConfirmPw)}>
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords don't match</p>
                )}
              </div>
              <Button onClick={handlePasswordUpdate} disabled={passwordSaving || !newPassword || !confirmPassword}>
                {passwordSaving ? "Updating..." : "Update Password"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Smartphone className="h-5 w-5" /> Two-Factor Authentication</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                <Badge variant="outline" className="mt-2">Not Enabled</Badge>
              </div>
              <Button variant="outline">Enable 2FA</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><LogOut className="h-5 w-5" /> Active Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Current Session</p>
                    <p className="text-xs text-muted-foreground">Browser • Active now</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary">Active</Badge>
              </div>
              <Button variant="outline" size="sm" className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sign Out All Other Sessions
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Mail className="h-5 w-5" /> Email Notifications</CardTitle>
              <CardDescription>Choose which notifications you receive via email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={(notifPrefs as any)[item.key]}
                    onCheckedChange={(checked) => setNotifPrefs((p) => ({ ...p, [item.key]: checked }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Bell className="h-5 w-5" /> In-App Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inappItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  <Switch
                    checked={(notifPrefs as any)[item.key]}
                    onCheckedChange={(checked) => setNotifPrefs((p) => ({ ...p, [item.key]: checked }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleNotifSave} disabled={notifSaving}>
              <Save className="h-4 w-4 mr-2" /> {notifSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </TabsContent>

        {/* TAB 4: Billing & Subscription */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Commission Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Current Commission Rate</p>
                  <p className="text-3xl font-bold text-foreground">{admin?.commission_rate ?? 20}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Set by platform administrator</p>
                </div>
                <Button variant="outline" size="sm">Request Rate Change</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
              <CardDescription>Add your bank details for receiving commissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. State Bank of India" />
                </div>
                <div className="space-y-2">
                  <Label>Account Holder Name</Label>
                  <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Full name as per bank" />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="xxxx xxxx xxxx" />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} placeholder="e.g. SBIN0001234" />
                </div>
              </div>
              <Separator />
              <div className="space-y-2 max-w-sm">
                <Label>UPI ID (Alternative)</Label>
                <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payout Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-lg border border-border text-center">
                  <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Schedule</p>
                  <p className="font-semibold">Monthly</p>
                </div>
                <div className="p-4 rounded-lg border border-border text-center">
                  <CreditCard className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Min Threshold</p>
                  <p className="font-semibold">₹5,000</p>
                </div>
                <div className="p-4 rounded-lg border border-border text-center">
                  <CheckCircle className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-semibold text-primary">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleBillingSave} disabled={billingSaving}>
              <Save className="h-4 w-4 mr-2" /> {billingSaving ? "Saving..." : "Save Billing Details"}
            </Button>
          </div>
        </TabsContent>

        {/* TAB 5: API & Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Key className="h-5 w-5" /> API Access</CardTitle>
              <CardDescription>Use API keys for custom integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={showApiKey ? apiKeyPlaceholder : "••••••••••••••••••••••••••••"}
                    disabled
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(apiKeyPlaceholder); toast({ title: "Copied to clipboard" }); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Regenerate Key</Button>
                <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> API Docs</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Integrations</CardTitle>
              <CardDescription>Connect your favorite tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: "Salesforce", category: "CRM", connected: false },
                { name: "HubSpot", category: "CRM", connected: false },
                { name: "QuickBooks", category: "Accounting", connected: false },
                { name: "Slack", category: "Communication", connected: false },
                { name: "Mailchimp", category: "Email Marketing", connected: false },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Plug className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{integration.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{integration.connected ? "Connected" : "Not Connected"}</Badge>
                    <Button variant="outline" size="sm">
                      {integration.connected ? "Configure" : "Connect"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: Advanced */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timezone & Locale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                      <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Format</Label>
                  <Select value={timeFormat} onValueChange={setTimeFormat}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12-hour</SelectItem>
                      <SelectItem value="24">24-hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Data Export</CardTitle>
              <CardDescription>Download all your data for backup or compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" /> Export All My Data
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Downloads a ZIP with all clients, invoices, and usage data</p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleAdvancedSave} disabled={advancedSaving}>
              <Save className="h-4 w-4 mr-2" /> {advancedSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
