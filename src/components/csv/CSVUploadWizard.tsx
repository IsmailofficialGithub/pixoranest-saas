import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, CheckCircle, ShieldCheck } from "lucide-react";
import { CSVUploadStep } from "./CSVUploadStep";
import { CSVPreviewStep } from "./CSVPreviewStep";
import { CSVValidationStep } from "./CSVValidationStep";
import { CSVConfirmStep } from "./CSVConfirmStep";
import type { ValidationRule } from "@/lib/csv-parser";
import { cn } from "@/lib/utils";

type Step = "upload" | "preview" | "validate" | "confirm";

const STEPS = [
  { id: "upload" as const, label: "Upload", icon: Upload },
  { id: "preview" as const, label: "Preview", icon: FileText },
  { id: "validate" as const, label: "Validate", icon: CheckCircle },
  { id: "confirm" as const, label: "Confirm", icon: ShieldCheck },
];

interface CSVUploadWizardProps {
  onComplete: (data: Record<string, string>[]) => void;
  onCancel?: () => void;
  validationRules: ValidationRule[];
  templateFields?: Array<{ name: string; example: string }>;
}

export function CSVUploadWizard({
  onComplete,
  onCancel,
  validationRules,
  templateFields,
}: CSVUploadWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [validData, setValidData] = useState<Record<string, string>[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);

  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  const goNext = () => {
    const next = currentIndex + 1;
    if (next < STEPS.length) setCurrentStep(STEPS[next].id);
  };

  const goBack = () => {
    const prev = currentIndex - 1;
    if (prev >= 0) setCurrentStep(STEPS[prev].id);
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = index < currentIndex;

          return (
            <div key={step.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                    isActive && "border-primary bg-primary text-primary-foreground",
                    isCompleted && "border-primary bg-primary/10 text-primary",
                    !isActive && !isCompleted && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-10 mb-5 rounded-full",
                    index < currentIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === "upload" && (
            <CSVUploadStep
              validationRules={validationRules}
              templateFields={templateFields}
              onParsed={(data) => {
                setRawData(data);
                goNext();
              }}
              onCancel={onCancel}
            />
          )}

          {currentStep === "preview" && (
            <CSVPreviewStep
              data={rawData}
              onNext={(editedData) => {
                setRawData(editedData);
                goNext();
              }}
              onBack={goBack}
            />
          )}

          {currentStep === "validate" && (
            <CSVValidationStep
              data={rawData}
              validationRules={validationRules}
              onValidated={(valid, invalidCt) => {
                setValidData(valid);
                setInvalidCount(invalidCt);
                goNext();
              }}
              onBack={goBack}
            />
          )}

          {currentStep === "confirm" && (
            <CSVConfirmStep
              validData={validData}
              invalidCount={invalidCount}
              onConfirm={() => onComplete(validData)}
              onBack={goBack}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
