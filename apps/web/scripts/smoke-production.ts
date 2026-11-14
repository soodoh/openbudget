import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Exercise the built server against a disposable database, never the user's data.
const directory = await mkdtemp(join(tmpdir(), "openbudget-smoke-"));
const listener = Bun.serve({ port: 0, fetch: () => new Response() });
const port = listener.port;
listener.stop(true);
const baseURL = `http://localhost:${port}`;
const server = Bun.spawn(["bun", "run", ".output/server/index.mjs"], {
	cwd: new URL("..", import.meta.url).pathname,
	env: {
		...process.env,
		NODE_ENV: "production",
		HOST: "127.0.0.1",
		PORT: String(port),
		DATABASE_URL: join(directory, "sqlite.db"),
		BETTER_AUTH_URL: baseURL,
		BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
	},
	stdout: "ignore",
	stderr: "inherit",
});

function client() {
	let cookie = "";
	return async (path: string, method = "GET", body?: unknown, status = 200) => {
		const response = await fetch(`${baseURL}${path}`, {
			method,
			headers: {
				"Content-Type": "application/json",
				Origin: baseURL,
				Cookie: cookie,
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const cookies = response.headers.getSetCookie();
		if (cookies.length) cookie = cookies.map((c) => c.split(";")[0]).join("; ");
		assert.equal(response.status, status, `${method} ${path}`);
		return response.json();
	};
}

try {
	let ready = false;
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			const response = await fetch(`${baseURL}/login`);
			if (response.ok) {
				assert.match(await response.text(), /Sign in/i);
				ready = true;
				break;
			}
		} catch {
			// The server may not be listening yet.
		}
		if (server.exitCode !== null) throw new Error("Production server exited");
		await Bun.sleep(100);
	}
	assert.ok(ready, "Production server did not become ready");

	const owner = client();
	await owner("/api/budgets", "GET", undefined, 401);
	const email = `smoke-${crypto.randomUUID()}@example.com`;
	const password = crypto.randomUUID();
	await owner("/api/auth/sign-up/email", "POST", {
		name: "Smoke Test",
		email,
		password,
	});
	const session = await owner("/api/auth/get-session");
	assert.equal(session.user.email, email);
	const budget = await owner(
		"/api/budgets",
		"POST",
		{ name: "Smoke Budget", currency: "USD" },
		201,
	);
	const path = `/api/budgets/${budget.id}`;
	assert.equal((await owner("/api/budgets")).length, 1);
	assert.equal((await owner(path)).name, "Smoke Budget");
	assert.equal(
		(await owner(path, "PATCH", { name: "Updated Budget" })).name,
		"Updated Budget",
	);

	const group = await owner(
		`${path}/categories/groups`,
		"POST",
		{ name: "Essentials" },
		201,
	);
	const source = await owner(
		`${path}/categories`,
		"POST",
		{ groupId: group.id, name: "Groceries" },
		201,
	);
	const target = await owner(
		`${path}/categories`,
		"POST",
		{ groupId: group.id, name: "Rent" },
		201,
	);
	const month = "2026-11";
	await owner(`${path}/grid/assign`, "PUT", {
		categoryId: source.id,
		month,
		amount: 10000,
	});
	await owner(`${path}/grid/move-money`, "POST", {
		fromCategoryId: source.id,
		toCategoryId: target.id,
		month,
		amount: 2500,
	});
	const grid = await owner(`${path}/grid?month=${month}`);
	const categories = grid.groups.flatMap(
		(g: { categories: { id: string; assigned: number }[] }) => g.categories,
	);
	assert.equal(
		categories.find((c: { id: string }) => c.id === source.id).assigned,
		7500,
	);
	assert.equal(
		categories.find((c: { id: string }) => c.id === target.id).assigned,
		2500,
	);
	await owner("/api/settings/theme", "PUT", { theme: "dark" });
	assert.equal((await owner("/api/settings/theme")).theme, "dark");

	const outsider = client();
	await outsider("/api/auth/sign-up/email", "POST", {
		name: "Other User",
		email: `smoke-${crypto.randomUUID()}@example.com`,
		password: crypto.randomUUID(),
	});
	await outsider(path, "GET", undefined, 403);
	await outsider(path, "DELETE", undefined, 403);
	await owner(path, "DELETE");
	assert.equal((await owner("/api/budgets")).length, 0);
	await owner("/api/auth/sign-out", "POST", {});
	await owner("/api/budgets", "GET", undefined, 401);
	await owner("/api/auth/sign-in/email", "POST", { email, password });
	assert.equal((await owner("/api/auth/get-session")).user.email, email);
	console.log(
		"Production smoke passed: SSR, auth, budget CRUD, categories, money movement, settings, access isolation.",
	);
} finally {
	server.kill();
	await server.exited;
	await rm(directory, { recursive: true, force: true });
}
