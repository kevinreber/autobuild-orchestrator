import { Outlet } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireUser } from "~/lib/auth.server";
import { Header } from "~/components/header";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header user={user} />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
