import { useState } from "react";
import { useFetcher } from "react-router";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { TicketCard } from "./ticket-card";
import type { Ticket, TicketStatus } from "~/types/database";

const COLUMNS: { id: TicketStatus; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "ready", title: "Ready" },
  { id: "in_progress", title: "In Progress" },
  { id: "in_review", title: "In Review" },
  { id: "completed", title: "Completed" },
  { id: "failed", title: "Failed" },
];

interface KanbanBoardProps {
  tickets: Ticket[];
  projectId: string;
  hasApiKey: boolean;
}

export function KanbanBoard({
  tickets,
  projectId,
  hasApiKey,
}: KanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const fetcher = useFetcher();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getTicketsByStatus = (status: TicketStatus) => {
    return tickets
      .filter((ticket) => ticket.status === status)
      .sort((a, b) => a.position - b.position);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    if (ticket) {
      setActiveTicket(ticket);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);

    if (!over) return;

    const ticketId = active.id as string;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    // Determine target status
    let newStatus: TicketStatus;

    // Check if dropped on a column
    if (COLUMNS.some((col) => col.id === over.id)) {
      newStatus = over.id as TicketStatus;
    } else {
      // Dropped on another ticket - get that ticket's status
      const targetTicket = tickets.find((t) => t.id === over.id);
      if (!targetTicket) return;
      newStatus = targetTicket.status;
    }

    // If status hasn't changed, no need to update
    if (ticket.status === newStatus) return;

    // Get new position (append to end of column)
    const ticketsInColumn = getTicketsByStatus(newStatus);
    const newPosition =
      ticketsInColumn.length > 0
        ? Math.max(...ticketsInColumn.map((t) => t.position)) + 1
        : 0;

    // Submit the move
    fetcher.submit(
      {
        _action: "move-ticket",
        ticketId,
        newStatus,
        newPosition: String(newPosition),
      },
      { method: "post" }
    );

    // If moving to in_progress and has API key, trigger agent
    if (newStatus === "in_progress" && hasApiKey) {
      // The agent will be triggered via the API route
      setTimeout(() => {
        fetch(`/api/tickets/${ticketId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_progress" }),
        });
      }, 500);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 h-full overflow-x-auto pb-6">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tickets={getTicketsByStatus(column.id)}
            projectId={projectId}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTicket ? (
          <TicketCard ticket={activeTicket} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
