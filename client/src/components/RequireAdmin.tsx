import { Navigate, Outlet } from "react-router-dom";
import { Role } from "core";
import { useSession } from "../lib/auth-client.ts";

export default function RequireAdmin() {
  const { data: session } = useSession();

  if (session?.user.role !== Role.admin) return <Navigate to="/" replace />;

  return <Outlet />;
}
