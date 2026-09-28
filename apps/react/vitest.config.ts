import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			// e2e/*.spec.ts는 Playwright가 실행한다
			include: ['src/**/*.test.ts'],
		},
	})
);
