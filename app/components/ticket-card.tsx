import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
  Link2,
  Lock,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { Ticket, TicketDependency } from "~/types/database";

interface TicketCardProps {
  ticket: Ticket;
  isDragging?: boolean;
  allTickets?: Ticket[];
  dependencies?: TicketDependency[];
}

export function TicketCard({
  ticket,
  isDragging,
  allTickets = [],
  dependencies = [],
}: TicketCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDependencyOpen, setIsDependencyOpen] = useState(false);
  const [selectedDependency, setSelectedDependency] = useState<string>("");
  const fetcher = useFetcher();

  // Calculate dependency information
  const { ticketDependencies, blockedByTickets, blockingTickets, isBlocked } = useMemo(() => {
    // Tickets this ticket depends on (must be completed before this one can start)
    const ticketDeps = dependencies.filter((d) => d.ticket_id === ticket.id);
    const dependsOnIds = ticketDeps.map((d) => d.depends_on_ticket_id);
    const dependsOnTickets = allTickets.filter((t) => dependsOnIds.includes(t.id));

    // Tickets that are blocking this one (incomplete dependencies)
    const blockedBy = dependsOnTickets.filter((t) => t.status !== "completed");

    // Tickets that depend on this ticket (this ticket blocks them)
    const dependentDeps = dependencies.filter((d) => d.depends_on_ticket_id === ticket.id);
    const dependentIds = dependentDeps.map((d) => d.ticket_id);
    const blocking = allTickets.filter((t) => dependentIds.includes(t.id));

    return {
      ticketDependencies: dependsOnTickets,
      blockedByTickets: blockedBy,
      blockingTickets: blocking,
      isBlocked: blockedBy.length > 0,
    };
  }, [ticket.id, dependencies, allTickets]);

  // Get available tickets that can be added as dependencies
  const availableDependencies = useMemo(() => {
    const currentDependencyIds = ticketDependencies.map((t) => t.id);
    return allTickets.filter(
      (t) =>
        t.id !== ticket.id && // Can't depend on self
        !currentDependencyIds.includes(t.id) // Not already a dependency
    );
  }, [ticket.id, ticketDependencies, allTickets]);

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

  const handleAddDependency = () => {
    if (!selectedDependency) return;
    fetcher.submit(
      {
        _action: "add-dependency",
        ticketId: ticket.id,
        dependsOnTicketId: selectedDependency,
      },
      { method: "post" }
    );
    setSelectedDependency("");
  };

  const handleRemoveDependency = (dependsOnTicketId: string) => {
    fetcher.submit(
      {
        _action: "remove-dependency",
        ticketId: ticket.id,
        dependsOnTicketId,
      },
      { method: "post" }
    );
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
          "cursor-grab active:cursor-grabbing card-hover bg-card/80 backdrop-blur-sm",
          (isDragging || isSortableDragging) && "opacity-50 shadow-lg scale-105",
          isInProgress && "ring-2 ring-amber-400/50 border-amber-400/30",
          isBlocked && "ring-2 ring-orange-400/50 border-orange-400/30 opacity-75"
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
                <DropdownMenuItem
                  onClick={() => setIsDependencyOpen(true)}
                  disabled={isInProgress}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Dependencies
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
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={ticket.status as any}
              className="text-xs capitalize"
            >
              {ticket.status.replace("_", " ")}
            </Badge>
            {isBlocked && (
              <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/50">
                <Lock className="h-2.5 w-2.5 mr-1" />
                Blocked
              </Badge>
            )}
            {ticketDependencies.length > 0 && !isBlocked && (
              <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/50">
                <Link2 className="h-2.5 w-2.5 mr-1" />
                {ticketDependencies.length}
              </Badge>
            )}
            {blockingTickets.length > 0 && (
              <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/50">
                Blocks {blockingTickets.length}
              </Badge>
            )}
            {isInProgress && (
              <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
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
            {ticketDependencies.length > 0 && (
              <div>
                <Label className="text-muted-foreground">Dependencies (must be completed first)</Label>
                <ul className="mt-1 space-y-1">
                  {ticketDependencies.map((dep) => (
                    <li key={dep.id} className="flex items-center gap-2 text-sm">
                      <Badge
                        variant={dep.status as any}
                        className="text-xs capitalize"
                      >
                        {dep.status.replace("_", " ")}
                      </Badge>
                      <span className={cn(dep.status !== "completed" && "text-orange-400")}>
                        {dep.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {blockingTickets.length > 0 && (
              <div>
                <Label className="text-muted-foreground">Blocking (waiting on this ticket)</Label>
                <ul className="mt-1 space-y-1">
                  {blockingTickets.map((dep) => (
                    <li key={dep.id} className="text-sm text-purple-400">
                      {dep.title}
                    </li>
                  ))}
                </ul>
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

      {/* Dependency Dialog */}
      <Dialog open={isDependencyOpen} onOpenChange={setIsDependencyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Dependencies</DialogTitle>
            <DialogDescription>
              Set which tickets must be completed before "{ticket.title}" can be
              started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Dependencies */}
            {ticketDependencies.length > 0 && (
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Current Dependencies
                </Label>
                <div className="space-y-2">
                  {ticketDependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant={dep.status as any}
                          className="text-xs capitalize shrink-0"
                        >
                          {dep.status.replace("_", " ")}
                        </Badge>
                        <span className="text-sm truncate">{dep.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveDependency(dep.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Dependency */}
            {availableDependencies.length > 0 && (
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Add Dependency
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedDependency}
                    onValueChange={setSelectedDependency}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a ticket..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDependencies.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={t.status as any}
                              className="text-xs capitalize"
                            >
                              {t.status.replace("_", " ")}
                            </Badge>
                            <span className="truncate">{t.title}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={handleAddDependency}
                    disabled={!selectedDependency}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This ticket will be blocked until the selected ticket is
                  completed.
                </p>
              </div>
            )}

            {ticketDependencies.length === 0 &&
              availableDependencies.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No other tickets available to set as dependencies.
                </p>
              )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDependencyOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
