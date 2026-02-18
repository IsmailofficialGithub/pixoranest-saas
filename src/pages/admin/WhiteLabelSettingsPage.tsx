import { useState, useRef, useEffect, useCallback } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { HexColorPicker } from "react-colorful";
import {
  Upload, Trash2, RotateCcw, Globe, HelpCircle, Mail, Palette,
  LayoutDashboard, Users, Package, Settings, ExternalLink,
} from "lucide-react";

export default function WhiteLabelSettingsPage() {
  const { admin, refetchAdmin, primaryColor, secondaryColor, logo } = useAdmin();

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [formPrimaryColor, setFormPrimaryColor] = useState("#3B82F6");
  const [formSecondaryColor, setFormSecondaryColor] = useState("#10B981");
  const [customDomain, setCustomDomain] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false);
  const [showSecondaryPicker, setShowSecondaryPicker] = useState(false);
  const [showDnsHelp, setShowDnsHelp] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form from admin data
  useEffect(() => {
    if (!admin) return;
    setCompanyName(admin.company_name || "");
    setCompanyWebsite(admin.company_website || "");
    setFormPrimaryColor(admin.primary_color || "#3B82F6");
    setFormSecondaryColor(admin.secondary_color || "#10B981");
    setCustomDomain(admin.custom_domain || "");
    setLogoPreview(admin.logo_url || null);
    setLogoFile(null);
    setRemoveLogo(false);
  }, [admin]);

  const hasChanges = useCallback(() => {
    if (!admin) return false;
    return (
      companyName !== (admin.company_name || "") ||
      companyWebsite !== (admin.company_website || "") ||
      formPrimaryColor !== (admin.primary_color || "#3B82F6") ||
      formSecondaryColor !== (admin.secondary_color || "#10B981") ||
      customDomain !== (admin.custom_domain || "") ||
      logoFile !== null ||
      removeLogo
    );
  }, [admin, companyName, companyWebsite, formPrimaryColor, formSecondaryColor, customDomain, logoFile, removeLogo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be less than 2MB.", variant: "destructive" });
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload PNG, JPG, or SVG.", variant: "destructive" });
      return;
    }

    // Validate dimensions for raster images
    if (file.type !== "image/svg+xml") {
      const img = new Image();
      img.onload = () => {
        if (img.width < 100 || img.height < 100) {
          toast({ title: "Image too small", description: "Logo must be at least 100×100 pixels.", variant: "destructive" });
          return;
        }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
        setRemoveLogo(false);
      };
      img.src = URL.createObjectURL(file);
    } else {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setRemoveLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setRemoveLogo(true);
    setLogoFile(null);
    setLogoPreview(null);
    setShowRemoveConfirm(false);
  };

  const handleResetColors = () => {
    setFormPrimaryColor("#3B82F6");
    setFormSecondaryColor("#10B981");
  };

  const handleCancel = () => {
    if (hasChanges()) {
      setShowCancelConfirm(true);
    }
  };

  const confirmCancel = () => {
    if (!admin) return;
    setCompanyName(admin.company_name || "");
    setCompanyWebsite(admin.company_website || "");
    setFormPrimaryColor(admin.primary_color || "#3B82F6");
    setFormSecondaryColor(admin.secondary_color || "#10B981");
    setCustomDomain(admin.custom_domain || "");
    setLogoPreview(admin.logo_url || null);
    setLogoFile(null);
    setRemoveLogo(false);
    setShowCancelConfirm(false);
  };

  const validateForm = (): boolean => {
    if (!companyName.trim() || companyName.trim().length < 2) {
      toast({ title: "Validation Error", description: "Company name must be at least 2 characters.", variant: "destructive" });
      return false;
    }
    if (companyWebsite && !/^https?:\/\/.+\..+/.test(companyWebsite)) {
      toast({ title: "Validation Error", description: "Please enter a valid URL (e.g., https://yourcompany.com).", variant: "destructive" });
      return false;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(formPrimaryColor) || !/^#[0-9A-Fa-f]{6}$/.test(formSecondaryColor)) {
      toast({ title: "Validation Error", description: "Colors must be valid hex codes.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!admin || !validateForm()) return;
    setIsSaving(true);

    try {
      let newLogoUrl = admin.logo_url;

      // Handle logo upload
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const filePath = `${admin.id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("admin-logos")
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("admin-logos")
          .getPublicUrl(filePath);
        newLogoUrl = urlData.publicUrl;
      }

      // Handle logo removal
      if (removeLogo && admin.logo_url) {
        const path = admin.logo_url.split("/admin-logos/")[1];
        if (path) {
          await supabase.storage.from("admin-logos").remove([path]);
        }
        newLogoUrl = null;
      }

      // Update admins table
      const { error: updateError } = await supabase
        .from("admins")
        .update({
          company_name: companyName.trim(),
          company_website: companyWebsite.trim() || null,
          logo_url: newLogoUrl,
          primary_color: formPrimaryColor,
          secondary_color: formSecondaryColor,
          custom_domain: customDomain.trim() || null,
        })
        .eq("id", admin.id);

      if (updateError) throw updateError;

      await refetchAdmin();
      setLogoFile(null);
      setRemoveLogo(false);

      toast({ title: "Branding updated successfully!", description: "Your changes are now live." });
    } catch (err: any) {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const initials = companyName
    ? companyName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  // Preview sidebar items
  const previewNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: Palette, label: "White-Label" },
    { icon: Package, label: "Services" },
    { icon: Users, label: "Clients" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">White-Label Settings</h1>
        <p className="text-sm text-muted-foreground">Customize your portal's branding and appearance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column: Settings */}
        <div className="lg:col-span-3 space-y-6">
          {/* Logo Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Logo</CardTitle>
              <CardDescription>Recommended size: 200×60 pixels (PNG or SVG)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-40 rounded-md border border-border flex items-center justify-center overflow-hidden bg-muted">
                  {logoPreview && !removeLogo ? (
                    <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Upload New Logo
                  </Button>
                  {logoPreview && !removeLogo && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setShowRemoveConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remove Logo
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your Company Name"
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyWebsite">Company Website</Label>
                <Input
                  id="companyWebsite"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  placeholder="https://yourcompany.com"
                  type="url"
                />
              </div>
            </CardContent>
          </Card>

          {/* Color Customization */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Color Customization</CardTitle>
                <CardDescription>Define your brand colors</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleResetColors}>
                <RotateCcw className="h-4 w-4 mr-1" /> Reset Defaults
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Color */}
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <p className="text-xs text-muted-foreground">Used for buttons, links, active states</p>
                <div className="flex items-center gap-3">
                  <button
                    className="h-10 w-10 rounded-full border-2 border-border shrink-0 cursor-pointer"
                    style={{ backgroundColor: formPrimaryColor }}
                    onClick={() => setShowPrimaryPicker(!showPrimaryPicker)}
                  />
                  <Input
                    value={formPrimaryColor}
                    onChange={(e) => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) && setFormPrimaryColor(e.target.value)}
                    className="w-32 font-mono"
                    maxLength={7}
                  />
                </div>
                {showPrimaryPicker && (
                  <div className="pt-2">
                    <HexColorPicker color={formPrimaryColor} onChange={setFormPrimaryColor} />
                  </div>
                )}
              </div>

              <Separator />

              {/* Secondary Color */}
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <p className="text-xs text-muted-foreground">Used for accents, secondary buttons</p>
                <div className="flex items-center gap-3">
                  <button
                    className="h-10 w-10 rounded-full border-2 border-border shrink-0 cursor-pointer"
                    style={{ backgroundColor: formSecondaryColor }}
                    onClick={() => setShowSecondaryPicker(!showSecondaryPicker)}
                  />
                  <Input
                    value={formSecondaryColor}
                    onChange={(e) => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) && setFormSecondaryColor(e.target.value)}
                    className="w-32 font-mono"
                    maxLength={7}
                  />
                </div>
                {showSecondaryPicker && (
                  <div className="pt-2">
                    <HexColorPicker color={formSecondaryColor} onChange={setFormSecondaryColor} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Custom Domain */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" /> Custom Domain
              </CardTitle>
              <CardDescription>Point your own domain to this portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="portal.yourcompany.com"
                />
                {customDomain ? (
                  <Badge variant="outline" className="shrink-0 text-yellow-600 border-yellow-300 bg-yellow-50">
                    Pending Verification
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0">Not Configured</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Contact support to configure DNS settings.</p>
              <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => setShowDnsHelp(true)}>
                <HelpCircle className="h-3 w-3 mr-1" /> How to Configure
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Preview</CardTitle>
                <CardDescription>See how your branding looks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden bg-card">
                  {/* Preview Sidebar */}
                  <div className="flex">
                    <div className="w-36 border-r border-border bg-muted/50 p-3 space-y-1">
                      {/* Logo area */}
                      <div className="h-8 mb-3 flex items-center">
                        {logoPreview && !removeLogo ? (
                          <img src={logoPreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-xs font-bold truncate">{companyName || "Company"}</span>
                        )}
                      </div>
                      {previewNavItems.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-[10px]"
                          style={{
                            backgroundColor: item.active ? formPrimaryColor : "transparent",
                            color: item.active ? "#fff" : undefined,
                          }}
                        >
                          <item.icon className="h-3 w-3 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Preview Content */}
                    <div className="flex-1 p-3 space-y-3">
                      <p className="text-[10px] font-semibold">{companyName || "Company"} Dashboard</p>
                      {/* Sample buttons */}
                      <div className="flex gap-2">
                        <button
                          className="text-[9px] px-2 py-1 rounded text-white"
                          style={{ backgroundColor: formPrimaryColor }}
                        >
                          Primary
                        </button>
                        <button
                          className="text-[9px] px-2 py-1 rounded text-white"
                          style={{ backgroundColor: formSecondaryColor }}
                        >
                          Secondary
                        </button>
                      </div>
                      {/* Sample badge */}
                      <div className="flex gap-2">
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: formPrimaryColor }}
                        >
                          Active
                        </span>
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: formSecondaryColor }}
                        >
                          12 clients
                        </span>
                      </div>
                      {/* Sample card */}
                      <div className="rounded border border-border p-2">
                        <div className="h-1.5 rounded-full w-3/4 mb-1" style={{ backgroundColor: formPrimaryColor, opacity: 0.2 }} />
                        <div className="h-1.5 rounded-full w-1/2" style={{ backgroundColor: formSecondaryColor, opacity: 0.2 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 md:left-60 z-30 border-t border-border bg-background p-4">
        <div className="flex gap-3 max-w-screen-xl mx-auto">
          <Button
            onClick={handleSave}
            disabled={!hasChanges() || isSaving}
            className="flex-1 sm:flex-none sm:min-w-[160px]"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={!hasChanges()}>
            Cancel
          </Button>
        </div>
      </div>

      {/* DNS Help Dialog */}
      <Dialog open={showDnsHelp} onOpenChange={setShowDnsHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to Configure Custom Domain</DialogTitle>
            <DialogDescription>Follow these steps to point your domain to your portal</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
            <li>Add a DNS <strong>CNAME</strong> record for your subdomain</li>
            <li>Point it to: <code className="text-xs bg-muted px-1 py-0.5 rounded">platform.aiservices.com</code></li>
            <li>Wait for DNS propagation (24–48 hours)</li>
            <li>Contact support with your domain for verification</li>
            <li>We'll verify and activate your custom domain</li>
          </ol>
          <DialogFooter>
            <Button variant="outline" asChild>
              <a href="mailto:support@platform.com">
                <Mail className="h-4 w-4 mr-2" /> Contact Support
              </a>
            </Button>
            <DialogClose asChild>
              <Button>Got it</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Logo Confirmation */}
      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove company logo?</AlertDialogTitle>
            <AlertDialogDescription>
              Your logo will be removed and replaced with company initials. This takes effect after saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveLogo}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
