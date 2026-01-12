import type { Route } from "./+types/api.tickets.$id.start-agent";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { requireUser, getGitHubAccessToken } = await import(
    "~/lib/auth.server"
  );
  const { getDb } = await import("~/lib/db.server");

  const user = await requireUser(request);
  const githubToken = await getGitHubAccessToken(request);

  if (!githubToken) {
    return Response.json(
      { error: "GitHub access token not found. Please re-authenticate." },
      { status: 401 }
    );
  }

  const db = getDb();
  const ticketId = params.id;

  // Get the ticket and project
  const ticket = await db
    .selectFrom("tickets")
    .selectAll()
    .where("id", "=", ticketId!)
    .executeTakeFirst();

  if (!ticket) {
    return Response.json({ error: "Ticket not found" }, { status: 404 });
  }

  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", ticket.project_id)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Check if there's already a ticket in progress
  const inProgressTicket = await db
    .selectFrom("tickets")
    .selectAll()
    .where("project_id", "=", project.id)
    .where("status", "=", "in_progress")
    .where("id", "!=", ticketId!)
    .executeTakeFirst();

  if (inProgressTicket) {
    return Response.json(
      { error: "Another ticket is already in progress" },
      { status: 400 }
    );
  }

  const [owner, repo] = project.github_repo_full_name.split("/");
  const branchName = `autobuild/ticket-${ticket.id.slice(0, 8)}`;

  // Generate a callback secret for this request
  const callbackSecret = crypto.randomUUID();
  const appUrl = process.env.APP_URL || "http://localhost:5173";

  try {
    // Trigger the GitHub Action via repository_dispatch
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "autobuild-ticket",
          client_payload: {
            ticket_id: ticket.id,
            ticket_title: ticket.title,
            ticket_description: ticket.description,
            branch_name: branchName,
            base_branch: project.default_branch,
            callback_url: `${appUrl}/api/agent-callback`,
            callback_secret: callbackSecret,
            prompt: `You are implementing a ticket for a software project.

TICKET TITLE: ${ticket.title}

TICKET DESCRIPTION:
${ticket.description}

INSTRUCTIONS:
1. First, explore the codebase to understand its structure
2. Understand the existing patterns, coding style, and architecture
3. Implement the requested changes
4. Make sure your changes are complete and working
5. Write clean, well-documented code that matches the existing style
6. Don't leave TODO comments - implement everything fully
7. Make minimal, focused changes - don't refactor unrelated code`,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub dispatch failed:", errorText);

      // Check if it's a 404 - workflow might not be installed
      if (response.status === 404) {
        return Response.json(
          {
            error:
              "GitHub Action workflow not found. Please install the AutoBuild workflow in your repository.",
            setup_required: true,
          },
          { status: 400 }
        );
      }

      return Response.json(
        { error: `Failed to trigger GitHub Action: ${response.status}` },
        { status: 500 }
      );
    }

    // Update ticket status to in_progress
    await db
      .updateTable("tickets")
      .set({
        status: "in_progress",
        branch_name: branchName,
      })
      .where("id", "=", ticketId!)
      .execute();

    // Store the callback secret for verification (in a real app, you'd store this securely)
    // For now, we'll trust the ticket_id match

    // Create an agent execution record
    await db
      .insertInto("agent_executions")
      .values({
        ticket_id: ticket.id,
        status: "running",
        logs: JSON.stringify([
          {
            type: "message",
            timestamp: new Date().toISOString(),
            data: "GitHub Action triggered successfully",
          },
        ]),
      })
      .execute();

    return Response.json({
      success: true,
      message: "Agent started via GitHub Actions",
      branch_name: branchName,
    });
  } catch (error) {
    console.error("Error triggering GitHub Action:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to trigger agent",
      },
      { status: 500 }
    );
  }
}
