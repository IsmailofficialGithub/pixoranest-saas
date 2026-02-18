import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Star, Mail, Phone, Building } from "lucide-react";
import { DataTable } from "./DataTable";

type Lead = {
  id: string;
  name: string | null;
  phone: string;
  email?: string | null;
  company?: string | null;
  lead_score: number | null;
  status: string | null;
  created_at: string;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  contacted: { label: "Contacted", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  qualified: { label: "Qualified", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  converted: { label: "Converted", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  lost: { label: "Lost", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

export const leadsColumns: ColumnDef<Lead>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : false)}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <div>
          <p className="font-medium">{lead.name || "Unknown"}</p>
          {lead.company && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building className="h-3 w-3" />
              {lead.company}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "phone",
    header: "Contact",
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {lead.phone}
          </div>
          {lead.email && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              {lead.email}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "lead_score",
    header: "Score",
    cell: ({ row }) => {
      const score = (row.getValue("lead_score") as number) ?? 0;
      const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : score >= 40 ? "text-orange-600" : "text-red-600";
      return (
        <div className="w-24 space-y-1">
          <div className="flex items-center gap-1">
            <Star className={`h-3 w-3 ${color}`} />
            <span className={`text-sm font-semibold ${color}`}>{score}</span>
          </div>
          <Progress value={score} className="h-1.5" />
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = (row.getValue("status") as string) || "new";
      const config = statusConfig[status] || statusConfig.new;
      return <Badge className={config.className} variant="outline">{config.label}</Badge>;
    },
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {new Date(row.getValue("created_at")).toLocaleDateString()}
      </span>
    ),
  },
];

export function LeadsTable({ data }: { data: Lead[] }) {
  return (
    <DataTable
      columns={leadsColumns}
      data={data}
      searchPlaceholder="Search leads..."
      onExport={() => console.log("Exporting leads...")}
    />
  );
}
