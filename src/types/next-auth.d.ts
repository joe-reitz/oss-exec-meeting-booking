import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "marketing" | "ae" | "exec" | "admin";
    } & DefaultSession["user"];
  }
}
