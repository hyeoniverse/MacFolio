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
		// 위치·크기를 재는 테스트가 애니메이션 중간 값을 읽지 않도록 움직임을 끈다.
		// 애니메이션이 켜진 동작은 motion.spec.ts에서 따로 확인한다.
		reducedMotion: 'reduce',
		launchOptions: { args: ['--mute-audio'] },
	},
	projects: [
		{
			name: 'desktop-chromium',
			// Dock 아이콘 12개가 모두 보이는 폭 (maxItems = (폭 - 300) / 100)
			use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
			testIgnore: /mobile(-motion)?\.spec\.ts/,
		},
		// 모바일 셸(iOS 홈 화면). CI에는 Chromium만 설치하므로 iPhone도 Chromium으로 흉내 낸다.
		{
			name: 'mobile-iphone',
			use: { ...devices['iPhone 13'], browserName: 'chromium' },
			testMatch: /mobile(-motion)?\.spec\.ts/,
		},
		{
			name: 'mobile-android',
			use: { ...devices['Pixel 7'] },
			testMatch: /mobile(-motion)?\.spec\.ts/,
		},
	],
	// 빌드 결과를 대상으로 테스트한다 (pnpm build 후 실행)
	webServer: {
		command: `vite preview --port ${PORT} --strictPort`,
		// 미리보기도 배포와 같은 보안 헤더(CSP)를 붙인다 (vite.config.ts). 가짜 API(e2e/fakeApi.ts)를 API 주소로 더한다
		env: { CSP_TEST_API_URL: 'http://api.test' },
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
	},
});
