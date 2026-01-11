import { Link } from "react-router";
import type { Route } from "./+types/auth.github.not-configured";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { AlertCircle, ExternalLink, ArrowLeft } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Setup Required - AutoBuild Orchestrator" }];
}

export default function GitHubNotConfigured() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-yellow-600 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Setup Required</span>
          </div>
          <CardTitle>GitHub OAuth Not Configured</CardTitle>
          <CardDescription>
            To enable GitHub login, you need to configure OAuth credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <p className="font-medium">Follow these steps:</p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Go to{" "}
                <a
                  href="https://github.com/settings/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 inline-flex items-center gap-1"
                >
                  GitHub Developer Settings
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Click "New OAuth App"</li>
              <li>
                Set Homepage URL to:{" "}
                <code className="bg-muted px-1 rounded">http://localhost:5173</code>
              </li>
              <li>
                Set Callback URL to:{" "}
                <code className="bg-muted px-1 rounded">
                  http://localhost:5173/auth/github/callback
                </code>
              </li>
              <li>Copy the Client ID and Client Secret</li>
              <li>
                Add them to your <code className="bg-muted px-1 rounded">.env</code> file:
                <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
{`GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret`}
                </pre>
              </li>
              <li>Restart the dev server</li>
            </ol>
          </div>

          <div className="pt-4">
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
