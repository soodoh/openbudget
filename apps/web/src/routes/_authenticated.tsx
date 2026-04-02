import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth-session";

type SessionData = {
	user: {
		name: string;
		email: string;
		image?: string | undefined;
	};
};

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const session = await getSession();

		if (!session) {
			throw redirect({ to: "/login" });
		}

		return {
			session: {
				user: {
					name: session.user.name,
					email: session.user.email,
					image: session.user.image ?? undefined,
				},
			} satisfies SessionData,
		};
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout(): React.ReactElement {
	const { session } = Route.useRouteContext();
	const user = (session as SessionData).user;

	return (
		<AppShell user={user}>
			<Outlet />
		</AppShell>
	);
}
