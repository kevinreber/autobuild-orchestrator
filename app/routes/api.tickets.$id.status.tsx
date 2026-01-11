import { data } from "react-router";
import type { Route } from "./+types/api.tickets.$id.status";
import { requireUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { runAgent } from "~/lib/agent.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireUser(request);
  const db = getDb();
  const ticketId = params.id;

  if (!ticketId) {
    return data({ error: "Ticket ID is required" }, { status: 400 });
  }

  // Get the ticket and verify ownership through project
  const ticket = await db
    .selectFrom("tickets")
    .innerJoin("projects", "projects.id", "tickets.project_id")
    .selectAll("tickets")
    .select(["projects.user_id", "projects.github_repo_full_name"])
    .where("tickets.id", "=", ticketId)
    .executeTakeFirst();

  if (!ticket) {
    return data({ error: "Ticket not found" }, { status: 404 });
  }

  if (ticket.user_id !== user.id) {
    return data({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if ticket is in_progress
  if (ticket.status !== "in_progress") {
    return data(
      { error: "Ticket must be in progress to trigger agent" },
      { status: 400 }
    );
  }

  // Check if user has API key
  if (!user.anthropic_api_key) {
    await db
      .updateTable("tickets")
      .set({
        status: "ready",
        error_message: "Please configure your Anthropic API key in settings",
      })
      .where("id", "=", ticketId)
      .execute();

    return data({ error: "API key not configured" }, { status: 400 });
  }

  // Get the project
  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", ticket.project_id)
    .executeTakeFirstOrThrow();

  // For MVP, we'll need GitHub access token
  // In a full implementation, you'd use GitHub App installation tokens
  // For now, we'll use a placeholder - in reality you'd need to implement
  // proper GitHub App authentication or store OAuth tokens

  // NOTE: This is a simplified version. In production, you'd need to:
  // 1. Use GitHub App installation tokens, or
  // 2. Store and use user's GitHub OAuth token with repo scope

  const githubAccessToken = process.env.GITHUB_ACCESS_TOKEN;

  if (!githubAccessToken) {
    await db
      .updateTable("tickets")
      .set({
        status: "failed",
        error_message:
          "GitHub access token not configured. Please set GITHUB_ACCESS_TOKEN environment variable.",
      })
      .where("id", "=", ticketId)
      .execute();

    return data(
      { error: "GitHub access token not configured" },
      { status: 500 }
    );
  }

  // Run the agent (this could take a while)
  // In production, you'd want to run this in a background job
  try {
    const result = await runAgent(ticket, project, user, githubAccessToken);

    if (result.success) {
      return data({ success: true, prUrl: result.prUrl });
    } else {
      return data({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await db
      .updateTable("tickets")
      .set({
        status: "failed",
        error_message: errorMessage,
      })
      .where("id", "=", ticketId)
      .execute();

    return data({ error: errorMessage }, { status: 500 });
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  return data({ error: "Method not allowed" }, { status: 405 });
}
