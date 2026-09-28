import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		launchOptions: { args: ['--mute-audio'] },
	},
	projects: [
		{
			name: 'desktop-chromium',
			// Dock 아이콘 12개가 모두 보이는 폭 (maxItems = (폭 - 300) / 100)
			use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
		},
	],
	// 빌드 결과를 대상으로 테스트한다 (pnpm build 후 실행)
	webServer: {
		command: `vite preview --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
	},
});
