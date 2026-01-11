import { Link } from "react-router";
import type { Route } from "./+types/dashboard._index";
import { requireUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Plus, Github, ExternalLink } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard - AutoBuild Orchestrator" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const db = getDb();

  const projects = await db
    .selectFrom("projects")
    .selectAll()
    .where("user_id", "=", user.id)
    .orderBy("created_at", "desc")
    .execute();

  // Get ticket counts for each project
  const projectsWithCounts = await Promise.all(
    projects.map(async (project) => {
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

  return { projects: projectsWithCounts };
}

export default function DashboardIndex({ loaderData }: Route.ComponentProps) {
  const { projects } = loaderData;

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
                  <a
                    href={`https://github.com/${project.github_repo_full_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <CardDescription className="line-clamp-2">
                  {project.description || project.github_repo_full_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
