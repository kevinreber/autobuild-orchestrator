import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.settings";
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
import { Key, Loader2, Check, AlertCircle } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Settings - AutoBuild Orchestrator" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireUser } = await import("~/lib/auth.server");
  const user = await requireUser(request);

  return {
    hasApiKey: !!user.anthropic_api_key,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireUser } = await import("~/lib/auth.server");
  const { getDb } = await import("~/lib/db.server");
  const { encrypt } = await import("~/lib/encryption.server");

  const user = await requireUser(request);
  const formData = await request.formData();
  const action = formData.get("_action");

  const db = getDb();

  if (action === "save-api-key") {
    const apiKey = formData.get("apiKey");

    if (!apiKey || typeof apiKey !== "string") {
      return { error: "API key is required" };
    }

    // Validate the API key format
    if (!apiKey.startsWith("sk-ant-")) {
      return { error: "Invalid API key format. It should start with 'sk-ant-'" };
    }

    // Encrypt and save
    const encryptedKey = encrypt(apiKey);

    await db
      .updateTable("users")
      .set({ anthropic_api_key: encryptedKey })
      .where("id", "=", user.id)
      .execute();

    return { success: true, message: "API key saved successfully" };
  }

  if (action === "remove-api-key") {
    await db
      .updateTable("users")
      .set({ anthropic_api_key: null })
      .where("id", "=", user.id)
      .execute();

    return { success: true, message: "API key removed" };
  }

  return { error: "Invalid action" };
}

export default function Settings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { hasApiKey } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and API settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Anthropic API Key
          </CardTitle>
          <CardDescription>
            Your API key is used to run Claude for implementing ticket changes.
            Get your key from{" "}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              console.anthropic.com
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actionData?.error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {actionData.error}
            </div>
          )}

          {actionData?.success && (
            <div className="mb-4 p-3 rounded-md bg-green-500/10 text-green-600 flex items-center gap-2">
              <Check className="w-4 h-4" />
              {actionData.message}
            </div>
          )}

          {hasApiKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-600">
                <Check className="w-4 h-4" />
                <span>API key is configured</span>
              </div>
              <div className="flex gap-2">
                <Form method="post" className="flex-1">
                  <input type="hidden" name="_action" value="remove-api-key" />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    Remove API Key
                  </Button>
                </Form>
              </div>
            </div>
          ) : (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="_action" value="save-api-key" />
              <div className="grid gap-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  name="apiKey"
                  type="password"
                  placeholder="sk-ant-..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Your API key is encrypted before being stored
                </p>
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save API Key"
                )}
              </Button>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Usage & Billing</CardTitle>
          <CardDescription>
            API usage is billed directly to your Anthropic account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AutoBuild Orchestrator uses your own Anthropic API key. All API usage and
            associated costs are charged to your Anthropic account. Monitor your
            usage at{" "}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              console.anthropic.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
