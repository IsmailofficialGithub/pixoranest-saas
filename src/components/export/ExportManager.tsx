import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText, Table as TableIcon, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

type ExportFormat = "csv" | "pdf" | "json";

interface ExportManagerProps {
  data: Record<string, unknown>[];
  filename: string;
  columns?: string[];
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportManager({ data, filename, columns: columnsProp }: ExportManagerProps) {
  const allColumns = columnsProp ?? (data.length > 0 ? Object.keys(data[0]) : []);
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(allColumns);

  const filterData = () =>
    data.map((item) => {
      const row: Record<string, unknown> = {};
      selectedColumns.forEach((col) => { row[col] = item[col]; });
      return row;
    });

  const exportCSV = (rows: Record<string, unknown>[]) => {
    const csv = Papa.unparse(rows, { columns: selectedColumns });
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${filename}.csv`);
  };

  const exportJSON = (rows: Record<string, unknown>[]) => {
    downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }), `${filename}.json`);
  };

  const exportPDF = async (rows: Record<string, unknown>[]) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(filename, 14, 18);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 25);
    autoTable(doc, {
      startY: 32,
      head: [selectedColumns.map((c) => c.replace(/_/g, " "))],
      body: rows.map((r) => selectedColumns.map((c) => String(r[c] ?? ""))),
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 34, 34] },
    });
    doc.save(`${filename}.pdf`);
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      toast.error("Select at least one column");
      return;
    }
    const toastId = toast.loading(`Exporting ${data.length} records…`);
    try {
      const rows = filterData();
      if (format === "csv") exportCSV(rows);
      else if (format === "json") exportJSON(rows);
      else await exportPDF(rows);
      toast.success("Export completed", { id: toastId });
      setIsOpen(false);
    } catch {
      toast.error("Export failed", { id: toastId });
    }
  };

  const toggleColumn = (col: string, checked: boolean) => {
    setSelectedColumns((prev) => checked ? [...prev, col] : prev.filter((c) => c !== col));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Choose format and columns to export {data.length} records
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)} className="space-y-2">
              <label className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
                <RadioGroupItem value="csv" />
                <TableIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">CSV (Comma Separated)</span>
              </label>
              <label className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
                <RadioGroupItem value="pdf" />
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">PDF Document</span>
              </label>
              <label className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
                <RadioGroupItem value="json" />
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">JSON (Raw Data)</span>
              </label>
            </RadioGroup>
          </div>

          {/* Columns */}
          <div className="space-y-2">
            <Label>Select Columns</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-md border p-3">
              {allColumns.map((col) => (
                <label key={col} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedColumns.includes(col)}
                    onCheckedChange={(checked) => toggleColumn(col, !!checked)}
                  />
                  <span className="capitalize">{col.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" onClick={() => setSelectedColumns(allColumns)}>
              Select All
            </Button>
            <Button onClick={handleExport} disabled={selectedColumns.length === 0}>
              Export {selectedColumns.length} Column{selectedColumns.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
