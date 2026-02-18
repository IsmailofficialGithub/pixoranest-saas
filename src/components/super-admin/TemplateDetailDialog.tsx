import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Tables } from "@/integrations/supabase/types";

type WorkflowTemplate = Tables<"workflow_templates">;

interface TemplateDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkflowTemplate | null;
  serviceName?: string;
}

export default function TemplateDetailDialog({
  open,
  onOpenChange,
  template,
  serviceName,
}: TemplateDetailDialogProps) {
  if (!template) return null;

  const masterPrompt = (template as any).master_prompt as string | null;
  const category = (template as any).category as string | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template.template_name}
            <Badge variant={template.is_active ? "default" : "secondary"}>
              {template.is_active ? "Active" : "Inactive"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {template.template_description && (
            <p className="text-muted-foreground">
              {template.template_description}
            </p>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="font-medium text-muted-foreground">Service</p>
              <p>{serviceName ?? "—"}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Category</p>
              <p className="capitalize">{category ?? "—"}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Version</p>
              <p>{template.version ?? "1.0"}</p>
            </div>
          </div>

          {template.n8n_template_workflow_id && (
            <div>
              <p className="font-medium text-muted-foreground">
                N8N Workflow ID
              </p>
              <p className="font-mono">{template.n8n_template_workflow_id}</p>
            </div>
          )}

          {(template.required_credentials?.length ?? 0) > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">
                Required Credentials
              </p>
              <div className="flex flex-wrap gap-1">
                {template.required_credentials!.map((c) => (
                  <Badge key={c} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {masterPrompt && (
            <>
              <Separator />
              <div>
                <p className="font-medium text-muted-foreground mb-2">
                  Master Prompt
                </p>
                <pre className="whitespace-pre-wrap bg-muted p-3 rounded-md text-xs font-mono max-h-[300px] overflow-y-auto">
                  {masterPrompt}
                </pre>
              </div>
            </>
          )}

          {template.default_config &&
            Object.keys(template.default_config as object).length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="font-medium text-muted-foreground mb-2">
                    Default Config
                  </p>
                  <pre className="whitespace-pre-wrap bg-muted p-3 rounded-md text-xs font-mono max-h-[200px] overflow-y-auto">
                    {JSON.stringify(template.default_config, null, 2)}
                  </pre>
                </div>
              </>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
