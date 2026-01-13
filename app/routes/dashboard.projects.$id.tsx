import { redirect, Link } from "react-router";
import type { Route } from "./+types/dashboard.projects.$id";
import { KanbanBoard } from "~/components/kanban-board";
import { WorkflowSetupDialog } from "~/components/workflow-setup-dialog";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Github, ExternalLink, Settings } from "lucide-react";
import type { TicketStatus, Ticket, TicketDependency } from "~/types/database";

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: data?.project
        ? `${data.project.name} - AutoBuild Orchestrator`
        : "Project - AutoBuild Orchestrator",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireUser } = await import("~/lib/auth.server");
  const { getDb } = await import("~/lib/db.server");

  const user = await requireUser(request);
  const db = getDb();

  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", params.id!)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (!project) {
    throw redirect("/dashboard");
  }

  // Redirect if project is deleted
  if (project.deleted_at) {
    throw redirect("/dashboard");
  }

  const tickets = await db
    .selectFrom("tickets")
    .selectAll()
    .where("project_id", "=", project.id)
    .orderBy("position", "asc")
    .execute();

  // Fetch all dependencies for tickets in this project
  const dependencies = await db
    .selectFrom("ticket_dependencies")
    .selectAll()
    .where(
      "ticket_id",
      "in",
      tickets.map((t) => t.id)
    )
    .execute();

  // Check if user has API key configured
  const hasApiKey = !!user.anthropic_api_key;

  return { project, tickets, dependencies, hasApiKey };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { requireUser } = await import("~/lib/auth.server");
  const { getDb } = await import("~/lib/db.server");

  const user = await requireUser(request);
  const formData = await request.formData();
  const action = formData.get("_action");

  const db = getDb();

  // Verify project ownership
  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", params.id!)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (!project) {
    return { error: "Project not found" };
  }

  if (action === "create-ticket") {
    const title = formData.get("title");
    const description = formData.get("description");
    const status = (formData.get("status") as TicketStatus) || "backlog";

    if (!title || !description) {
      return { error: "Title and description are required" };
    }

    // Get max position for the status column
    const maxPosition = await db
      .selectFrom("tickets")
      .select(({ fn }) => [fn.max("position").as("max")])
      .where("project_id", "=", project.id)
      .where("status", "=", status)
      .executeTakeFirst();

    const position = (Number(maxPosition?.max) || 0) + 1;

    await db
      .insertInto("tickets")
      .values({
        project_id: project.id,
        title: String(title),
        description: String(description),
        status,
        priority: 0,
        position,
      })
      .execute();

    return { success: true };
  }

  if (action === "update-ticket") {
    const ticketId = formData.get("ticketId");
    const title = formData.get("title");
    const description = formData.get("description");

    if (!ticketId) {
      return { error: "Ticket ID is required" };
    }

    await db
      .updateTable("tickets")
      .set({
        ...(title && { title: String(title) }),
        ...(description && { description: String(description) }),
      })
      .where("id", "=", String(ticketId))
      .where("project_id", "=", project.id)
      .execute();

    return { success: true };
  }

  if (action === "delete-ticket") {
    const ticketId = formData.get("ticketId");

    if (!ticketId) {
      return { error: "Ticket ID is required" };
    }

    await db
      .deleteFrom("tickets")
      .where("id", "=", String(ticketId))
      .where("project_id", "=", project.id)
      .execute();

    return { success: true };
  }

  if (action === "move-ticket") {
    const ticketId = formData.get("ticketId");
    const newStatus = formData.get("newStatus") as TicketStatus;
    const newPosition = Number(formData.get("newPosition"));

    if (!ticketId || !newStatus) {
      return { error: "Ticket ID and status are required" };
    }

    // Check if moving to in_progress and there's already one in progress
    if (newStatus === "in_progress") {
      const existingInProgress = await db
        .selectFrom("tickets")
        .selectAll()
        .where("project_id", "=", project.id)
        .where("status", "=", "in_progress")
        .where("id", "!=", String(ticketId))
        .executeTakeFirst();

      if (existingInProgress) {
        return {
          error:
            "Only one ticket can be in progress at a time. Please wait for the current ticket to complete.",
        };
      }

      // Check if ticket has uncompleted dependencies
      const dependencies = await db
        .selectFrom("ticket_dependencies")
        .innerJoin("tickets", "tickets.id", "ticket_dependencies.depends_on_ticket_id")
        .select(["tickets.id", "tickets.title", "tickets.status"])
        .where("ticket_dependencies.ticket_id", "=", String(ticketId))
        .execute();

      const uncompletedDeps = dependencies.filter((dep) => dep.status !== "completed");
      if (uncompletedDeps.length > 0) {
        const blockerNames = uncompletedDeps.map((d) => `"${d.title}"`).join(", ");
        return {
          error: `This ticket is blocked by incomplete dependencies: ${blockerNames}. Complete those tickets first.`,
        };
      }
    }

    await db
      .updateTable("tickets")
      .set({
        status: newStatus,
        position: newPosition,
      })
      .where("id", "=", String(ticketId))
      .where("project_id", "=", project.id)
      .execute();

    return { success: true, newStatus };
  }

  if (action === "add-dependency") {
    const ticketId = formData.get("ticketId");
    const dependsOnTicketId = formData.get("dependsOnTicketId");

    if (!ticketId || !dependsOnTicketId) {
      return { error: "Both ticket IDs are required" };
    }

    if (ticketId === dependsOnTicketId) {
      return { error: "A ticket cannot depend on itself" };
    }

    // Verify both tickets belong to this project
    const ticketIds = [String(ticketId), String(dependsOnTicketId)];
    const ticketsExist = await db
      .selectFrom("tickets")
      .select("id")
      .where("id", "in", ticketIds)
      .where("project_id", "=", project.id)
      .execute();

    if (ticketsExist.length !== 2) {
      return { error: "One or both tickets not found in this project" };
    }

    // Check for circular dependency
    const wouldCreateCycle = await checkCircularDependency(
      db,
      String(ticketId),
      String(dependsOnTicketId)
    );

    if (wouldCreateCycle) {
      return { error: "Cannot add dependency: this would create a circular dependency" };
    }

    // Check if dependency already exists
    const existingDep = await db
      .selectFrom("ticket_dependencies")
      .selectAll()
      .where("ticket_id", "=", String(ticketId))
      .where("depends_on_ticket_id", "=", String(dependsOnTicketId))
      .executeTakeFirst();

    if (existingDep) {
      return { error: "This dependency already exists" };
    }

    await db
      .insertInto("ticket_dependencies")
      .values({
        ticket_id: String(ticketId),
        depends_on_ticket_id: String(dependsOnTicketId),
      })
      .execute();

    return { success: true };
  }

  if (action === "remove-dependency") {
    const ticketId = formData.get("ticketId");
    const dependsOnTicketId = formData.get("dependsOnTicketId");

    if (!ticketId || !dependsOnTicketId) {
      return { error: "Both ticket IDs are required" };
    }

    await db
      .deleteFrom("ticket_dependencies")
      .where("ticket_id", "=", String(ticketId))
      .where("depends_on_ticket_id", "=", String(dependsOnTicketId))
      .execute();

    return { success: true };
  }

  return { error: "Invalid action" };
}

// Helper function to check for circular dependencies
async function checkCircularDependency(
  db: ReturnType<typeof import("~/lib/db.server").getDb>,
  ticketId: string,
  newDependsOnId: string
): Promise<boolean> {
  // If we're adding ticketId -> newDependsOnId,
  // check if newDependsOnId (directly or transitively) depends on ticketId
  const visited = new Set<string>();
  const queue = [newDependsOnId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === ticketId) {
      return true; // Found a cycle
    }
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // Get all tickets that currentId depends on
    const deps = await db
      .selectFrom("ticket_dependencies")
      .select("depends_on_ticket_id")
      .where("ticket_id", "=", currentId)
      .execute();

    for (const dep of deps) {
      queue.push(dep.depends_on_ticket_id);
    }
  }

  return false;
}

export default function ProjectBoard({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { project, tickets, dependencies, hasApiKey } = loaderData;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Project Header */}
      <div className="border-b bg-background px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Github className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">{project.name}</h1>
            </div>
            <a
              href={`https://github.com/${project.github_repo_full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <WorkflowSetupDialog repoFullName={project.github_repo_full_name} />
            {!hasApiKey && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure API Key
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Warning banner if no API key */}
      {!hasApiKey && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="container mx-auto text-sm text-yellow-800">
            Configure your Anthropic API key in{" "}
            <Link to="/dashboard/settings" className="underline font-medium">
              settings
            </Link>{" "}
            to enable AI ticket implementation.
          </div>
        </div>
      )}

      {/* Error message */}
      {actionData?.error && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2">
          <div className="container mx-auto text-sm text-destructive">
            {actionData.error}
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          tickets={tickets}
          dependencies={dependencies}
          projectId={project.id}
          hasApiKey={hasApiKey}
        />
      </div>
    </div>
  );
}
