import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useFetcher } from "react-router";
import { TicketCard } from "./ticket-card";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Ticket, TicketStatus } from "~/types/database";

interface KanbanColumnProps {
  id: TicketStatus;
  title: string;
  tickets: Ticket[];
  projectId: string;
}

const statusColors: Record<TicketStatus, string> = {
  backlog: "bg-slate-500/10 border-slate-500/30",
  ready: "bg-blue-500/10 border-blue-500/30",
  in_progress: "bg-amber-500/10 border-amber-500/30",
  in_review: "bg-purple-500/10 border-purple-500/30",
  completed: "bg-emerald-500/10 border-emerald-500/30",
  failed: "bg-red-500/10 border-red-500/30",
};

const statusHeaderColors: Record<TicketStatus, string> = {
  backlog: "text-slate-400",
  ready: "text-blue-400",
  in_progress: "text-amber-400",
  in_review: "text-purple-400",
  completed: "text-emerald-400",
  failed: "text-red-400",
};

export function KanbanColumn({
  id,
  title,
  tickets,
  projectId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const fetcher = useFetcher();
  const isCreating = fetcher.state === "submitting";

  const handleCreateTicket = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("_action", "create-ticket");
    formData.append("status", id);
    fetcher.submit(formData, { method: "post" });
    setIsDialogOpen(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-80 min-w-80 rounded-xl border bg-card/50 backdrop-blur-sm transition-all duration-200",
        statusColors[id],
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h3 className={cn("font-semibold text-sm", statusHeaderColors[id])}>{title}</h3>
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {tickets.length}
          </span>
        </div>
        {(id === "backlog" || id === "ready") && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateTicket}>
                <DialogHeader>
                  <DialogTitle>Create New Ticket</DialogTitle>
                  <DialogDescription>
                    Describe the feature or change you want to implement. This
                    will be used as the prompt for Claude.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="e.g., Add user authentication"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Describe in detail what you want to implement. Include any specific requirements, file locations, or constraints..."
                      className="min-h-32"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Be specific - this description will be sent to Claude as
                      the implementation prompt.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Ticket"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tickets */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        <SortableContext
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </SortableContext>
        {tickets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground/50 text-sm italic">
            No tickets
          </div>
        )}
      </div>
    </div>
  );
}
