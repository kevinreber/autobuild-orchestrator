import { redirect } from "react-router";
import type { Route } from "./+types/auth.github.callback";
import {
  exchangeCodeForToken,
  getGitHubUser,
  findOrCreateUser,
  createUserSession,
} from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("GitHub OAuth error:", error);
    return redirect("/?error=github_auth_failed");
  }

  if (!code) {
    return redirect("/?error=no_code");
  }

  try {
    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(code);

    // Get GitHub user info
    const githubUser = await getGitHubUser(accessToken);

    // Find or create user in our database
    const user = await findOrCreateUser(githubUser);

    // Create session and redirect to dashboard
    return createUserSession(user.id, "/dashboard");
  } catch (error) {
    console.error("OAuth callback error:", error);
    return redirect("/?error=auth_failed");
  }
}
