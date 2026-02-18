import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  parseCSVWithValidation,
  generateCSVTemplate,
  type ValidationRule,
  type CSVParseResult,
  type CSVError,
} from '@/lib/csv-parser';

interface CSVUploadProps {
  validationRules: ValidationRule[];
  onDataParsed: (data: Record<string, string>[]) => void;
  templateFields?: Array<{ name: string; example: string }>;
}

export function CSVUpload({ validationRules, onDataParsed, templateFields }: CSVUploadProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<CSVParseResult<Record<string, string>> | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv')) return;
      setIsParsing(true);
      setParseResult(null);

      try {
        const result = await parseCSVWithValidation<Record<string, string>>(file, validationRules);
        setParseResult(result);
        if (result.errors.length === 0 && result.data.length > 0) {
          onDataParsed(result.data);
        }
      } catch (error) {
        console.error('CSV parsing error:', error);
      } finally {
        setIsParsing(false);
      }
    },
    [validationRules, onDataParsed]
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

  const downloadTemplate = () => {
    if (templateFields) generateCSVTemplate(templateFields, 'template.csv');
  };

  return (
    <div className="space-y-4">
      {/* Download Template */}
      {templateFields && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('csv-file-input')?.click()}
      >
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onFileSelect}
        />
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        {dragActive ? (
          <p className="text-sm text-primary font-medium">Drop CSV file here...</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Drag and drop CSV file here, or click to select</p>
            <p className="text-xs text-muted-foreground mt-1">Accepted format: .csv</p>
          </>
        )}
      </div>

      {/* Parsing Status */}
      {isParsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 animate-pulse" />
          Parsing and validating CSV...
        </div>
      )}

      {/* Results */}
      {parseResult && (
        <div className="space-y-3">
          {parseResult.errors.length === 0 && parseResult.data.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Successfully parsed {parseResult.meta.validRows} rows
              </AlertDescription>
            </Alert>
          )}

          {parseResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found {parseResult.errors.length} error(s) in {parseResult.meta.invalidRows} row(s).
                {parseResult.meta.validRows > 0 && (
                  <span className="block mt-1">{parseResult.meta.validRows} valid rows can be imported.</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Details (max 10) */}
          {parseResult.errors.length > 0 && (
            <div className="bg-muted rounded-md p-3">
              <p className="text-xs font-medium text-foreground mb-2">Error Details:</p>
              <ul className="space-y-1">
                {parseResult.errors.slice(0, 10).map((error: CSVError, index: number) => (
                  <li key={index} className="text-xs text-destructive">
                    Row {error.row}: {error.message}
                    {error.field && <span className="text-muted-foreground"> (Field: {error.field})</span>}
                  </li>
                ))}
              </ul>
              {parseResult.errors.length > 10 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ...and {parseResult.errors.length - 10} more errors
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {parseResult.meta.validRows > 0 && parseResult.errors.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onDataParsed(parseResult.data)}>
                Import {parseResult.meta.validRows} Valid Rows
              </Button>
              <Button variant="outline" size="sm" onClick={() => setParseResult(null)}>
                Fix Errors & Re-upload
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
