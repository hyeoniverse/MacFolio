// dialogue 모양: 고전 RPG 대화창으로 읽는다 — 인사 → 선택지 창 → 주제를 '다음'(▼)으로 한 장씩 → 다시 선택지(읽음 표시)
import type { Locator } from '@playwright/test';
import { test, expect } from '../fixtures';
import { openLook } from './open';
import { expectTheme } from './landing';
import { GENERAL_SAMPLE } from '../../src/apps/settings/lookSamples';

const dialogOf = (panel: Locator) => panel.getByRole('dialog', { name: '대화' });
const nextOf = (dialog: Locator) => dialog.getByRole('button', { name: '다음' });

/** '다음'을 눌러 가며 글이 나올 때까지 (한 주제는 많아야 열 장 남짓) */
async function readUntil(dialog: Locator, target: Locator, limit = 12) {
	for (let i = 0; i < limit; i++) {
		if (await target.isVisible()) return;
		await nextOf(dialog).click();
	}
	await expect(target).toBeVisible();
}

test('dialogue: 인사 → 선택지 → 주요 기능을 한 장씩 → 읽음 표시, 기술 사양·조작법', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'dialogue' });
	const dialog = dialogOf(panel);

	// 인사: tagline (움직임 줄이기라 타자 없이 바로 다 보인다)
	await expect(dialog).toContainText('농장에 작은 소동이 생겼어요');
	// 상태 줄: 이름과 읽은 주제 수 (HP 막대처럼)
	await expect(panel.locator('.dl-status')).toContainText('SproutFarm');
	await expect(panel.locator('.dl-hp-count')).toContainText('0 /');

	// 선택지
	await nextOf(dialog).click();
	const features = dialog.getByRole('button', { name: '주요 기능 알려줘' });
	await expect(features).toHaveAttribute('aria-pressed', 'false');
	await features.click();

	// 첫 장, 다음 장
	await expect(dialog).toContainText('잡아서 울타리로');
	await nextOf(dialog).click();
	await expect(dialog).toContainText('체력과 시간');
	await expect(dialog).toContainText('2 / 4');

	// 끝까지 넘기면 선택지로 돌아오고 읽은 주제에 체크
	await nextOf(dialog).click();
	await nextOf(dialog).click();
	await nextOf(dialog).click();
	await expect(features).toHaveAttribute('aria-pressed', 'true');
	await expect(features).toContainText('✓');

	// 기술 사양에 Vercel
	await dialog.getByRole('button', { name: '기술 사양' }).click();
	await readUntil(dialog, dialog.getByText('Vercel').first());

	// 조작법에 Shift (키보드 Space로도 넘어간다)
	const controls = dialog.getByRole('button', { name: '조작법' });
	await readUntil(dialog, controls);
	await controls.click();
	await page.keyboard.press('Space');
	await expect(dialog).toContainText('Shift');
});

test('dialogue: 빌려 쓴 에셋의 출처도 대사로 읽는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'dialogue' });
	const dialog = dialogOf(panel);
	await nextOf(dialog).click();
	await dialog.getByRole('button', { name: '누가 도와줬어?' }).click();
	await expect(dialog).toContainText('Sprout Lands Asset Pack');
});

test('dialogue: 조작법이 없는 프로젝트(qru)도 깨지지 않는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'dialogue' });
	const dialog = dialogOf(panel);
	await expect(dialog).toContainText('QR 한 장에 담은 나');
	await nextOf(dialog).click();
	await expect(dialog.getByRole('button', { name: '주요 기능 알려줘' })).toBeVisible();
	await expect(dialog.getByRole('button', { name: '조작법' })).toHaveCount(0);
	await expect(dialog.getByRole('button', { name: '링크 줘' })).toBeVisible();
});

test('dialogue: 선택지 커서를 옮기면 무대의 그림이 그 주제의 것으로 바뀌고, 숫자는 대사로 읽는다', async ({ page }) => {
	const { safari, panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'dialogue' });
	// 무대는 창이 넉넉할 때 보인다
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const dialog = dialogOf(panel);

	// 선택지: 커서를 옮기면 액자의 그림이 바뀐다
	await nextOf(dialog).click();
	const preview = panel.locator('.dl-preview .dl-shot-frame img');
	await expect(preview).toBeVisible();
	const first = await preview.getAttribute('src');
	await dialog.getByRole('button', { name: '어떻게 만들었어?' }).hover();
	await expect(preview).not.toHaveAttribute('src', first ?? '');

	// 숫자는 값과 무엇의 숫자인지를 한 장씩
	await dialog.getByRole('button', { name: '숫자로 보여줘' }).click();
	await expect(dialog).toContainText('20마리');
	await expect(dialog).toContainText('자정 전에 데려올 동물');
});

test('dialogue: 화면 모음 주제는 그림을 한 장씩 캡션과 함께 넘긴다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'dialogue' });
	const dialog = dialogOf(panel);
	await nextOf(dialog).click();
	await dialog.getByRole('button', { name: '화면 모음 보여줘' }).click();
	const shot = panel.locator('.dl-stage .dl-shot-frame img');
	await expect(dialog).toContainText('시작 — 동물들이 달아났다');
	await expect(dialog).toContainText('1 / 8');
	await expect(shot).toHaveAttribute('src', '/imgs/projects/sproutfarm/shots/intro.jpg');
	await nextOf(dialog).click();
	await expect(dialog).toContainText('오전 9시, 농장에서');
	await expect(shot).toHaveAttribute('src', '/imgs/projects/sproutfarm/shots/farm.jpg');
});

test('dialogue: 장 목록에서 항목의 화면 여러 장을 액자 안에서 넘겨 본다', async ({ page }) => {
	const { safari, panel } = await openLook(page, { id: 'hyeoniverse', tab: /HYEONIVERSE/, look: 'dialogue' });
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const dialog = dialogOf(panel);
	await nextOf(dialog).click();
	await dialog.getByRole('button', { name: '더 들려줄 이야기 있어?' }).click();
	await dialog.getByRole('button', { name: '발표 갤러리와 음성' }).click();
	const flipNext = panel.getByRole('button', { name: '다음 그림' });
	await readUntil(dialog, flipNext);
	await expect(panel.getByText('그림 1 / 2')).toBeAttached();
	await flipNext.click();
	await expect(panel.getByText('그림 2 / 2')).toBeAttached();
	await expect(panel.locator('.dl-stage .dl-shot-frame img')).toHaveAttribute(
		'src',
		'/imgs/projects/hyeoniverse/cms/gallery.jpg'
	);
});

test('dialogue: Z로 넘기고 고르며, →는 옆 열로, X는 장 목록에서 처음 선택지로 돌아간다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'hyeoniverse', tab: /HYEONIVERSE/, look: 'dialogue' });
	const dialog = dialogOf(panel);
	await nextOf(dialog).click();
	const features = dialog.getByRole('button', { name: '주요 기능 알려줘' });
	await expect(features).toBeVisible();

	// 두 열 선택지: →는 옆 열의 같은 줄로 커서를 옮긴다
	const active = dialog.locator('.dl-menu[data-open] button[data-active]');
	await expect(active).toContainText('주요 기능 알려줘');
	await page.keyboard.press('ArrowRight');
	await expect(active).not.toContainText('주요 기능 알려줘');

	// 장 목록에서 X를 누르면 처음 선택지로
	await dialog.getByRole('button', { name: '더 들려줄 이야기 있어?' }).click();
	await expect(dialog.getByRole('button', { name: '처음 선택지로' })).toBeVisible();
	await page.keyboard.press('x');
	await expect(features).toBeVisible();

	// Z는 고르기와 다음
	await features.focus();
	await page.keyboard.press('z');
	await expect(dialog).toContainText('1 / ');
	await page.keyboard.press('z');
	await expect(dialog).toContainText('2 / ');
});

test('dialogue: 라이트·다크 모두 검은 무대이고, 그림은 원래 모습 그대로 흰 액자에 띄운다', async ({ page }) => {
	await expectTheme(page, 'dialogue', { light: 'rgb(0, 0, 0)', dark: 'rgb(0, 0, 0)' });
	const { safari, panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'dialogue' });
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const shot = panel.locator('.dl-stage .dl-shot-frame img');
	await expect(shot).toBeVisible();
	// 그림을 픽셀로 바꾸거나 풍경을 깔지 않는다
	expect(await shot.evaluate((img) => getComputedStyle(img).imageRendering)).toBe('auto');
	await expect(panel.locator('.dl-stage canvas')).toHaveCount(0);
	const box = dialogOf(panel);
	expect(await box.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('6px');
	expect(await box.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(255, 255, 255)');
});

test('dialogue: 그림이 하나도 없으면 무대에 게임 화면(타이틀, 퀘스트)을 그린다', async ({ page }) => {
	const { safari, panel } = await openLook(page, {
		id: 'qru',
		tab: /QRU/,
		look: 'dialogue',
		override: {
			image: '',
			gallery: [],
			galleryFolder: null,
			highlights: [{ title: '한 장', body: '그림 없는 기능입니다.' }],
			build: [],
			usage: null,
			chapters: null,
		},
	});
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const dialog = dialogOf(panel);
	// 인사: 타이틀 화면 (프로젝트 아이콘, 이름, PRESS Z)
	const title = panel.locator('.dl-stage [data-panel="title"]');
	await expect(title.locator('.dl-sign-icon')).toBeVisible();
	await expect(title).toContainText('PRESS Z');
	await expect(panel.locator('.dl-stage .dl-shot-frame')).toHaveCount(0);
	await nextOf(dialog).click();
	await dialog.getByRole('button', { name: '주요 기능 알려줘' }).click();
	await expect(dialog).toContainText('그림 없는 기능입니다.');
	// 주요 기능: 퀘스트 목록이 지금 항목을 짚는다
	const quests = panel.locator('.dl-stage [data-panel="quests"]');
	await expect(quests.locator('li[data-state="now"]')).toContainText('한 장');
});

/** 공통 예시(북클럽)에서 그림을 모두 뺀 것: 주제마다 게임 화면이 무대를 채운다 */
const strip = <T extends object>(item: T) => {
	const {
		image: _image,
		shots: _shots,
		imageDark: _dark,
		video: _video,
		...rest
	} = item as T & Record<string, unknown>;
	return rest;
};
const noImageSample = () => {
	const sample = structuredClone(GENERAL_SAMPLE);
	return {
		...sample,
		look: 'dialogue',
		image: '',
		gallery: null,
		galleryFolder: null,
		logo: null,
		highlights: sample.highlights.map(strip),
		build: sample.build.map(strip),
		troubleshooting: (sample.troubleshooting ?? []).map(strip),
		deployments: (sample.deployments ?? []).map(strip),
		team: (sample.team ?? []).map(({ avatar: _avatar, ...member }) => member),
	};
};

test('dialogue: 트러블슈팅은 버그와의 전투(HP가 단계마다 준다), 팀원은 파티, 배포 결과물은 실제 링크가 달린 보물', async ({
	page,
}) => {
	const { safari, panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const dialog = dialogOf(panel);
	await expect(panel.locator('.dl-stage [data-panel="title"]')).toContainText(GENERAL_SAMPLE.name);
	await nextOf(dialog).click();

	// 전투: 몬스터 그림과 HP. 문제 → 원인 → 해결 → 결과로 넘길수록 HP가 줄어 0이 된다
	await dialog.getByRole('button', { name: '어려웠던 문제는?' }).click();
	const battle = panel.locator('.dl-stage [data-panel="troubleshooting"]');
	await expect(battle.locator('svg.dlp-monster')).toBeVisible();
	const hp = battle.locator('.dlp-hp');
	const seen: number[] = [];
	for (let step = 0; step < 4; step++) {
		seen.push(Number(await hp.getAttribute('data-hp')));
		await nextOf(dialog).click();
	}
	expect(seen[0]).toBe(100);
	expect(seen.at(-1)).toBe(0);
	for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThan(seen[i - 1]);
	// 끝까지 읽어 선택지로
	await readUntil(dialog, dialog.getByRole('button', { name: '누구랑 만들었어?' }), 20);

	// 파티: 팀원 수만큼 카드, 나는 ★ 나
	await dialog.getByRole('button', { name: '누구랑 만들었어?' }).click();
	const party = panel.locator('.dl-stage [data-panel="team"]');
	const team = GENERAL_SAMPLE.team ?? [];
	await expect(party.locator('.dlp-party > li')).toHaveCount(team.length);
	await expect(party.locator('li[data-me]')).toHaveCount(1);
	await expect(party.locator('li[data-me]')).toContainText(team.find((m) => m.me)?.name ?? '');
	await expect(party.locator('li[data-me]')).toContainText('★ 나');
	await readUntil(dialog, dialog.getByRole('button', { name: '어디서 볼 수 있어?' }));

	// 보물: 배포 결과물마다 상자 하나, 링크는 실제 주소로 열린다
	await dialog.getByRole('button', { name: '어디서 볼 수 있어?' }).click();
	const treasure = panel.locator('.dl-stage [data-panel="deployments"]');
	for (const item of GENERAL_SAMPLE.deployments ?? []) {
		if (!item.url) continue;
		const link = treasure.getByRole('link', { name: new RegExp(item.label) });
		await expect(link).toHaveAttribute('href', item.url);
		await expect(link).toHaveAttribute('target', '_blank');
	}
});

test('dialogue: 좁은 창에서는 선택지가 한 열이고 방향 키 ↓로 차례대로 내려간다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'hyeoniverse', tab: /HYEONIVERSE/, look: 'dialogue' });
	await panel.evaluate((el) => {
		const win = el.closest('[data-app="safari"]') as HTMLElement | null;
		if (win) win.style.width = '560px';
	});
	const dialog = dialogOf(panel);
	await nextOf(dialog).click();
	await expect(dialog.locator('.dl-menu[data-open] .dl-choices')).toHaveAttribute('data-cols', '1');
	const active = dialog.locator('.dl-menu[data-open] button[data-active]');
	await expect(active).toContainText('주요 기능 알려줘');
	await page.keyboard.press('ArrowDown');
	await expect(active).toContainText('어떻게 만들었어?');
});
