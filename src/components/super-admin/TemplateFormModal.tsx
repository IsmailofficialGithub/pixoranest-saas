import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type WorkflowTemplate = Tables<"workflow_templates">;

interface Service {
  id: string;
  name: string;
  category: string;
}

interface TemplateFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkflowTemplate | null;
  onSaved: () => void;
}

export default function TemplateFormModal({
  open,
  onOpenChange,
  template,
  onSaved,
}: TemplateFormModalProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);

  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [masterPrompt, setMasterPrompt] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [category, setCategory] = useState("");
  const [version, setVersion] = useState("1.0");
  const [requiredCredentials, setRequiredCredentials] = useState("");
  const [defaultConfig, setDefaultConfig] = useState("{}");
  const [n8nWorkflowId, setN8nWorkflowId] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      supabase
        .from("services")
        .select("id, name, category")
        .eq("is_active", true)
        .order("name")
        .then(({ data }) => setServices((data as Service[]) ?? []));
    }
  }, [open]);

  useEffect(() => {
    if (template) {
      setTemplateName(template.template_name);
      setDescription(template.template_description ?? "");
      setMasterPrompt((template as any).master_prompt ?? "");
      setServiceId(template.service_id);
      setCategory((template as any).category ?? "");
      setVersion(template.version ?? "1.0");
      setRequiredCredentials(
        (template.required_credentials ?? []).join(", ")
      );
      setDefaultConfig(
        template.default_config
          ? JSON.stringify(template.default_config, null, 2)
          : "{}"
      );
      setN8nWorkflowId(template.n8n_template_workflow_id ?? "");
      setIsActive(template.is_active ?? true);
    } else {
      setTemplateName("");
      setDescription("");
      setMasterPrompt("");
      setServiceId("");
      setCategory("");
      setVersion("1.0");
      setRequiredCredentials("");
      setDefaultConfig("{}");
      setN8nWorkflowId("");
      setIsActive(true);
    }
  }, [template, open]);

  // Auto-populate category from selected service
  useEffect(() => {
    if (serviceId) {
      const svc = services.find((s) => s.id === serviceId);
      if (svc) setCategory(svc.category);
    }
  }, [serviceId, services]);

  const handleSave = async () => {
    if (!templateName.trim() || !serviceId) {
      toast.error("Template name and service are required");
      return;
    }

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(defaultConfig);
    } catch {
      toast.error("Default config must be valid JSON");
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      template_name: templateName.trim(),
      template_description: description.trim() || null,
      master_prompt: masterPrompt.trim() || null,
      service_id: serviceId,
      category: category || null,
      version: version.trim() || "1.0",
      required_credentials: requiredCredentials
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      default_config: parsedConfig,
      n8n_template_workflow_id: n8nWorkflowId.trim() || null,
      is_active: isActive,
    };

    let error;
    if (template) {
      ({ error } = await supabase
        .from("workflow_templates")
        .update(payload as any)
        .eq("id", template.id));
    } else {
      ({ error } = await supabase
        .from("workflow_templates")
        .insert(payload as any));
    }

    setSaving(false);
    if (error) {
      toast.error("Failed to save template: " + error.message);
    } else {
      toast.success(template ? "Template updated" : "Template created");
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Template Name *</Label>
              <Input
                id="tpl-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Voice Telecaller v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-version">Version</Label>
              <Input
                id="tpl-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Description</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workflow template"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Service *</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={category} disabled placeholder="Auto from service" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-prompt">Master Prompt</Label>
            <Textarea
              id="tpl-prompt"
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              placeholder="The core AI prompt / instructions for this workflow..."
              className="min-h-[160px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-creds">
              Required Credentials (comma-separated)
            </Label>
            <Input
              id="tpl-creds"
              value={requiredCredentials}
              onChange={(e) => setRequiredCredentials(e.target.value)}
              placeholder="retell_api_key, phone_number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-config">Default Config (JSON)</Label>
            <Textarea
              id="tpl-config"
              value={defaultConfig}
              onChange={(e) => setDefaultConfig(e.target.value)}
              placeholder="{}"
              className="min-h-[100px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-n8n">N8N Template Workflow ID</Label>
            <Input
              id="tpl-n8n"
              value={n8nWorkflowId}
              onChange={(e) => setN8nWorkflowId(e.target.value)}
              placeholder="n8n workflow ID to clone from"
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : template ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
