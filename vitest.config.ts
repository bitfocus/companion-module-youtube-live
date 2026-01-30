import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/__tests__/**/*.ts'],
		exclude: ['**/node_modules/**', '**/dist/**'],
	},
});
