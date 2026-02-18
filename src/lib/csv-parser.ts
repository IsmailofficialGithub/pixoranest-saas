import Papa from 'papaparse';

export interface CSVParseResult<T> {
  data: T[];
  errors: CSVError[];
  meta: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

export interface CSVError {
  row: number;
  field?: string;
  message: string;
  value?: string;
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'phone' | 'date';
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: string, row: Record<string, string>) => string | null;
}

/**
 * Parse and validate CSV file
 */
export async function parseCSVWithValidation<T>(
  file: File,
  validationRules: ValidationRule[]
): Promise<CSVParseResult<T>> {
  return new Promise((resolve) => {
    const errors: CSVError[] = [];
    const validData: T[] = [];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) =>
        header.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        const rows = results.data as Record<string, string>[];

        rows.forEach((row, index) => {
          const rowErrors = validateRow(row, validationRules, index + 2);

          if (rowErrors.length === 0) {
            validData.push(row as unknown as T);
          } else {
            errors.push(...rowErrors);
          }
        });

        // Count unique invalid rows
        const invalidRowNumbers = new Set(errors.map((e) => e.row));

        resolve({
          data: validData,
          errors,
          meta: {
            totalRows: rows.length,
            validRows: validData.length,
            invalidRows: invalidRowNumbers.size,
          },
        });
      },
      error: (error: Error) => {
        resolve({
          data: [],
          errors: [{ row: 0, message: `CSV parsing error: ${error.message}` }],
          meta: { totalRows: 0, validRows: 0, invalidRows: 0 },
        });
      },
    });
  });
}

function validateRow(
  row: Record<string, string>,
  rules: ValidationRule[],
  rowNumber: number
): CSVError[] {
  const errors: CSVError[] = [];

  rules.forEach((rule) => {
    const value = row[rule.field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ row: rowNumber, field: rule.field, message: `${rule.field} is required`, value });
      return;
    }

    if (!value && !rule.required) return;

    if (rule.type) {
      const typeError = validateType(value, rule.type, rule.field, rowNumber);
      if (typeError) { errors.push(typeError); return; }
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push({ row: rowNumber, field: rule.field, message: `${rule.field} format is invalid`, value });
      return;
    }

    if (rule.type === 'number') {
      const numValue = Number(value);
      if (rule.min !== undefined && numValue < rule.min) {
        errors.push({ row: rowNumber, field: rule.field, message: `${rule.field} must be at least ${rule.min}`, value });
      }
      if (rule.max !== undefined && numValue > rule.max) {
        errors.push({ row: rowNumber, field: rule.field, message: `${rule.field} must be at most ${rule.max}`, value });
      }
    }

    if (rule.custom) {
      const customError = rule.custom(value, row);
      if (customError) {
        errors.push({ row: rowNumber, field: rule.field, message: customError, value });
      }
    }
  });

  return errors;
}

function validateType(value: string, type: string, field: string, rowNumber: number): CSVError | null {
  switch (type) {
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return { row: rowNumber, field, message: `${field} must be a valid email`, value };
      break;
    }
    case 'phone': {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(value.replace(/[\s\-()]/g, '')))
        return { row: rowNumber, field, message: `${field} must be a valid phone number (e.g., +919876543210)`, value };
      break;
    }
    case 'number':
      if (isNaN(Number(value))) return { row: rowNumber, field, message: `${field} must be a number`, value };
      break;
    case 'date':
      if (isNaN(Date.parse(value))) return { row: rowNumber, field, message: `${field} must be a valid date`, value };
      break;
  }
  return null;
}

/**
 * Export data to CSV and trigger download
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  headers?: string[]
) {
  const csv = Papa.unparse(data, { header: true, columns: headers });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate and download a sample CSV template
 */
export function generateCSVTemplate(
  fields: Array<{ name: string; example: string }>,
  filename: string
) {
  const sampleRow = fields.reduce(
    (obj, field) => { obj[field.name] = field.example; return obj; },
    {} as Record<string, string>
  );
  exportToCSV([sampleRow], filename);
}
