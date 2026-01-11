import { redirect, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.projects.new";
import { requireUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { getUserRepos, type GitHubRepo } from "~/lib/github.server";
import { exchangeCodeForToken, getGitHubUser } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Github, Lock, Unlock, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "New Project - AutoBuild Orchestrator" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  // For now, we'll need the user to re-authorize with repo scope
  // In a real app, you'd store the access token
  // This is a simplified version - we'll use the OAuth flow to get repo access

  return { user, repos: [] as GitHubRepo[] };
}

export async function action({ request }: Route.ActionArgs) {
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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [search, setSearch] = useState("");
  const [manualRepo, setManualRepo] = useState({
    owner: "",
    name: "",
  });

  // Since we don't have stored access tokens in this MVP,
  // users will need to manually enter their repo info
  // In a full implementation, you'd fetch repos from GitHub

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
        <p className="text-muted-foreground">
          Connect a GitHub repository to start creating AI-powered tickets
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Connect Repository
          </CardTitle>
          <CardDescription>
            Enter your GitHub repository details to create a project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="owner">Repository Owner</Label>
                <Input
                  id="owner"
                  placeholder="e.g., username or organization"
                  value={manualRepo.owner}
                  onChange={(e) =>
                    setManualRepo({ ...manualRepo, owner: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Repository Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., my-project"
                  value={manualRepo.name}
                  onChange={(e) =>
                    setManualRepo({ ...manualRepo, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  name="repoDescription"
                  placeholder="Brief description of the project"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="defaultBranch">Default Branch</Label>
                <Input
                  id="defaultBranch"
                  name="defaultBranch"
                  defaultValue="main"
                  placeholder="main"
                />
              </div>
            </div>

            {/* Hidden fields for form submission */}
            <input
              type="hidden"
              name="repoId"
              value={
                manualRepo.owner && manualRepo.name
                  ? Math.abs(
                      `${manualRepo.owner}/${manualRepo.name}`.split("").reduce(
                        (a, b) => {
                          a = (a << 5) - a + b.charCodeAt(0);
                          return a & a;
                        },
                        0
                      )
                    )
                  : ""
              }
            />
            <input
              type="hidden"
              name="repoFullName"
              value={
                manualRepo.owner && manualRepo.name
                  ? `${manualRepo.owner}/${manualRepo.name}`
                  : ""
              }
            />
            <input
              type="hidden"
              name="repoName"
              value={manualRepo.name || ""}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!manualRepo.owner || !manualRepo.name || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Note:</p>
            <p>
              This MVP version requires you to manually enter repository
              details. In a full implementation, you would be able to browse and
              select from your GitHub repositories directly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
