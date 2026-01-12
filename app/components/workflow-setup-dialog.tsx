import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Wrench, ExternalLink, FileCode, Key, Play } from "lucide-react";

interface WorkflowSetupDialogProps {
  repoFullName: string;
}

export function WorkflowSetupDialog({ repoFullName }: WorkflowSetupDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Wrench className="w-4 h-4 mr-2" />
        Setup Agent
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Setup AutoBuild Agent
          </CardTitle>
          <CardDescription>
            Follow these steps to enable AI-powered ticket implementation for{" "}
            <span className="font-mono">{repoFullName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                1
              </span>
              Add the workflow file
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              Copy the workflow file to your repository at{" "}
              <code className="bg-muted px-1 rounded text-xs">
                .github/workflows/autobuild.yml
              </code>
            </p>
            <div className="ml-8">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/kevinreber/autobuild-orchestrator/blob/main/.github/workflows/autobuild-agent.yml"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileCode className="w-4 h-4 mr-2" />
                  View Workflow File
                </a>
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                2
              </span>
              Add your Anthropic API key
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              Go to your repository settings and add a secret named{" "}
              <code className="bg-muted px-1 rounded text-xs">ANTHROPIC_API_KEY</code>
            </p>
            <div className="ml-8">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://github.com/${repoFullName}/settings/secrets/actions/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Add Secret on GitHub
                </a>
              </Button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                3
              </span>
              Start using AutoBuild
            </h3>
            <p className="text-sm text-muted-foreground ml-8">
              Drag any ticket to "In Progress" to trigger the AI agent. It will
              analyze your codebase, implement changes, and create a pull request.
            </p>
            <div className="ml-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Play className="w-4 h-4" />
              <span>Monitor progress in your repo's Actions tab</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Close
            </Button>
            <Button asChild>
              <a
                href={`https://github.com/${repoFullName}/actions`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Actions
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
