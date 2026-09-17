import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { verifyUserCredentialsService } from '@/services';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const credResult = await verifyUserCredentialsService(
          credentials.email as string,
          credentials.password as string,
        );

        if (!credResult) {
          return null;
        }

        const { user } = credResult;

        return {
          id: String(user.id),
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
      }
      if (trigger === 'update' && session?.mustChangePassword !== undefined) {
        token.mustChangePassword = session.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        (session.user as unknown as { mustChangePassword: boolean }).mustChangePassword =
          (token.mustChangePassword as boolean) ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  trustHost: true,
});
