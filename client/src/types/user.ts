import type { Role } from "core";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};
