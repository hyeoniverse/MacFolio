// deck 모양(발표 슬라이드): 넘기기(단추·키·소터)와, 슬라이드 안에 그대로 둔 HYEONIVERSE 데모가 살아 있는지
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { FAKE_API } from '../fakeApi';
import { openLook } from './open';

const CORS = {
	'Access-Control-Allow-Origin': 'http://localhost:4173',
	'Access-Control-Allow-Headers': 'Content-Type',
};

/** 번역·요약 데모는 API를 거쳐 실제 AI를 부른다. 바깥 서비스를 부르지 않게 가짜 응답을 돌려준다 */
async function fakeAi(page: Page) {
	const translated: unknown[] = [];
	await page.route(`${FAKE_API}/translate`, (route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		if (request.method() === 'GET')
			return route.fulfill({ headers: CORS, json: { remaining: 3, perIp: 3, total: 50 } });
		translated.push(request.postDataJSON());
		return route.fulfill({
			headers: CORS,
			json: {
				provider: 'google',
				attempts: [
					{ provider: 'deepl', state: 'fail', reason: '사용 한도에 닿았습니다' },
					{ provider: 'google', state: 'ok' },
				],
				texts: [
					'A portfolio site designed, built and operated solo',
					'A personal portfolio that gathers projects and writing in one place.',
					'I built the site visitors see together with the admin CMS that runs it.',
				],
				remaining: 2,
			},
		});
	});
	await page.route(`${FAKE_API}/summary`, (route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		if (request.method() === 'GET')
			return route.fulfill({ headers: CORS, json: { remaining: 3, perIp: 3, total: 50 } });
		return route.fulfill({
			headers: CORS,
			json: { provider: 'groq', ko: '포트폴리오 요약입니다.', en: 'A portfolio summary.', remaining: 2 },
		});
	});
	return translated;
}

/** 소터를 열어 그 장(제목·종류)으로 간다 */
async function jump(panel: Locator, title: string, kind = 'content') {
	await panel.getByRole('button', { name: /소터/ }).click();
	await panel.locator(`.dk-sorter button[data-slide-kind="${kind}"][data-slide-title="${title}"]`).click();
	await expect(panel.locator('.dk-sorter')).toHaveCount(0);
}

test('deck: 진행 표시와 단추·키·소터로 넘기고, 슬라이드 안의 데모가 살아 있다', async ({ page }) => {
	const { safari, panel } = await openLook(page, { id: 'hyeoniverse', tab: /HYEONIVERSE/, look: 'deck' });
	// 발표는 큰 화면에서: 창을 최대화한다 (작은 기본 창에서는 슬라이드가 아주 작게 축소된다)
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const count = panel.locator('.dk-count');

	// 표지에서 시작: 1 / N. 발표자는 사이트 주인, 몽이는 표지 자리에 서 있다
	await expect(count).toHaveText(/^1 \/ \d+$/);
	const total = Number((await count.textContent())!.split('/')[1]);
	expect(total).toBeGreaterThan(20);
	await expect(panel.getByRole('region', { name: '표지' })).toContainText('김정현');
	const buddy = panel.locator('.cr-mascot');
	await expect(buddy).toBeVisible();
	await expect(buddy).toHaveAttribute('data-spot', 'hero');

	// 다음 단추 → 2 / N, ← 키 → 1 / N (단추를 눌러 포커스가 페이지 안에 있다)
	await panel.getByRole('button', { name: '다음', exact: true }).click();
	await expect(count).toHaveText(`2 / ${total}`);
	await expect(panel.getByRole('region', { name: '숫자로 보기' })).toBeVisible();
	await page.keyboard.press('ArrowLeft');
	await expect(count).toHaveText(`1 / ${total}`);
	await expect(panel.getByRole('button', { name: '이전', exact: true })).toBeDisabled();

	// Esc → 소터(모든 장의 썸네일). '기술 사양'을 누르면 그 장으로
	await page.keyboard.press('Escape');
	const sorter = panel.getByRole('dialog', { name: '슬라이드 소터' });
	await expect(sorter).toBeVisible();
	await expect(sorter.getByRole('button', { name: /번 / })).toHaveCount(total);
	await sorter.getByRole('button', { name: /기술 사양/ }).click();
	await expect(sorter).toHaveCount(0);
	await expect(panel.getByRole('region', { name: '기술 사양' })).toContainText('Next.js 16');
	await expect(count).toHaveText(`${total - 1} / ${total}`);
	await expect(panel.locator('.dk-dots [aria-current="true"]')).toHaveAttribute(
		'aria-label',
		`${total - 1}. 기술 사양`
	);

	// 발표자 노트: 지금 장의 설명이 옆 패널에
	await panel.getByRole('button', { name: /노트/ }).click();
	await expect(panel.getByRole('complementary', { name: '발표자 노트' })).toContainText('프레임워크');
	await panel.getByRole('button', { name: /노트/ }).click();

	// 관리자와 CMS: 다른 화면이 먼저 저장했으면 409로 막고, 초대받지 않은 GitHub 계정은 들이지 않는다
	await jump(panel, '관리자와 CMS');
	const writing = panel.getByRole('region', { name: '쓰기', exact: true });
	await writing.getByLabel(/다른/).check();
	await writing.getByRole('button', { name: '저장', exact: true }).click();
	await expect(writing.getByRole('status')).toContainText('409 Conflict');
	// 데모 입력칸에 포커스가 있을 때는 화살표 키가 장을 넘기지 않는다
	await writing.getByRole('textbox').first().focus();
	await page.keyboard.press('ArrowRight');
	await expect(panel.getByRole('region', { name: '쓰기', exact: true })).toBeVisible();
	const access = panel.getByRole('region', { name: '권한과 설정', exact: true });
	await access.scrollIntoViewIfNeeded();
	await access.getByRole('button', { name: '모르는 사람' }).click();
	await expect(access.locator('.cm-invite').getByRole('status')).toContainText('계정을 지웁니다');
	// 테마: 프리셋을 고르면 미리보기 이름이 바뀌고, 다크로 바꿀 수 있다
	await jump(panel, '테마');
	const themes = panel.getByRole('region', { name: '테마' }).locator('.cd-themes');
	await themes.getByRole('button', { name: 'Forest' }).click();
	await expect(themes.locator('.cd-themes-name')).toHaveText('Forest');
	await themes.getByRole('button', { name: /다크/ }).click();
	await expect(themes.getByRole('img', { name: 'Forest 테마 다크 미리보기' })).toBeVisible();
});

test('deck: 갤러리·파형·번역·요약·공급자 데모가 슬라이드 안에서 살아 있고, 몽이가 데모 곁에서 반응한다', async ({
	page,
}) => {
	const { safari, panel } = await openLook(page, { id: 'hyeoniverse', tab: /HYEONIVERSE/, look: 'deck' });
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const translated = await fakeAi(page);
	const count = panel.locator('.dk-count');
	const total = Number((await count.textContent())!.split('/')[1]);
	const buddy = panel.locator('.cr-mascot');

	// 발표 갤러리: 소리를 낼지 먼저 묻고, 고르면 물음이 사라진다. 파형: 나누면 클립이 둘, 되돌리면 하나
	await jump(panel, '발표 갤러리와 음성');
	const slides = panel.locator('.cd-slides');
	await slides.getByRole('button', { name: '음성 없이 보기' }).click();
	await expect(slides.locator('.cd-ask')).toHaveCount(0);
	await slides.getByRole('button', { name: '2장으로' }).click();
	await expect(slides.locator('.cd-slides-source')).toContainText('Fish TTS 음성 파일 · 발표 2쪽');
	const wave = panel.getByLabel('녹음 파형 편집기', { exact: true });
	await wave.scrollIntoViewIfNeeded();
	await wave.locator('.cd-wave-track').click({ position: { x: 120, y: 40 } });
	await wave.getByRole('button', { name: '나누기' }).click();
	await expect(wave.locator('.cd-clip')).toHaveCount(2);
	await wave.getByRole('button', { name: '되돌리기' }).click();
	await expect(wave.locator('.cd-clip')).toHaveCount(1);

	// 번역: EN으로 바꾸면 서버로 보내 영어 칸을 채운다. 몽이는 데모 곁에 와 있다가 끝나면 말풍선으로 알린다
	await jump(panel, 'AI 번역 · 요약 · 커버 · 음성');
	const translate = panel.locator('.cd-translate');
	await translate.getByRole('textbox', { name: '부제 (한국어)' }).fill('혼자 설계하고 운영하는 포트폴리오 사이트');
	await translate.getByRole('button', { name: 'EN' }).click();
	await expect(translate).toContainText('A portfolio site designed');
	await expect(translate.getByRole('status')).toContainText(
		'DeepL 실패(사용 한도에 닿았습니다) → Google로 번역했습니다'
	);
	await expect(buddy).toBeVisible();
	await expect(buddy).not.toHaveAttribute('data-spot', 'hero');
	await expect(panel.locator('.cr-bubble')).toHaveText('됐어요!');
	expect(translated).toEqual([
		{
			texts: [
				'혼자 설계하고 운영하는 포트폴리오 사이트',
				expect.stringContaining('개인 포트폴리오'),
				expect.stringContaining('관리자 CMS'),
			],
			from: 'ko',
			to: 'en',
		},
	]);
	// 요약: 발행하면 서버가 만든 요약과 공급자(Groq)
	const summary = panel.locator('.cd-summary');
	await summary.scrollIntoViewIfNeeded();
	await summary.getByRole('button', { name: /발행/ }).click();
	await expect(summary).toContainText('포트폴리오 요약입니다.');
	await expect(summary).toContainText('Groq로 만든 요약입니다');

	// AI 공급자: 성공하면 사용량이 오르고, 다음 달로 넘기면 0부터 (확률 실패는 끈다)
	await page.evaluate(() => (Math.random = () => 0.99));
	const providers = panel.locator('.cm-providers');
	await providers.scrollIntoViewIfNeeded();
	await providers.getByRole('button', { name: '요청 보내기' }).click();
	await expect(providers.getByRole('status')).toContainText('DeepL +1,800자 · DeepL에서 처리했습니다');
	await providers.getByRole('button', { name: '11월로 넘기기' }).click();
	await expect(providers).toContainText('이번 달 0번');

	// 마지막 장: 고맙습니다 + 링크 (포커스를 데모 밖으로 옮긴 뒤 End)
	await panel.locator('.dk-top-row').click();
	await page.keyboard.press('End');
	await expect(count).toHaveText(`${total} / ${total}`);
	await expect(panel.getByRole('region', { name: '맺음말' })).toContainText('고맙습니다');
	await expect(panel.getByRole('region', { name: '맺음말' }).getByRole('link', { name: /GitHub/ })).toBeVisible();
});
