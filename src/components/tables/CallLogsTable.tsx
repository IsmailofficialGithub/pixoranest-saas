import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Phone, Play, Download } from "lucide-react";
import { DataTable } from "./DataTable";
import { formatDistanceToNow } from "date-fns";

type CallLog = {
  id: string;
  phone_number: string;
  status: string;
  duration_seconds: number | null;
  executed_at: string | null;
  recording_url?: string | null;
  transcript?: string | null;
  campaign_name?: string;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  answered: "default",
  initiated: "secondary",
  ringing: "secondary",
  busy: "outline",
  no_answer: "outline",
  failed: "destructive",
};

export const callLogsColumns: ColumnDef<CallLog>[] = [
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
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "phone_number",
    header: "Phone Number",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.getValue("phone_number")}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={statusVariant[status] ?? "secondary"}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "duration_seconds",
    header: "Duration",
    cell: ({ row }) => {
      const seconds = (row.getValue("duration_seconds") as number) || 0;
      const minutes = Math.floor(seconds / 60);
      const rem = seconds % 60;
      return (
        <span className="font-mono text-sm">
          {minutes}:{rem.toString().padStart(2, "0")}
        </span>
      );
    },
  },
  {
    accessorKey: "campaign_name",
    header: "Campaign",
    cell: ({ row }) => {
      const campaign = row.getValue("campaign_name") as string | undefined;
      return campaign ? <Badge variant="outline">{campaign}</Badge> : <span className="text-muted-foreground">—</span>;
    },
  },
  {
    accessorKey: "executed_at",
    header: "Time",
    cell: ({ row }) => {
      const val = row.getValue("executed_at") as string | null;
      if (!val) return <span className="text-muted-foreground">—</span>;
      const date = new Date(val);
      return (
        <div>
          <p className="text-sm">{formatDistanceToNow(date, { addSuffix: true })}</p>
          <p className="text-xs text-muted-foreground">{date.toLocaleString()}</p>
        </div>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const call = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(call.id)}>
              Copy call ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {call.recording_url && (
              <DropdownMenuItem><Play className="mr-2 h-4 w-4" /> Play Recording</DropdownMenuItem>
            )}
            {call.transcript && (
              <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> View Transcript</DropdownMenuItem>
            )}
            <DropdownMenuItem>View Details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function CallLogsTable({ data }: { data: CallLog[] }) {
  return (
    <DataTable
      columns={callLogsColumns}
      data={data}
      searchPlaceholder="Search call logs..."
      onExport={() => console.log("Exporting call logs...")}
    />
  );
}
