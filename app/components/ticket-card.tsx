import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFetcher } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Trash2,
  Loader2,
  GitPullRequest,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { Ticket } from "~/types/database";

interface TicketCardProps {
  ticket: Ticket;
  isDragging?: boolean;
}

export function TicketCard({ ticket, isDragging }: TicketCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const fetcher = useFetcher();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("_action", "update-ticket");
    formData.append("ticketId", ticket.id);
    fetcher.submit(formData, { method: "post" });
    setIsEditOpen(false);
  };

  const handleDelete = () => {
    fetcher.submit(
      { _action: "delete-ticket", ticketId: ticket.id },
      { method: "post" }
    );
    setIsDeleteOpen(false);
  };

  const isInProgress = ticket.status === "in_progress";
  const isCompleted = ticket.status === "completed";
  const isFailed = ticket.status === "failed";
  const haspr = !!ticket.pr_url;

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "cursor-grab active:cursor-grabbing",
          (isDragging || isSortableDragging) && "opacity-50 shadow-lg",
          isInProgress && "ring-2 ring-yellow-400 animate-pulse"
        )}
        {...attributes}
        {...listeners}
      >
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle
              className="text-sm font-medium cursor-pointer hover:underline"
              onClick={() => setIsViewOpen(true)}
            >
              {ticket.title}
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsViewOpen(true)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsEditOpen(true)}
                  disabled={isInProgress}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {haspr && (
                  <DropdownMenuItem asChild>
                    <a
                      href={ticket.pr_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <GitPullRequest className="mr-2 h-4 w-4" />
                      View PR
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDeleteOpen(true)}
                  disabled={isInProgress}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <CardDescription className="text-xs line-clamp-2 mb-2">
            {ticket.description}
          </CardDescription>
          <div className="flex items-center gap-2">
            <Badge
              variant={ticket.status as any}
              className="text-xs capitalize"
            >
              {ticket.status.replace("_", " ")}
            </Badge>
            {isInProgress && (
              <Loader2 className="h-3 w-3 animate-spin text-yellow-600" />
            )}
            {haspr && (
              <a
                href={ticket.pr_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <GitPullRequest className="h-3 w-3" />
              </a>
            )}
          </div>
          {ticket.error_message && (
            <p className="text-xs text-destructive mt-2 line-clamp-2">
              {ticket.error_message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ticket.title}</DialogTitle>
            <DialogDescription>
              <Badge
                variant={ticket.status as any}
                className="capitalize mt-2"
              >
                {ticket.status.replace("_", " ")}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {ticket.description}
              </p>
            </div>
            {ticket.pr_url && (
              <div>
                <Label className="text-muted-foreground">Pull Request</Label>
                <a
                  href={ticket.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <GitPullRequest className="h-4 w-4" />
                  PR #{ticket.pr_number}
                </a>
              </div>
            )}
            {ticket.error_message && (
              <div>
                <Label className="text-muted-foreground">Error</Label>
                <p className="mt-1 text-sm text-destructive">
                  {ticket.error_message}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Edit Ticket</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  name="title"
                  defaultValue={ticket.title}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={ticket.description}
                  className="min-h-32"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ticket</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{ticket.title}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
