import { Link, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard._index";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Plus, Github, ExternalLink, Trash2, RotateCcw, Loader2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard - AutoBuild Orchestrator" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireUser } = await import("~/lib/auth.server");
  const { getDb } = await import("~/lib/db.server");

  const user = await requireUser(request);
  const db = getDb();

  // Fetch active projects (not deleted)
  const activeProjects = await db
    .selectFrom("projects")
    .selectAll()
    .where("user_id", "=", user.id)
    .where("deleted_at", "is", null)
    .orderBy("created_at", "desc")
    .execute();

  // Fetch deleted projects
  const deletedProjects = await db
    .selectFrom("projects")
    .selectAll()
    .where("user_id", "=", user.id)
    .where("deleted_at", "is not", null)
    .orderBy("deleted_at", "desc")
    .execute();

  // Get ticket counts for active projects
  const projectsWithCounts = await Promise.all(
    activeProjects.map(async (project) => {
      const counts = await db
        .selectFrom("tickets")
        .select(({ fn }) => [fn.countAll().as("total")])
        .where("project_id", "=", project.id)
        .executeTakeFirst();

      const inProgress = await db
        .selectFrom("tickets")
        .select(({ fn }) => [fn.countAll().as("count")])
        .where("project_id", "=", project.id)
        .where("status", "=", "in_progress")
        .executeTakeFirst();

      return {
        ...project,
        ticketCount: Number(counts?.total || 0),
        inProgressCount: Number(inProgress?.count || 0),
      };
    })
  );

  return { projects: projectsWithCounts, deletedProjects };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireUser } = await import("~/lib/auth.server");
  const { getDb } = await import("~/lib/db.server");

  const user = await requireUser(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const projectId = formData.get("projectId");

  if (!projectId) {
    return { error: "Project ID is required" };
  }

  const db = getDb();

  // Verify project ownership
  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", String(projectId))
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (!project) {
    return { error: "Project not found" };
  }

  if (actionType === "delete") {
    const now = new Date();
    const scheduledDeletion = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await db
      .updateTable("projects")
      .set({
        deleted_at: now,
        scheduled_deletion_at: scheduledDeletion,
      })
      .where("id", "=", String(projectId))
      .execute();

    return { success: true, action: "deleted" };
  }

  if (actionType === "restore") {
    await db
      .updateTable("projects")
      .set({
        deleted_at: null,
        scheduled_deletion_at: null,
      })
      .where("id", "=", String(projectId))
      .execute();

    return { success: true, action: "restored" };
  }

  if (actionType === "permanent-delete") {
    // Only allow permanent delete for already soft-deleted projects
    if (!project.deleted_at) {
      return { error: "Project must be deleted first before permanent deletion" };
    }

    // Permanently delete the project (cascades to tickets and agent_executions)
    await db
      .deleteFrom("projects")
      .where("id", "=", String(projectId))
      .execute();

    return { success: true, action: "permanently-deleted" };
  }

  return { error: "Invalid action" };
}

function formatDaysRemaining(scheduledDeletionAt: Date | null): string {
  if (!scheduledDeletionAt) return "";
  const now = new Date();
  const diff = new Date(scheduledDeletionAt).getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Scheduled for deletion";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}

export default function DashboardIndex({ loaderData }: Route.ComponentProps) {
  const { projects, deletedProjects } = loaderData;
  const navigation = useNavigation();
  const [showDeleted, setShowDeleted] = useState(false);
  const [softDeleteConfirmId, setSoftDeleteConfirmId] = useState<string | null>(null);
  const [permanentDeleteConfirmId, setPermanentDeleteConfirmId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const isDeleting = navigation.state === "submitting" && navigation.formData?.get("_action") === "delete";
  const isRestoring = navigation.state === "submitting" && navigation.formData?.get("_action") === "restore";
  const isPermanentDeleting = navigation.state === "submitting" && navigation.formData?.get("_action") === "permanent-delete";
  const deletingProjectId = isDeleting ? navigation.formData?.get("projectId") : null;
  const restoringProjectId = isRestoring ? navigation.formData?.get("projectId") : null;
  const permanentDeletingProjectId = isPermanentDeleting ? navigation.formData?.get("projectId") : null;

  // Get project name for permanent delete confirmation
  const projectToDelete = deletedProjects.find(p => p.id === permanentDeleteConfirmId);
  const canPermanentDelete = projectToDelete && confirmName === projectToDelete.name;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your GitHub repositories and create AI-powered tickets
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/projects/new">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Github className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by connecting a GitHub repository
            </p>
            <Button asChild>
              <Link to="/dashboard/projects/new">
                <Plus className="w-4 h-4 mr-2" />
                Create your first project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Github className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`https://github.com/${project.github_repo_full_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => setSoftDeleteConfirmId(project.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {project.description || project.github_repo_full_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{project.ticketCount} tickets</span>
                    {project.inProgressCount > 0 && (
                      <span className="text-yellow-600">
                        {project.inProgressCount} in progress
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/dashboard/projects/${project.id}`}>
                      Open Board
                    </Link>
                  </Button>
                </div>

                {/* Soft delete confirmation */}
                {softDeleteConfirmId === project.id && (
                  <div className="border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-destructive">Delete this project?</p>
                        <p className="text-muted-foreground mt-1">
                          The project will be moved to trash and permanently deleted after 30 days.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSoftDeleteConfirmId(null)}
                      >
                        Cancel
                      </Button>
                      <Form method="post" onSubmit={() => setSoftDeleteConfirmId(null)}>
                        <input type="hidden" name="_action" value="delete" />
                        <input type="hidden" name="projectId" value={project.id} />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="sm"
                          disabled={deletingProjectId === project.id}
                        >
                          {deletingProjectId === project.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Delete
                        </Button>
                      </Form>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Deleted Projects Section */}
      {deletedProjects.length > 0 && (
        <div className="mt-12">
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            {showDeleted ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span className="font-medium">
              Deleted Projects ({deletedProjects.length})
            </span>
          </button>

          {showDeleted && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deletedProjects.map((project) => (
                <Card key={project.id} className="opacity-60 hover:opacity-100 transition-opacity">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Github className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                      </div>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {project.description || project.github_repo_full_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {formatDaysRemaining(project.scheduled_deletion_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Form method="post">
                          <input type="hidden" name="_action" value="restore" />
                          <input type="hidden" name="projectId" value={project.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={restoringProjectId === project.id}
                          >
                            {restoringProjectId === project.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4 mr-2" />
                            )}
                            Restore
                          </Button>
                        </Form>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setPermanentDeleteConfirmId(project.id);
                            setConfirmName("");
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Confirmation dialog for permanent delete */}
                    {permanentDeleteConfirmId === project.id && (
                      <div className="border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                        <div className="flex items-start gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium text-destructive">Permanently delete this project?</p>
                            <p className="text-muted-foreground mt-1">
                              This will delete all tickets and data. This action cannot be undone.
                            </p>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="text-sm text-muted-foreground block mb-1.5">
                            Type <span className="font-mono font-medium text-foreground">{project.name}</span> to confirm:
                          </label>
                          <Input
                            type="text"
                            value={confirmName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmName(e.target.value)}
                            placeholder="Enter project name"
                            className="text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPermanentDeleteConfirmId(null);
                              setConfirmName("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Form method="post" onSubmit={() => {
                            setPermanentDeleteConfirmId(null);
                            setConfirmName("");
                          }}>
                            <input type="hidden" name="_action" value="permanent-delete" />
                            <input type="hidden" name="projectId" value={project.id} />
                            <Button
                              type="submit"
                              variant="destructive"
                              size="sm"
                              disabled={!canPermanentDelete || permanentDeletingProjectId === project.id}
                            >
                              {permanentDeletingProjectId === project.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                              )}
                              Delete Forever
                            </Button>
                          </Form>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
