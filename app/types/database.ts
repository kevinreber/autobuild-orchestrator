import type { Generated, ColumnType } from "kysely";

export type TicketStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "in_review"
  | "completed"
  | "failed";

export type AgentExecutionStatus = "running" | "completed" | "failed";

export interface UserTable {
  id: Generated<string>;
  github_id: number;
  github_username: string;
  github_avatar_url: string | null;
  github_access_token: string | null;
  anthropic_api_key: string | null;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, Date>;
}

export interface ProjectTable {
  id: Generated<string>;
  user_id: string;
  github_repo_id: number;
  github_repo_full_name: string;
  github_installation_id: number | null;
  name: string;
  description: string | null;
  default_branch: string;
  deleted_at: ColumnType<Date | null, Date | null, Date | null>;
  scheduled_deletion_at: ColumnType<Date | null, Date | null, Date | null>;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, Date>;
}

export interface TicketTable {
  id: Generated<string>;
  project_id: string;
  title: string;
  description: string;
  status: ColumnType<TicketStatus, TicketStatus | undefined, TicketStatus>;
  priority: Generated<number>;
  branch_name: string | null;
  pr_number: number | null;
  pr_url: string | null;
  error_message: string | null;
  position: number;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, Date>;
}

export interface AgentExecutionTable {
  id: Generated<string>;
  ticket_id: string;
  status: AgentExecutionStatus;
  started_at: ColumnType<Date, never, never>;
  completed_at: Date | null;
  token_usage: number | null;
  logs: unknown | null;
  error: string | null;
}

export interface TicketDependencyTable {
  id: Generated<string>;
  ticket_id: string;
  depends_on_ticket_id: string;
  created_at: ColumnType<Date, never, never>;
}

export interface Database {
  users: UserTable;
  projects: ProjectTable;
  tickets: TicketTable;
  agent_executions: AgentExecutionTable;
  ticket_dependencies: TicketDependencyTable;
}

// Helper types for selecting/inserting
export type User = {
  id: string;
  github_id: number;
  github_username: string;
  github_avatar_url: string | null;
  github_access_token: string | null;
  anthropic_api_key: string | null;
  created_at: Date;
  updated_at: Date;
};

export type Project = {
  id: string;
  user_id: string;
  github_repo_id: number;
  github_repo_full_name: string;
  github_installation_id: number | null;
  name: string;
  description: string | null;
  default_branch: string;
  deleted_at: Date | null;
  scheduled_deletion_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type Ticket = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: number;
  branch_name: string | null;
  pr_number: number | null;
  pr_url: string | null;
  error_message: string | null;
  position: number;
  created_at: Date;
  updated_at: Date;
};

export type AgentExecution = {
  id: string;
  ticket_id: string;
  status: AgentExecutionStatus;
  started_at: Date;
  completed_at: Date | null;
  token_usage: number | null;
  logs: unknown | null;
  error: string | null;
};

export type TicketDependency = {
  id: string;
  ticket_id: string;
  depends_on_ticket_id: string;
  created_at: Date;
};

// Extended ticket type with dependency information
export type TicketWithDependencies = Ticket & {
  dependencies: string[]; // IDs of tickets this ticket depends on
  dependents: string[]; // IDs of tickets that depend on this ticket
  blockedBy: Ticket[]; // Tickets that are blocking this ticket (not completed)
};
