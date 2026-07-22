import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type BackLinkProps = {
  to: string;
  children: ReactNode;
};

export function BackLink({ to, children }: BackLinkProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="mb-6 -ml-2.5 gap-1 px-2.5"
      nativeButton={false}
      render={
        <Link to={to}>
          <IconArrowLeft className="size-3.5" />
          {children}
        </Link>
      }
    />
  );
}
