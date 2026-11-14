import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), react()],
	resolve: { tsconfigPaths: true },
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["src/**/*.test.{ts,tsx}"],
					exclude: ["src/__tests__/components/**"],
				},
			},
			{
				test: {
					name: "browser",
					include: ["src/__tests__/components/**/*.test.{ts,tsx}"],
					setupFiles: ["./src/__tests__/browser-setup.ts"],
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
