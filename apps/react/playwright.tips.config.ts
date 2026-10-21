// 팁 앱 사용 설명서의 화면 그림을 다시 찍는다 (테스트가 아니다): pnpm build 후 pnpm exec playwright test -c playwright.tips.config.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
	...base,
	testDir: './tips-shots',
	fullyParallel: false,
	retries: 0,
	reporter: 'list',
	projects: [{ name: 'tips-shots', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
});
