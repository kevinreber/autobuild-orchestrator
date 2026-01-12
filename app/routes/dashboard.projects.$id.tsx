import { redirect, Link } from "react-router";
import type { Route } from "./+types/dashboard.projects.$id";
import { KanbanBoard } from "~/components/kanban-board";
import { WorkflowSetupDialog } from "~/components/workflow-setup-dialog";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Github, ExternalLink, Settings } from "lucide-react";
import type { TicketStatus } from "~/types/database";

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

  // Check if user has API key configured
  const hasApiKey = !!user.anthropic_api_key;

  return { project, tickets, hasApiKey };
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

  return { error: "Invalid action" };
}

export default function ProjectBoard({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { project, tickets, hasApiKey } = loaderData;

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
          projectId={project.id}
          hasApiKey={hasApiKey}
        />
      </div>
    </div>
  );
}
