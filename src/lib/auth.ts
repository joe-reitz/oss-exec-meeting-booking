import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { auth, signIn, signOut, handlers } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        if (!email) return null;

        // Look up existing user by email
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing) {
          return {
            id: existing.id,
            email: existing.email,
            name: existing.name,
            image: existing.avatarUrl,
          };
        }

        // In development, auto-create user
        const id = crypto.randomUUID();
        const [newUser] = await db
          .insert(users)
          .values({
            id,
            email,
            name: email.split("@")[0],
            role: "marketing",
          })
          .returning();

        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          image: newUser.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // On initial sign-in, attach user id
      if (user) {
        token.id = user.id;
      }

      // Fetch the latest role from the database
      if (token.id) {
        const [dbUser] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);

        if (dbUser) {
          token.role = dbUser.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as
          | "marketing"
          | "ae"
          | "exec"
          | "admin";
      }
      return session;
    },
  },
});
