import { data } from "react-router";
import type { Route } from "./+types/api.health";
import { getHealthStatus } from "~/lib/monitoring.server";

export async function loader({}: Route.LoaderArgs) {
  const health = await getHealthStatus();

  return data(health, {
    status: health.status === "healthy" ? 200 : 503,
  });
}
