import { useState, useCallback } from "react";
import { Upload, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import Papa from "papaparse";
import {
  generateCSVTemplate,
  type ValidationRule,
} from "@/lib/csv-parser";

interface CSVUploadStepProps {
  validationRules: ValidationRule[];
  templateFields?: Array<{ name: string; example: string }>;
  onParsed: (data: Record<string, string>[]) => void;
  onCancel?: () => void;
}

export function CSVUploadStep({
  validationRules,
  templateFields,
  onParsed,
  onCancel,
}: CSVUploadStepProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) return;
      setIsParsing(true);
      setFileName(file.name);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) =>
          header.trim().toLowerCase().replace(/\s+/g, "_"),
        complete: (results) => {
          const rows = results.data as Record<string, string>[];
          setIsParsing(false);
          onParsed(rows);
        },
        error: () => {
          setIsParsing(false);
        },
      });
    },
    [onParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Upload CSV File</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV file with your contacts. Headers will be auto-detected.
        </p>
      </div>

      {templateFields && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateCSVTemplate(templateFields, "contacts-template.csv")}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById("csv-wizard-input")?.click()}
      >
        <input
          id="csv-wizard-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onFileSelect}
        />
        {isParsing ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-10 w-10 text-primary animate-pulse" />
            <p className="text-sm text-primary font-medium">
              Parsing {fileName}...
            </p>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drag and drop your CSV file here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse • .csv files only
            </p>
          </>
        )}
      </div>

      {onCancel && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
