import { redirect } from "react-router";
import type { Route } from "./+types/auth.github";
import { getGitHubAuthUrl } from "~/lib/auth.server";

export async function loader({}: Route.LoaderArgs) {
  return redirect(getGitHubAuthUrl());
}
