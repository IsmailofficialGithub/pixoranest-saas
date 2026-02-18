import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, Loader2, ShieldAlert, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ConfigureCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowInstanceId: string;
  serviceName: string;
  onSuccess: () => void;
}

interface CredentialRow {
  id: string;
  credential_name: string;
  credential_type: string;
  credential_status: string | null;
  configured_at: string | null;
}

interface CredentialInstruction {
  [key: string]: string;
}

const statusBadge = (status: string | null) => {
  switch (status) {
    case "configured":
      return { label: "Configured", icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-300" };
    case "expired":
      return { label: "Expired", icon: AlertCircle, className: "bg-red-100 text-red-700 border-red-300" };
    case "invalid":
      return { label: "Invalid", icon: AlertCircle, className: "bg-red-100 text-red-700 border-red-300" };
    default:
      return { label: "Pending", icon: Clock, className: "border-yellow-300 bg-yellow-50 text-yellow-700" };
  }
};

export default function ConfigureCredentialsDialog({
  open, onOpenChange, workflowInstanceId, serviceName, onSuccess,
}: ConfigureCredentialsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [instructions, setInstructions] = useState<CredentialInstruction>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    if (!workflowInstanceId) return;
    setLoading(true);

    const [credsRes, templateRes] = await Promise.all([
      supabase
        .from("client_workflow_credentials")
        .select("id, credential_name, credential_type, credential_status, configured_at")
        .eq("client_workflow_instance_id", workflowInstanceId)
        .order("credential_name"),
      supabase
        .from("client_workflow_instances")
        .select("workflow_templates(credential_instructions)")
        .eq("id", workflowInstanceId)
        .single(),
    ]);

    const credsList = (credsRes.data ?? []) as CredentialRow[];
    setCredentials(credsList);

    const instrData = (templateRes.data as any)?.workflow_templates?.credential_instructions;
    setInstructions(instrData && typeof instrData === "object" ? instrData : {});

    // Pre-fill empty values
    const initialValues: Record<string, string> = {};
    credsList.forEach((c) => { initialValues[c.credential_name] = ""; });
    setValues(initialValues);
    setVisibility({});
    setErrors({});
    setLoading(false);
  }, [workflowInstanceId]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    credentials.forEach((cred) => {
      const val = values[cred.credential_name]?.trim() ?? "";

      // Only require value if not already configured, or if user started typing
      if (!val && cred.credential_status !== "configured") {
        newErrors[cred.credential_name] = "This field is required";
        return;
      }

      if (!val) return; // Skip validation for configured creds with no new value

      const nameLower = cred.credential_name.toLowerCase();

      if ((nameLower.includes("api_key") || nameLower.includes("apikey") || nameLower.includes("api key")) && val.length < 10) {
        newErrors[cred.credential_name] = "API key must be at least 10 characters";
      }

      if ((nameLower.includes("phone") || nameLower.includes("caller_id")) && val && !/^\+\d{10,15}$/.test(val)) {
        newErrors[cred.credential_name] = "Must be in E.164 format (e.g., +911234567890)";
      }

      if (nameLower.includes("url") && val) {
        try {
          new URL(val);
        } catch {
          newErrors[cred.credential_name] = "Must be a valid URL";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    // Build custom_config object from filled values
    const configUpdate: Record<string, string> = {};
    credentials.forEach((cred) => {
      const val = values[cred.credential_name]?.trim();
      if (val) {
        const key = cred.credential_name.toLowerCase().replace(/\s+/g, "_");
        configUpdate[key] = val;
      }
    });

    // Step 1: Update custom_config
    if (Object.keys(configUpdate).length > 0) {
      const { data: existing } = await supabase
        .from("client_workflow_instances")
        .select("custom_config")
        .eq("id", workflowInstanceId)
        .single();

      const mergedConfig = {
        ...((existing?.custom_config as Record<string, unknown>) ?? {}),
        ...configUpdate,
      } as Record<string, string>;

      const { error: configErr } = await supabase
        .from("client_workflow_instances")
        .update({ custom_config: mergedConfig as unknown as import("@/integrations/supabase/types").Json, status: "configured" as const })
        .eq("id", workflowInstanceId);

      if (configErr) {
        toast({ title: "Error", description: configErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    // Step 2: Update credential statuses
    const updatePromises = credentials.map((cred) => {
      const val = values[cred.credential_name]?.trim();
      if (val) {
        return supabase
          .from("client_workflow_credentials")
          .update({ credential_status: "configured", configured_at: new Date().toISOString() })
          .eq("id", cred.id);
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);

    toast({ title: "Credentials configured successfully" });
    setSaving(false);
    onSuccess();
    onOpenChange(false);
  };

  const formatCredName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const isSensitive = (name: string) => {
    const lower = name.toLowerCase();
    return lower.includes("key") || lower.includes("secret") || lower.includes("password") || lower.includes("token");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Credentials — {serviceName}</DialogTitle>
          <DialogDescription>
            Enter the required credentials for this workflow.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : credentials.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No credentials required for this workflow.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Alert variant="default" className="border-yellow-300 bg-yellow-50">
              <ShieldAlert className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 text-xs">
                Credentials are stored securely. Never share these with anyone.
              </AlertDescription>
            </Alert>

            {credentials.map((cred) => {
              const badge = statusBadge(cred.credential_status);
              const BadgeIcon = badge.icon;
              const sensitive = isSensitive(cred.credential_name);
              const isVisible = visibility[cred.credential_name] ?? false;
              const instruction = instructions[cred.credential_name];

              return (
                <Card key={cred.id}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">
                        {formatCredName(cred.credential_name)}
                      </CardTitle>
                      <Badge variant="outline" className={`text-xs ${badge.className}`}>
                        <BadgeIcon className="mr-1 h-3 w-3" />
                        {badge.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2">
                    {instruction && (
                      <p className="text-xs text-muted-foreground">{instruction}</p>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor={cred.id} className="text-xs">
                        {formatCredName(cred.credential_name)}
                        {cred.credential_status === "configured" && (
                          <span className="ml-1 text-muted-foreground">(leave empty to keep current)</span>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id={cred.id}
                          type={sensitive && !isVisible ? "password" : "text"}
                          placeholder={`Enter ${formatCredName(cred.credential_name)}`}
                          value={values[cred.credential_name] ?? ""}
                          onChange={(e) => {
                            setValues((v) => ({ ...v, [cred.credential_name]: e.target.value }));
                            if (errors[cred.credential_name]) {
                              setErrors((er) => { const n = { ...er }; delete n[cred.credential_name]; return n; });
                            }
                          }}
                          className={errors[cred.credential_name] ? "border-destructive pr-10" : sensitive ? "pr-10" : ""}
                        />
                        {sensitive && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-10 w-10"
                            onClick={() => setVisibility((v) => ({ ...v, [cred.credential_name]: !isVisible }))}
                          >
                            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      {errors[cred.credential_name] && (
                        <p className="text-xs text-destructive">{errors[cred.credential_name]}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || credentials.length === 0}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save All Credentials"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
