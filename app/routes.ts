import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  // Landing page
  index("routes/home.tsx"),

  // Auth routes
  route("auth/github", "routes/auth.github.tsx"),
  route("auth/github/callback", "routes/auth.github.callback.tsx"),
  route("auth/github/not-configured", "routes/auth.github.not-configured.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),

  // Dashboard (protected)
  layout("routes/dashboard.tsx", [
    route("dashboard", "routes/dashboard._index.tsx"),
    route("dashboard/projects/new", "routes/dashboard.projects.new.tsx"),
    route("dashboard/projects/:id", "routes/dashboard.projects.$id.tsx"),
    route("dashboard/settings", "routes/dashboard.settings.tsx"),
  ]),

  // API routes
  route("api/tickets/:id/status", "routes/api.tickets.$id.status.tsx"),
  route("api/health", "routes/api.health.tsx"),
] satisfies RouteConfig;
