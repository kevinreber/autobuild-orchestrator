import type { Route } from "./+types/api.agent-callback";

interface CallbackPayload {
  ticket_id: string;
  status: "success" | "no_changes" | "error";
  pr_url?: string;
  pr_number?: string;
  run_id?: string;
  error?: string;
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // In production, you'd verify the callback_secret from the Authorization header
  // const authHeader = request.headers.get("Authorization");
  // const secret = authHeader?.replace("Bearer ", "");

  let payload: CallbackPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { ticket_id, status, pr_url, pr_number, error } = payload;

  if (!ticket_id) {
    return Response.json({ error: "Missing ticket_id" }, { status: 400 });
  }

  const { getDb } = await import("~/lib/db.server");
  const db = getDb();

  // Find the ticket
  const ticket = await db
    .selectFrom("tickets")
    .selectAll()
    .where("id", "=", ticket_id)
    .executeTakeFirst();

  if (!ticket) {
    return Response.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Update ticket based on status
  if (status === "success" && pr_url) {
    await db
      .updateTable("tickets")
      .set({
        status: "in_review",
        pr_url: pr_url,
        pr_number: pr_number ? parseInt(pr_number) : null,
      })
      .where("id", "=", ticket_id)
      .execute();

    // Update agent execution
    await db
      .updateTable("agent_executions")
      .set({
        status: "completed",
        completed_at: new Date(),
        logs: JSON.stringify([
          {
            type: "message",
            timestamp: new Date().toISOString(),
            data: `PR created: ${pr_url}`,
          },
        ]),
      })
      .where("ticket_id", "=", ticket_id)
      .where("status", "=", "running")
      .execute();
  } else if (status === "no_changes") {
    await db
      .updateTable("tickets")
      .set({
        status: "failed",
        error_message: "Agent completed but no changes were made",
      })
      .where("id", "=", ticket_id)
      .execute();

    await db
      .updateTable("agent_executions")
      .set({
        status: "failed",
        completed_at: new Date(),
        error: "No changes were made",
      })
      .where("ticket_id", "=", ticket_id)
      .where("status", "=", "running")
      .execute();
  } else if (status === "error") {
    await db
      .updateTable("tickets")
      .set({
        status: "failed",
        error_message: error || "Agent execution failed",
      })
      .where("id", "=", ticket_id)
      .execute();

    await db
      .updateTable("agent_executions")
      .set({
        status: "failed",
        completed_at: new Date(),
        error: error || "Unknown error",
      })
      .where("ticket_id", "=", ticket_id)
      .where("status", "=", "running")
      .execute();
  }

  return Response.json({ success: true });
}
