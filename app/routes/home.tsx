import { redirect } from "react-router";
import type { Route } from "./+types/home";
import { getUser, getGitHubAuthUrl } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Github, Zap, GitPullRequest, Kanban } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AutoBuild Orchestrator - AI-Powered Development" },
    {
      name: "description",
      content:
        "Manage your GitHub projects with AI. Create tickets, let Claude implement the changes.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (user) {
    return redirect("/dashboard");
  }
  return { githubAuthUrl: getGitHubAuthUrl() };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { githubAuthUrl } = loaderData;

  return (
    <div className="min-h-screen flex flex-col gradient-subtle">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center neon-glow">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-lg">AutoBuild</span>
          </div>
          <Button asChild className="neon-glow">
            <a href={githubAuthUrl}>
              <Github className="w-4 h-4 mr-2" />
              Sign in
            </a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-20 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-8">
            <Zap className="w-4 h-4" />
            <span>AI-Powered Development</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Ship features
            <br />
            <span className="text-primary neon-text">without writing code</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Connect your GitHub repos, create tickets on a Kanban board, and let
            AI implement the changes. AutoBuild turns your ideas into pull
            requests.
          </p>

          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild className="neon-glow text-lg px-8 py-6">
              <a href={githubAuthUrl}>
                <Github className="w-5 h-5 mr-2" />
                Get Started
              </a>
            </Button>
          </div>

          {/* Feature grid */}
          <div className="mt-24 grid md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto">
            <div className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm card-hover">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Github className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">GitHub Integration</h3>
              <p className="text-muted-foreground text-sm">
                Connect your repositories. AutoBuild creates branches, commits
                changes, and opens pull requests automatically.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm card-hover">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Kanban className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Kanban Board</h3>
              <p className="text-muted-foreground text-sm">
                Organize work with a familiar interface. Drag tickets to "In
                Progress" to trigger AI implementation.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm card-hover">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <GitPullRequest className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Auto Pull Requests</h3>
              <p className="text-muted-foreground text-sm">
                Claude reads your codebase, implements changes, and creates a PR
                with a detailed summary of what was done.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-24 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">How it works</h2>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <span className="text-muted-foreground">Create a ticket</span>
              </div>
              <div className="hidden md:block w-12 h-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <span className="text-muted-foreground">Drag to "In Progress"</span>
              </div>
              <div className="hidden md:block w-12 h-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <span className="text-muted-foreground">Review the PR</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Built with React Router, Claude AI, and GitHub
        </div>
      </footer>
    </div>
  );
}
