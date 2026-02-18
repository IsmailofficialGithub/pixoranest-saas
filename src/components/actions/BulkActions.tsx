import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Trash2, Mail, Phone, Download, Tag, Archive, MoreHorizontal, CheckCircle, X,
} from "lucide-react";
import { toast } from "sonner";

interface BulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onAction: (action: string, ids: string[]) => Promise<void>;
}

export function BulkActions({ selectedIds, onClearSelection, onAction }: BulkActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async (action: string) => {
    setIsProcessing(true);
    try {
      await onAction(action, selectedIds);
      toast.success(`${action} completed for ${selectedIds.length} item(s)`);
      onClearSelection();
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    await handleAction("delete");
    setShowDeleteDialog(false);
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-card p-2 animate-fade-in">
        <CheckCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected
        </span>

        <div className="mx-1 h-4 w-px bg-border" />

        <Button variant="ghost" size="sm" onClick={() => handleAction("send_email")} disabled={isProcessing}>
          <Mail className="mr-1.5 h-4 w-4" /> Email
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAction("call")} disabled={isProcessing}>
          <Phone className="mr-1.5 h-4 w-4" /> Call
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAction("export")} disabled={isProcessing}>
          <Download className="mr-1.5 h-4 w-4" /> Export
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover z-50">
            <DropdownMenuItem onClick={() => handleAction("add_tag")}>
              <Tag className="mr-2 h-4 w-4" /> Add Tag
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction("archive")}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
