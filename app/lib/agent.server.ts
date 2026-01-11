import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./db.server";
import { decrypt } from "./encryption.server";
import {
  getFileContent,
  getRepoContents,
  createBranch,
  createOrUpdateFile,
  createPullRequest,
} from "./github.server";
import type { Ticket, Project, User } from "~/types/database";

const MAX_ITERATIONS = 50;

interface AgentLog {
  type: "tool_call" | "tool_result" | "message";
  timestamp: string;
  data: unknown;
}

interface ToolInput {
  path?: string;
  content?: string;
  command?: string;
  summary?: string;
}

// Define the tools for the agent
const tools: Anthropic.Tool[] = [
  {
    name: "list_directory",
    description:
      "List files and folders in a directory. Use this to explore the codebase structure.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            'Directory path relative to repo root. Use "" or "." for root directory.',
        },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file to understand existing code.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to repo root.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write content to a file. This creates a new file or overwrites an existing one.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to repo root.",
        },
        content: {
          type: "string",
          description: "The complete content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "task_complete",
    description:
      "Call this when you have finished implementing all the requested changes. Provide a summary of what was done.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description:
            "A summary of all changes made, suitable for a PR description.",
        },
      },
      required: ["summary"],
    },
  },
];

export async function runAgent(
  ticket: Ticket,
  project: Project,
  user: User,
  githubAccessToken: string
): Promise<{ success: boolean; error?: string; prUrl?: string }> {
  const db = getDb();

  // Get user's API key
  if (!user.anthropic_api_key) {
    return { success: false, error: "No Anthropic API key configured" };
  }

  const apiKey = decrypt(user.anthropic_api_key);

  // Create agent execution record
  const execution = await db
    .insertInto("agent_executions")
    .values({
      ticket_id: ticket.id,
      status: "running",
      logs: [],
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const logs: AgentLog[] = [];
  const [owner, repo] = project.github_repo_full_name.split("/");
  const branchName = `autobuild/ticket-${ticket.id.slice(0, 8)}`;
  const filesModified: Map<string, string> = new Map();

  try {
    // Create a new branch for the changes
    await createBranch(
      githubAccessToken,
      owner,
      repo,
      branchName,
      project.default_branch
    );

    // Update ticket with branch name
    await db
      .updateTable("tickets")
      .set({ branch_name: branchName })
      .where("id", "=", ticket.id)
      .execute();

    // Initialize Anthropic client
    const client = new Anthropic({ apiKey });

    // System prompt
    const systemPrompt = `You are an expert software developer implementing changes to a GitHub repository.

Repository: ${project.github_repo_full_name}
Branch: ${branchName} (created from ${project.default_branch})

Your task is to implement the following ticket:

TITLE: ${ticket.title}

DESCRIPTION:
${ticket.description}

INSTRUCTIONS:
1. First, explore the codebase to understand its structure using list_directory and read_file
2. Understand the existing patterns, coding style, and architecture
3. Implement the requested changes using write_file
4. Make sure your changes are complete and working
5. When done, call task_complete with a summary of your changes

IMPORTANT:
- Write clean, well-documented code that matches the existing style
- Don't leave TODO comments - implement everything fully
- Test your logic mentally before writing
- Make minimal, focused changes - don't refactor unrelated code
- If you're unsure about something, make a reasonable decision and note it in the summary`;

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: "Please implement the ticket described above. Start by exploring the repository structure.",
      },
    ];

    let iterations = 0;
    let isComplete = false;
    let completionSummary = "";

    while (!isComplete && iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8096,
        system: systemPrompt,
        tools,
        messages,
      });

      // Log the response
      logs.push({
        type: "message",
        timestamp: new Date().toISOString(),
        data: { role: "assistant", content: response.content },
      });

      // Check if we need to handle tool calls
      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            const toolInput = block.input as ToolInput;

            logs.push({
              type: "tool_call",
              timestamp: new Date().toISOString(),
              data: { name: block.name, input: block.input },
            });

            let result: string;

            try {
              switch (block.name) {
                case "list_directory": {
                  const contents = await getRepoContents(
                    githubAccessToken,
                    owner,
                    repo,
                    toolInput.path || ""
                  );
                  result = contents
                    .map((item) => `${item.type === "dir" ? "[DIR]" : "[FILE]"} ${item.path}`)
                    .join("\n");
                  if (!result) result = "Directory is empty";
                  break;
                }

                case "read_file": {
                  const content = await getFileContent(
                    githubAccessToken,
                    owner,
                    repo,
                    toolInput.path!
                  );
                  result = content || "File not found or empty";
                  break;
                }

                case "write_file": {
                  // Store the file content - we'll commit all at once at the end
                  filesModified.set(toolInput.path!, toolInput.content!);
                  result = `File ${toolInput.path} staged for commit`;
                  break;
                }

                case "task_complete": {
                  isComplete = true;
                  completionSummary = toolInput.summary!;
                  result = "Task marked as complete. Creating pull request...";
                  break;
                }

                default:
                  result = `Unknown tool: ${block.name}`;
              }
            } catch (error) {
              result = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
            }

            logs.push({
              type: "tool_result",
              timestamp: new Date().toISOString(),
              data: { tool_use_id: block.id, result },
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        // Add assistant message and tool results to messages
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });
      } else {
        // No more tool calls, add the response and break
        messages.push({ role: "assistant", content: response.content });

        // Check if the response contains task_complete indication
        const textContent = response.content.find((b) => b.type === "text");
        if (textContent && textContent.type === "text") {
          if (
            textContent.text.toLowerCase().includes("complete") ||
            textContent.text.toLowerCase().includes("finished")
          ) {
            isComplete = true;
            completionSummary =
              textContent.text.slice(0, 500) + (textContent.text.length > 500 ? "..." : "");
          }
        }
        break;
      }

      // Update logs in database periodically
      if (iterations % 5 === 0) {
        await db
          .updateTable("agent_executions")
          .set({ logs: JSON.stringify(logs) })
          .where("id", "=", execution.id)
          .execute();
      }
    }

    // Commit all modified files
    if (filesModified.size > 0) {
      for (const [filePath, content] of filesModified) {
        await createOrUpdateFile(
          githubAccessToken,
          owner,
          repo,
          filePath,
          content,
          `AutoBuild: Update ${filePath}`,
          branchName
        );
      }

      // Create pull request
      const prBody = `## AutoBuild Orchestrator Implementation

### Ticket
**${ticket.title}**

${ticket.description}

### Summary of Changes
${completionSummary || "Changes implemented as requested."}

### Files Modified
${Array.from(filesModified.keys())
  .map((f) => `- \`${f}\``)
  .join("\n")}

---
*This PR was automatically generated by AutoBuild Orchestrator*`;

      const pr = await createPullRequest(
        githubAccessToken,
        owner,
        repo,
        `[AutoBuild] ${ticket.title}`,
        prBody,
        branchName,
        project.default_branch
      );

      // Update ticket with PR info
      await db
        .updateTable("tickets")
        .set({
          status: "in_review",
          pr_number: pr.number,
          pr_url: pr.html_url,
        })
        .where("id", "=", ticket.id)
        .execute();

      // Update execution
      await db
        .updateTable("agent_executions")
        .set({
          status: "completed",
          completed_at: new Date(),
          logs: JSON.stringify(logs),
        })
        .where("id", "=", execution.id)
        .execute();

      return { success: true, prUrl: pr.html_url };
    } else {
      // No files were modified
      const errorMessage = "Agent completed but no files were modified";

      await db
        .updateTable("tickets")
        .set({
          status: "failed",
          error_message: errorMessage,
        })
        .where("id", "=", ticket.id)
        .execute();

      await db
        .updateTable("agent_executions")
        .set({
          status: "failed",
          completed_at: new Date(),
          logs: JSON.stringify(logs),
          error: errorMessage,
        })
        .where("id", "=", execution.id)
        .execute();

      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Update ticket status
    await db
      .updateTable("tickets")
      .set({
        status: "failed",
        error_message: errorMessage,
      })
      .where("id", "=", ticket.id)
      .execute();

    // Update execution
    await db
      .updateTable("agent_executions")
      .set({
        status: "failed",
        completed_at: new Date(),
        logs: JSON.stringify(logs),
        error: errorMessage,
      })
      .where("id", "=", execution.id)
      .execute();

    return { success: false, error: errorMessage };
  }
}
