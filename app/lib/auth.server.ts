import { createCookieSessionStorage, redirect } from "react-router";
import { getDb } from "./db.server";
import type { User } from "~/types/database";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET environment variable is required in production");
    }
    console.warn("⚠️  SESSION_SECRET not set - using insecure default for development");
    return "dev-secret-do-not-use-in-production-12345";
  }
  return secret;
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [getSessionSecret()],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    return null;
  }
  return userId;
}

export async function getUser(request: Request): Promise<User | null> {
  const userId = await getUserId(request);
  if (!userId) {
    return null;
  }

  const db = getDb();
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", userId)
    .executeTakeFirst();

  return user || null;
}

export async function requireUserId(request: Request): Promise<string> {
  const userId = await getUserId(request);
  if (!userId) {
    throw redirect("/");
  }
  return userId;
}

export async function requireUser(request: Request): Promise<User> {
  const user = await getUser(request);
  if (!user) {
    throw redirect("/");
  }
  return user;
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

// GitHub OAuth helpers
export function getGitHubAuthUrl(): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const appUrl = process.env.APP_URL || "http://localhost:5173";

  if (!clientId) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("GITHUB_CLIENT_ID environment variable is required in production");
    }
    // Return a placeholder that shows setup instructions
    return "/auth/github/not-configured";
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/auth/github/callback`,
    scope: "read:user user:email",
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth credentials not configured");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description}`);
  }

  return data.access_token;
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GitHub user");
  }

  return response.json();
}

export async function findOrCreateUser(githubUser: GitHubUser): Promise<User> {
  const db = getDb();

  // Try to find existing user
  let user = await db
    .selectFrom("users")
    .selectAll()
    .where("github_id", "=", githubUser.id)
    .executeTakeFirst();

  if (user) {
    // Update user info if changed
    user = await db
      .updateTable("users")
      .set({
        github_username: githubUser.login,
        github_avatar_url: githubUser.avatar_url,
      })
      .where("id", "=", user.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  } else {
    // Create new user
    user = await db
      .insertInto("users")
      .values({
        github_id: githubUser.id,
        github_username: githubUser.login,
        github_avatar_url: githubUser.avatar_url,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  return user;
}
