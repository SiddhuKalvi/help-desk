import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../lib/auth-client.ts";
import Navbar from "./Navbar.tsx";

export default function RequireAuth() {
  const { data: session, isPending } = useSession();

  if (isPending) return <p className="p-8 text-center">Loading...</p>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <>
      <Navbar user={session.user} />
      <Outlet />
    </>
  );
}
