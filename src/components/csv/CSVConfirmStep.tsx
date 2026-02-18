import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Upload } from "lucide-react";

interface CSVConfirmStepProps {
  validData: Record<string, string>[];
  invalidCount: number;
  onConfirm: () => void;
  onBack: () => void;
}

export function CSVConfirmStep({
  validData,
  invalidCount,
  onConfirm,
  onBack,
}: CSVConfirmStepProps) {
  const columns = Object.keys(validData[0] ?? {});

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Ready to Import
        </h3>
        <p className="text-sm text-muted-foreground">
          Review the summary below and confirm the import.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-primary">{validData.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Contacts to import
          </p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{invalidCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Skipped</p>
        </div>
      </div>

      {/* Fields detected */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Fields detected:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((col) => (
            <Badge key={col} variant="secondary" className="capitalize text-xs">
              {col.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      </div>

      {invalidCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border bg-accent/30 p-3 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <span>
            {invalidCount} row(s) were skipped due to validation errors. Go back
            to review and fix them.
          </span>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onConfirm}>
          <Upload className="h-4 w-4 mr-2" />
          Import {validData.length} Contacts
        </Button>
      </div>
    </div>
  );
}
