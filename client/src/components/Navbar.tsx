import { Link, useNavigate } from "react-router-dom";
import { Role } from "core";
import { authClient } from "../lib/auth-client.ts";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Navbar({ user }: { user: { name: string; role: string } }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <nav className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link to="/" className="flex items-center gap-2 font-heading text-sm font-semibold tracking-[0.14em] text-foreground uppercase">
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
        Help desk
      </Link>
      <div className="flex items-center gap-5 text-sm">
        <Link to="/tickets" className="text-foreground/80 transition-colors hover:text-primary">
          Tickets
        </Link>
        {user.role === Role.admin && (
          <Link to="/users" className="text-foreground/80 transition-colors hover:text-primary">
            Users
          </Link>
        )}
        <span className="text-muted-foreground">{user.name}</span>
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="cursor-pointer rounded-md border border-border bg-muted/40 px-3.5 py-1.5 text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
