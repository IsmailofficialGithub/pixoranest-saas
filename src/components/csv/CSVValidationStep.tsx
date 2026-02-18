import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Wand2,
} from "lucide-react";
import type { ValidationRule } from "@/lib/csv-parser";

interface RowError {
  field: string;
  message: string;
  fixable: boolean;
  suggestion?: string;
}

interface InvalidItem {
  index: number;
  row: Record<string, string>;
  errors: RowError[];
}

interface CSVValidationStepProps {
  data: Record<string, string>[];
  validationRules: ValidationRule[];
  onValidated: (validData: Record<string, string>[], invalidCount: number) => void;
  onBack: () => void;
}

export function CSVValidationStep({
  data,
  validationRules,
  onValidated,
  onBack,
}: CSVValidationStepProps) {
  const [validating, setValidating] = useState(true);
  const [validData, setValidData] = useState<Record<string, string>[]>([]);
  const [fixableItems, setFixableItems] = useState<InvalidItem[]>([]);
  const [unfixableItems, setUnfixableItems] = useState<InvalidItem[]>([]);

  useEffect(() => {
    runValidation();
  }, []);

  const validateRow = (row: Record<string, string>): RowError[] => {
    const errors: RowError[] = [];

    validationRules.forEach((rule) => {
      const value = row[rule.field];

      // Required check
      if (rule.required && (!value || value.trim() === "")) {
        errors.push({
          field: rule.field,
          message: `${rule.field} is required`,
          fixable: false,
        });
        return;
      }

      if (!value || value.trim() === "") return;

      // Phone: suggest adding +91 if missing +
      if (rule.type === "phone" && !value.startsWith("+")) {
        errors.push({
          field: rule.field,
          message: "Phone must start with + and country code",
          fixable: true,
          suggestion: `+91${value.replace(/[\s\-()]/g, "")}`,
        });
        return;
      }

      // Email validation
      if (rule.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push({
          field: rule.field,
          message: "Invalid email format",
          fixable: false,
        });
        return;
      }

      // Pattern
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({
          field: rule.field,
          message: `${rule.field} format is invalid`,
          fixable: false,
        });
        return;
      }

      // Custom
      if (rule.custom) {
        const msg = rule.custom(value, row);
        if (msg) {
          // Name too long is fixable
          const isLengthIssue = msg.toLowerCase().includes("less than") || msg.toLowerCase().includes("characters");
          errors.push({
            field: rule.field,
            message: msg,
            fixable: isLengthIssue,
            suggestion: isLengthIssue ? value.substring(0, 100) : undefined,
          });
        }
      }
    });

    return errors;
  };

  const runValidation = () => {
    setValidating(true);

    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      const valid: Record<string, string>[] = [];
      const fixable: InvalidItem[] = [];
      const unfixable: InvalidItem[] = [];

      data.forEach((row, index) => {
        const errors = validateRow(row);
        if (errors.length === 0) {
          valid.push(row);
        } else if (errors.some((e) => e.fixable)) {
          fixable.push({ index: index + 1, row: { ...row }, errors });
        } else {
          unfixable.push({ index: index + 1, row: { ...row }, errors });
        }
      });

      setValidData(valid);
      setFixableItems(fixable);
      setUnfixableItems(unfixable);
      setValidating(false);
    }, 100);
  };

  const applyFix = (itemIndex: number, field: string, suggestion: string) => {
    setFixableItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[itemIndex] };
      item.row = { ...item.row, [field]: suggestion };

      // Re-validate after fix
      const newErrors = validateRow(item.row);
      if (newErrors.length === 0) {
        // Move to valid
        setValidData((v) => [...v, item.row]);
        return updated.filter((_, i) => i !== itemIndex);
      }

      item.errors = newErrors;
      updated[itemIndex] = item;
      return updated;
    });
  };

  const autoFixAll = () => {
    const newValid: Record<string, string>[] = [];
    const remaining: InvalidItem[] = [];

    fixableItems.forEach((item) => {
      const fixedRow = { ...item.row };
      item.errors.forEach((err) => {
        if (err.fixable && err.suggestion) {
          fixedRow[err.field] = err.suggestion;
        }
      });

      const newErrors = validateRow(fixedRow);
      if (newErrors.length === 0) {
        newValid.push(fixedRow);
      } else {
        remaining.push({ ...item, row: fixedRow, errors: newErrors });
      }
    });

    setValidData((prev) => [...prev, ...newValid]);
    setFixableItems(remaining);
  };

  if (validating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Validating {data.length} contacts...
        </p>
      </div>
    );
  }

  const totalInvalid = fixableItems.length + unfixableItems.length;

  return (
    <div className="space-y-5">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-4 py-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          <div className="text-sm">
            <span className="font-bold">{validData.length}</span> valid
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-accent px-4 py-2">
          <AlertTriangle className="h-5 w-5 text-accent-foreground" />
          <div className="text-sm">
            <span className="font-bold">{fixableItems.length}</span> fixable
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-destructive/5 px-4 py-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div className="text-sm">
            <span className="font-bold">{unfixableItems.length}</span> invalid
          </div>
        </div>
      </div>

      {/* Fixable errors */}
      {fixableItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">
              Fixable Errors ({fixableItems.length})
            </h4>
            <Button variant="outline" size="sm" onClick={autoFixAll}>
              <Wand2 className="h-3.5 w-3.5 mr-1" /> Auto-fix All
            </Button>
          </div>

          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {fixableItems.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border bg-accent/30 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Row {item.index}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.errors.length} issue(s)
                  </span>
                </div>
                {item.errors.map((err, ei) => (
                  <div
                    key={ei}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-destructive">{err.message}</span>
                    {err.fixable && err.suggestion && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() =>
                          applyFix(idx, err.field, err.suggestion!)
                        }
                      >
                        Use: {err.suggestion}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unfixable errors */}
      {unfixableItems.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {unfixableItems.length} contact(s) have errors that cannot be
            auto-fixed and will be excluded from import.
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={() => onValidated(validData, totalInvalid)}
          disabled={validData.length === 0}
        >
          Next: Confirm Import ({validData.length} contacts)
        </Button>
      </div>
    </div>
  );
}
