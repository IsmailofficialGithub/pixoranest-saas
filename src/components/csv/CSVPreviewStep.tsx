import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface CSVPreviewStepProps {
  data: Record<string, string>[];
  onNext: (editedData: Record<string, string>[]) => void;
  onBack: () => void;
}

export function CSVPreviewStep({ data, onNext, onBack }: CSVPreviewStepProps) {
  const [rows, setRows] = useState<Record<string, string>[]>(() =>
    data.map((r) => ({ ...r }))
  );
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: string;
  } | null>(null);

  const columns = Object.keys(rows[0] ?? {});

  const handleCellEdit = (rowIndex: number, col: string, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [col]: value };
      return next;
    });
  };

  const commitEdit = () => setEditingCell(null);

  const deleteRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const addRow = () => {
    const empty = columns.reduce(
      (acc, col) => ({ ...acc, [col]: "" }),
      {} as Record<string, string>
    );
    setRows((prev) => [...prev, empty]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Preview &amp; Edit
          </h3>
          <p className="text-sm text-muted-foreground">
            Click any cell to edit. Review your data before validation.
          </p>
        </div>
        <Badge variant="secondary">{rows.length} contacts</Badge>
      </div>

      <ScrollArea className="max-h-[400px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              {columns.map((col) => (
                <TableHead key={col} className="capitalize whitespace-nowrap">
                  {col.replace(/_/g, " ")}
                </TableHead>
              ))}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, ri) => (
              <TableRow key={ri}>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {ri + 1}
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col} className="p-1">
                    {editingCell?.row === ri && editingCell?.col === col ? (
                      <Input
                        autoFocus
                        defaultValue={row[col] ?? ""}
                        onBlur={(e) => {
                          handleCellEdit(ri, col, e.target.value);
                          commitEdit();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCellEdit(
                              ri,
                              col,
                              e.currentTarget.value
                            );
                            commitEdit();
                          }
                          if (e.key === "Escape") commitEdit();
                        }}
                        className="h-8 text-xs"
                      />
                    ) : (
                      <div
                        onClick={() => setEditingCell({ row: ri, col })}
                        className="cursor-pointer hover:bg-muted rounded px-2 py-1 min-h-[32px] text-xs flex items-center"
                      >
                        {row[col] || (
                          <span className="text-muted-foreground italic">
                            Empty
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                ))}
                <TableCell className="p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteRow(ri)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="h-4 w-4 mr-1" /> Add Row
      </Button>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => onNext(rows)} disabled={rows.length === 0}>
          Next: Validate Data
        </Button>
      </div>
    </div>
  );
}
