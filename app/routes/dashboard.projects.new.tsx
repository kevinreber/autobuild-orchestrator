import { redirect, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.projects.new";
import type { GitHubRepo } from "~/lib/github.server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Github, Lock, Unlock, ArrowLeft, Loader2, Search } from "lucide-react";
import { Link } from "react-router";
import { useState, useMemo } from "react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "New Project - AutoBuild Orchestrator" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireUser, getGitHubAccessToken } = await import("~/lib/auth.server");
  const { getUserRepos } = await import("~/lib/github.server");

  const user = await requireUser(request);
  const accessToken = await getGitHubAccessToken(request);

  let repos: GitHubRepo[] = [];
  let error: string | null = null;

  if (accessToken) {
    try {
      repos = await getUserRepos(accessToken);
    } catch (e) {
      console.error("Failed to fetch repos:", e);
      error = "Failed to fetch repositories. Please try logging out and back in.";
    }
  } else {
    error = "GitHub access token not found. Please log out and log back in to grant repository access.";
  }

  return { user, repos, error };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireUser } = await import("~/lib/auth.server");
  const { getDb } = await import("~/lib/db.server");

  const user = await requireUser(request);
  const formData = await request.formData();

  const repoId = formData.get("repoId");
  const repoFullName = formData.get("repoFullName");
  const repoName = formData.get("repoName");
  const repoDescription = formData.get("repoDescription");
  const defaultBranch = formData.get("defaultBranch");

  if (!repoId || !repoFullName || !repoName) {
    return { error: "Missing required fields" };
  }

  const db = getDb();

  // Check if project already exists
  const existing = await db
    .selectFrom("projects")
    .selectAll()
    .where("user_id", "=", user.id)
    .where("github_repo_id", "=", Number(repoId))
    .executeTakeFirst();

  if (existing) {
    return redirect(`/dashboard/projects/${existing.id}`);
  }

  // Create new project
  const project = await db
    .insertInto("projects")
    .values({
      user_id: user.id,
      github_repo_id: Number(repoId),
      github_repo_full_name: String(repoFullName),
      name: String(repoName),
      description: repoDescription ? String(repoDescription) : null,
      default_branch: String(defaultBranch) || "main",
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return redirect(`/dashboard/projects/${project.id}`);
}

export default function NewProject({ loaderData }: Route.ComponentProps) {
  const { repos, error } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  const filteredRepos = useMemo(() => {
    if (!search.trim()) return repos;
    const searchLower = search.toLowerCase();
    return repos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchLower) ||
        repo.full_name.toLowerCase().includes(searchLower) ||
        (repo.description && repo.description.toLowerCase().includes(searchLower))
    );
  }, [repos, search]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
        <p className="text-muted-foreground">
          Select a GitHub repository to start creating AI-powered tickets
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link to="/auth/logout">Log out and re-authenticate</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && repos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="w-5 h-5" />
              Select Repository
            </CardTitle>
            <CardDescription>
              Choose a repository from your GitHub account ({repos.length} repositories found)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
              {filteredRepos.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No repositories found matching "{search}"
                </div>
              ) : (
                filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => setSelectedRepo(repo)}
                    className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                      selectedRepo?.id === repo.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{repo.full_name}</span>
                      {repo.private ? (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {repo.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Default branch: {repo.default_branch}
                    </p>
                  </button>
                ))
              )}
            </div>

            {selectedRepo && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Selected: {selectedRepo.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedRepo.description || "No description"}
                      </p>
                    </div>
                    <Form method="post">
                      <input type="hidden" name="repoId" value={selectedRepo.id} />
                      <input type="hidden" name="repoFullName" value={selectedRepo.full_name} />
                      <input type="hidden" name="repoName" value={selectedRepo.name} />
                      <input type="hidden" name="repoDescription" value={selectedRepo.description || ""} />
                      <input type="hidden" name="defaultBranch" value={selectedRepo.default_branch} />
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Project"
                        )}
                      </Button>
                    </Form>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {!error && repos.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Github className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No repositories found. Make sure you have repositories in your GitHub account.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <a href="https://github.com/new" target="_blank" rel="noopener noreferrer">
                Create a repository on GitHub
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
