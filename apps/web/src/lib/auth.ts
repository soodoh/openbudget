import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";

const envVars = process.env as Record<string, string | undefined>;

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite" }),
	emailAndPassword: { enabled: true },
	socialProviders: {
		google: {
			clientId: envVars.GOOGLE_CLIENT_ID ?? "",
			clientSecret: envVars.GOOGLE_CLIENT_SECRET ?? "",
		},
		github: {
			clientId: envVars.GITHUB_CLIENT_ID ?? "",
			clientSecret: envVars.GITHUB_CLIENT_SECRET ?? "",
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
	},
});
