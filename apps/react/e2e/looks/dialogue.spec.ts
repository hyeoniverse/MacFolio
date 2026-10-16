// dialogue 모양: 고전 RPG 대화창으로 읽는다 — 타이틀 → 마을(주인공이 걸어 다니며 장소마다 주제를 연다) 또는
// 바로 가기 메뉴(번호 붙은 여정, NEXT) → 주제를 '다음'(▼)으로 한 장씩 → 끝맺음 → 연 곳(마을의 같은 자리, 또는 메뉴)으로 돌아온다(읽음 ✓)
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { openLook } from './open';
import { expectTheme } from './landing';
import { GENERAL_SAMPLE } from '../../src/apps/settings/lookSamples';

const dialogOf = (panel: Locator) => panel.getByRole('dialog', { name: '대화' });
const nextOf = (dialog: Locator) => dialog.getByRole('button', { name: '다음' });
const crumbOf = (panel: Locator) => panel.locator('.dl-crumb');
const hintOf = (panel: Locator) => panel.locator('.dl-keys');

/** '다음'을 눌러 가며 글이 나올 때까지 (한 주제는 많아야 스무 장 남짓) */
async function readUntil(dialog: Locator, target: Locator, limit = 24) {
	for (let i = 0; i < limit; i++) {
		if (await target.isVisible()) return;
		await nextOf(dialog).click();
	}
	await expect(target).toBeVisible();
}

const rootOf = (panel: Locator) => panel.locator('.dl');
const heroOf = (panel: Locator) => panel.locator('canvas.dl-hero');
const markOf = (panel: Locator, place: string) => panel.locator(`.dl-mark[data-place="${place}"]`);

/** 타이틀을 '다음'(▼)으로 넘겨 마을까지. 주인공이 입구에 선다 */
async function toVillage(panel: Locator) {
	const dialog = dialogOf(panel);
	const root = rootOf(panel);
	for (let i = 0; i < 6 && (await root.getAttribute('data-mode')) === 'greet'; i++) await nextOf(dialog).click();
	await expect(root).toHaveAttribute('data-mode', 'world');
	await expect(heroOf(panel)).toBeVisible();
}

/** 타이틀을 넘겨 마을에서 바로 가기 메뉴까지 (오른쪽 위 바로 가기 단추) */
async function toMenu(dialog: Locator) {
	const panel = dialog.page().locator('[data-app="safari"] .safari-page');
	await toVillage(panel);
	await panel.getByRole('button', { name: '바로 가기' }).click();
	await expect(dialog.locator('.dl-menu[data-open]')).toBeVisible();
}

/** 주인공의 칸 자리와 보는 쪽 (기다리지 않고 지금 값을 읽는다: 움직임 줄이기에서는 키를 누르는 즉시 옮겨 있다) */
async function spot(panel: Locator) {
	const hero = heroOf(panel);
	return {
		x: Number(await hero.getAttribute('data-x')),
		y: Number(await hero.getAttribute('data-y')),
		facing: await hero.getAttribute('data-facing'),
	};
}

/** 키를 여러 번 누른다 */
async function press(page: Page, key: string, times = 1) {
	for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

test('dialogue: 인사 → 메뉴 → 주요 기능을 한 장씩 → 끝맺음 → 읽음 표시, 기술 사양·조작법', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'dialogue' });
	const dialog = dialogOf(panel);

	// 인사: tagline이 이름표에 (움직임 줄이기라 타자 없이 바로 다 보인다). 길잡이 줄은 시작 ▸ 이름
	await expect(dialog).toContainText('농장에 작은 소동이 생겼어요');
	await expect(crumbOf(panel)).toContainText('SproutFarm');
	await expect(panel.locator('.dl-hp-count')).toContainText('0/');

	// 메뉴
	await toMenu(dialog);
	const features = dialog.getByRole('button', { name: '주요 기능' });
	await expect(features).toHaveAttribute('aria-pressed', 'false');
	await features.click();

	// 첫 장, 다음 항목 (길잡이 줄이 2/4로)
	await expect(dialog).toContainText('잡아서 울타리로');
	await readUntil(dialog, dialog.getByText('체력과 시간'));
	await expect(crumbOf(panel)).toContainText('주요 기능');
	await expect(crumbOf(panel)).toContainText('2/4');

	// 끝까지 넘기면 끝맺음 장, 그다음 메뉴로 돌아오고 읽은 주제에 체크
	await readUntil(dialog, dialog.getByText('이 주제를 다 봤습니다'));
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
	await toMenu(dialog);
	await dialog.getByRole('button', { name: '크레딧' }).click();
	await expect(dialog).toContainText('Sprout Lands Asset Pack');
});

test('dialogue: 조작법이 없는 프로젝트(qru)도 깨지지 않는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'dialogue' });
	const dialog = dialogOf(panel);
	await expect(dialog).toContainText('QR 한 장에 담은 나');
	await toMenu(dialog);
	await expect(dialog.getByRole('button', { name: '주요 기능' })).toBeVisible();
	await expect(dialog.getByRole('button', { name: '조작법' })).toHaveCount(0);
	await expect(dialog.getByRole('button', { name: '링크' })).toBeAttached();
});

test('dialogue: 메뉴 커서를 옮기면 무대의 그림이 그 주제의 것으로 바뀌고, 숫자는 대사로 읽는다', async ({ page }) => {
	const { safari, panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'dialogue' });
	// 무대는 창이 넉넉할 때 보인다
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const dialog = dialogOf(panel);

	// 메뉴: 커서를 옮기면 미리보기 액자의 그림이 바뀐다
	await toMenu(dialog);
	const preview = panel.locator('.dl-preview .dl-shot-frame img');
	await expect(preview).toBeVisible();
	const first = await preview.getAttribute('src');
	await dialog.getByRole('button', { name: '만든 방법' }).hover();
	await expect(preview).not.toHaveAttribute('src', first ?? '');

	// 숫자는 값(이름표)과 무엇의 숫자인지를 한 장씩
	await dialog.getByRole('button', { name: '숫자로 보기' }).click();
	await expect(dialog).toContainText('20마리');
	await expect(dialog).toContainText('자정 전에 데려올 동물');
});

test('dialogue: 화면 모음 주제는 그림을 한 장씩 캡션과 함께 넘긴다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'dialogue' });
	const dialog = dialogOf(panel);
	await toMenu(dialog);
	await dialog.getByRole('button', { name: '화면 모음' }).click();
	const shot = panel.locator('.dl-stage .dl-shot-frame img');
	await expect(dialog).toContainText('시작 — 동물들이 달아났다');
	await expect(crumbOf(panel)).toContainText('1/8');
	await expect(shot).toHaveAttribute('src', '/imgs/projects/sproutfarm/shots/intro.jpg');
	await nextOf(dialog).click();
	await expect(dialog).toContainText('오전 9시, 농장에서');
	await expect(crumbOf(panel)).toContainText('2/8');
	await expect(shot).toHaveAttribute('src', '/imgs/projects/sproutfarm/shots/farm.jpg');
});

test('dialogue: 장 목록에서 항목의 화면 여러 장을 액자 안에서 넘겨 본다', async ({ page }) => {
	const { safari, panel } = await openLook(page, { id: 'hyeoniverse', tab: /HYEONIVERSE/, look: 'dialogue' });
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const dialog = dialogOf(panel);
	await toMenu(dialog);
	await dialog.getByRole('button', { name: '더 많은 이야기' }).click();
	await expect(crumbOf(panel)).toContainText('더 많은 이야기');
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

test('dialogue: Z로 넘기고 고르며, ↓·→는 다음 줄로, X는 장 목록에서 처음 메뉴로 돌아간다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'hyeoniverse', tab: /HYEONIVERSE/, look: 'dialogue' });
	const dialog = dialogOf(panel);
	await toMenu(dialog);
	const features = dialog.getByRole('button', { name: '주요 기능' });
	await expect(features).toBeVisible();

	// 한 열 여정 목록: →(↓)는 다음 줄로 커서를 옮긴다
	const active = dialog.locator('.dl-menu[data-open] button[data-active]');
	await expect(active).toContainText('주요 기능');
	await page.keyboard.press('ArrowRight');
	await expect(active).toContainText('만든 방법');

	// 장 목록에서 X를 누르면 처음 메뉴로 (커서는 '더 많은 이야기')
	await dialog.getByRole('button', { name: '더 많은 이야기' }).click();
	await expect(dialog.getByRole('button', { name: '처음 메뉴로' })).toBeVisible();
	await page.keyboard.press('x');
	await expect(features).toBeVisible();
	await expect(active).toContainText('더 많은 이야기');

	// Z는 고르기와 다음
	await features.focus();
	await page.keyboard.press('z');
	await expect(crumbOf(panel)).toContainText('1/');
	for (let i = 0; i < 4 && !(await crumbOf(panel).textContent())?.includes('2/'); i++) await page.keyboard.press('z');
	await expect(crumbOf(panel)).toContainText('2/');
});

test('dialogue: 게임 화면이 페이지를 꽉 채우고(정수 배), 창은 반투명한 짙은 바탕에 얇은 테두리, 그림은 원래 모습 그대로 액자에 띄운다', async ({
	page,
}) => {
	// 장면을 그리기 전 한 순간 보이는 페이지 바탕: 라이트는 옅은 하늘색, 다크는 짙은 남색
	await expectTheme(page, 'dialogue', { light: 'rgb(232, 244, 255)', dark: 'rgb(18, 19, 48)' });
	const { safari, panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'dialogue' });
	await safari.getByRole('button', { name: '전체 화면' }).click();
	// 그림이 있는 주제를 연다 (바로 가기 메뉴에서)
	await toMenu(dialogOf(panel));
	await dialogOf(panel).getByRole('button', { name: '주요 기능' }).click();
	const shot = panel.locator('.dl-stage .dl-shot-frame img').first();
	await expect(shot).toBeVisible();
	// 그림을 픽셀로 바꾸거나 무대 안에 풍경을 깔지 않는다
	expect(await shot.evaluate((img) => getComputedStyle(img).imageRendering)).toBe('auto');
	await expect(panel.locator('.dl-stage canvas')).toHaveCount(0);
	// 그림이 있으면 그림만 크게: 옆의 게임 화면이 없고, 액자는 무대 가운데에서 폭이나 높이 한쪽에 닿는다 (비율은 그대로)
	await expect(panel.locator('.dl-stage .dlp')).toHaveCount(0);
	await expect
		.poll(async () =>
			shot.evaluate((img) => {
				const stage = img.closest('.dl-scene')!.getBoundingClientRect();
				const frame = img.closest('.dl-shot-frame')!.getBoundingClientRect();
				const ratio = (img as HTMLImageElement).naturalWidth / (img as HTMLImageElement).naturalHeight;
				const shown = img.getBoundingClientRect();
				const centred = Math.abs(frame.left + frame.width / 2 - (stage.left + stage.width / 2)) <= 2;
				const fills = frame.width >= stage.width - 2 || frame.height >= stage.height - 2;
				const keeps = Math.abs(shown.width / shown.height - ratio) < 0.03;
				return centred && fills && keeps;
			})
		)
		.toBe(true);
	// 창: 1칸 밝은 테두리와 반투명한 짙은 바탕 (라이트·다크가 같고, 장면이 색을 낸다)
	const box = dialogOf(panel).locator('.dl-box');
	expect(await box.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
	expect(await box.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgba(255, 255, 255, 0.85)');
	expect(await box.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(14, 16, 28, 0.78)');
	// 화면 전체가 정수 배로 커지고(글자·테두리·그림이 한 격자), 넉넉한 전체 화면에서는 세 배 이상 (대사 글자 33px)
	const screen = panel.locator('.dl-screen');
	const zoom = Number(await screen.getAttribute('data-zoom'));
	expect(Number.isInteger(zoom) && zoom >= 3).toBe(true);
	// 게임 화면이 페이지를 꽉 채운다 (게임 칸으로 올림해 오른쪽·아래가 많아야 zoom − 1 px 넘친다)
	const page_ = await panel.evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
	const rect = await screen.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
	expect(rect.width).toBeGreaterThanOrEqual(page_.w - 0.5);
	expect(rect.width).toBeLessThanOrEqual(page_.w + zoom);
	expect(rect.height).toBeGreaterThanOrEqual(page_.h - 0.5);
	expect(rect.height).toBeLessThanOrEqual(page_.h + zoom);
	// 장면 캔버스도 화면 크기 그대로 칠한다
	const canvas = panel.locator('.dl-game > canvas.dl-backdrop').first();
	expect(Number(await canvas.getAttribute('width')) * zoom).toBeCloseTo(rect.width, 0);
	expect(Number(await canvas.getAttribute('height')) * zoom).toBeCloseTo(rect.height, 0);
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
	await toMenu(dialog);
	await dialog.getByRole('button', { name: '주요 기능' }).click();
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
	await toMenu(dialog);

	// 전투: 몬스터 그림과 HP. 문제 → 원인 → 해결 → 결과로 넘길수록 HP가 줄어 0이 된다
	await dialog.getByRole('button', { name: '트러블슈팅' }).click();
	const battle = panel.locator('.dl-stage [data-panel="troubleshooting"]');
	// 몬스터는 Ninja Adventure 묶음의 그림 (코드로 그린 칸 그림이 아니다)
	const monster = battle.locator('.dlp-monster');
	await expect(monster).toBeVisible();
	expect(await monster.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('/imgs/rpg/ninja/monsters/');
	// 무대 뒤는 전투 들판, 몬스터는 그림자 위에 선다
	await expect(panel.locator('.dl-game')).toHaveAttribute('data-scene', 'field');
	await expect(battle.locator('.dlp-on .dlp-platform')).toBeVisible();
	// 장면은 픽셀 타일 그림 캔버스 (낮·밤 두 장 중 테마에 맞는 한 장만 보인다), 아이콘은 Font Awesome이 아닌 픽셀 아이콘
	await expect(panel.locator('.dl-game > canvas.dl-backdrop')).toHaveCount(2);
	await expect(panel.locator('.dl-game > canvas.dl-backdrop:visible')).toHaveCount(1);
	await expect(battle.locator('.dlp-battle-menu svg').first()).toBeVisible();
	await expect(panel.locator('.dl-stage [class*="fa-"]')).toHaveCount(0);
	await expect(battle.locator('.dlp-hp-track')).toHaveAttribute('data-level', 'high');
	const hp = battle.locator('.dlp-hp');
	// 첫 버그의 장들을 넘기며 HP를 모은다 (긴 단계는 여러 장이라 같은 HP가 이어지면 하나로)
	const seen: number[] = [];
	while ((await crumbOf(panel).textContent())?.includes('버그 1/3')) {
		const value = Number(await hp.getAttribute('data-hp'));
		if (seen.at(-1) !== value) seen.push(value);
		// HP가 다 닳은 막대는 빨강 단계
		if (value === 0) await expect(battle.locator('.dlp-hp-track')).toHaveAttribute('data-level', 'low');
		await nextOf(dialog).click();
	}
	expect(seen).toHaveLength(4);
	expect(seen[0]).toBe(100);
	expect(seen.at(-1)).toBe(0);
	for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThan(seen[i - 1]);
	// 끝까지 읽어 선택지로
	await readUntil(dialog, dialog.getByRole('button', { name: '함께한 사람' }), 40);

	// 파티: 팀원 수만큼 카드, 나는 ★ 나
	await dialog.getByRole('button', { name: '함께한 사람' }).click();
	const party = panel.locator('.dl-stage [data-panel="team"]');
	await expect(panel.locator('.dl-game')).toHaveAttribute('data-scene', 'plaza');
	const team = GENERAL_SAMPLE.team ?? [];
	await expect(party.locator('.dlp-party > li')).toHaveCount(team.length);
	await expect(party.locator('li[data-me]')).toHaveCount(1);
	await expect(party.locator('li[data-me]')).toContainText(team.find((m) => m.me)?.name ?? '');
	await expect(party.locator('li[data-me]')).toContainText('★ 나');
	await readUntil(dialog, dialog.getByRole('button', { name: '볼 수 있는 곳' }));

	// 보물: 배포 결과물마다 상자 하나, 링크는 실제 주소로 열린다
	await dialog.getByRole('button', { name: '볼 수 있는 곳' }).click();
	const treasure = panel.locator('.dl-stage [data-panel="deployments"]');
	for (const item of GENERAL_SAMPLE.deployments ?? []) {
		if (!item.url) continue;
		const link = treasure.getByRole('link', { name: new RegExp(item.label) });
		await expect(link).toHaveAttribute('href', item.url);
		await expect(link).toHaveAttribute('target', '_blank');
	}
});

test('dialogue: 길잡이 줄은 메뉴 ▸ 주제 ▸ n/N 단계를 장마다 바꿔 적고, 단계 점과 읽기 프로그램용 알림도 따라간다', async ({
	page,
}) => {
	const { safari, panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const dialog = dialogOf(panel);
	await toMenu(dialog);
	await expect(crumbOf(panel)).toHaveText('메뉴');
	await dialog.getByRole('button', { name: '트러블슈팅' }).click();
	const crumb = crumbOf(panel);
	await expect(crumb).toContainText('메뉴▸트러블슈팅▸버그 1/3▸1/4 문제');
	await expect(panel.locator('.dl-pips i')).toHaveCount(4);
	await expect(panel.locator('.dl-pips i[data-state="now"]')).toHaveCount(1);
	await readUntil(dialog, crumb.filter({ hasText: '2/4 원인' }));
	await expect(panel.locator('.dl-pips i[data-state="done"]')).toHaveCount(1);
	await expect(panel.getByRole('status').filter({ hasText: '2/4 원인' })).toBeAttached();
	await readUntil(dialog, crumb.filter({ hasText: '버그 2/3' }), 30);
	await expect(crumb).toContainText('1/4 문제');
});

test('dialogue: 주제를 다 보면 다음 주제를 알려 주고, 메뉴에 돌아오면 커서와 NEXT가 그 주제에 있다', async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	const dialog = dialogOf(panel);
	await toMenu(dialog);
	const nextTag = dialog.locator('.dl-menu[data-open] button[data-next]');
	const active = dialog.locator('.dl-menu[data-open] button[data-active]');
	// 처음 메뉴: NEXT와 커서가 1번 주요 기능에, 읽은 주제 0개
	await expect(nextTag).toContainText('주요 기능');
	await expect(active).toContainText('주요 기능');
	await expect(panel.locator('.dl-hud .dl-hp-count')).toHaveText(/읽은 주제 0\/\d+/);

	await page.keyboard.press('Enter');
	await readUntil(dialog, dialog.getByText("이 주제를 다 봤습니다. 메뉴로 돌아갑니다. 다음은 '만든 방법'입니다."), 40);
	await expect(crumbOf(panel)).toContainText('끝');
	await page.keyboard.press('z');
	// 돌아온 메뉴: NEXT와 커서가 다음 주제로 옮겨 가고, 읽은 주제는 ✓
	await expect(nextTag).toContainText('만든 방법');
	await expect(active).toContainText('만든 방법');
	await expect(dialog.getByRole('button', { name: '주요 기능' })).toHaveAttribute('aria-pressed', 'true');
	await expect(panel.locator('.dl-hud .dl-hp-count')).toHaveText(/읽은 주제 1\/\d+/);
});

test('dialogue: 아래 줄은 지금 누를 수 있는 키만 적고, X와 메뉴로 단추는 읽던 주제에 커서를 두고 메뉴로 돌아간다', async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	const dialog = dialogOf(panel);
	await expect(hintOf(panel)).toHaveText('Z/Enter 다음 · X 메뉴로');
	// 마을에서는 걷기·살펴보기·바로 가기, 메뉴에서는 고르기·보기·마을로 (오른쪽 위 단추도 마을로)
	await toVillage(panel);
	await expect(hintOf(panel)).toHaveText('←↑↓→ 걷기 · Z 살펴보기 · X 바로 가기');
	await panel.getByRole('button', { name: '바로 가기' }).click();
	await expect(hintOf(panel)).toContainText('↑↓ 고르기');
	await expect(hintOf(panel)).toContainText('X 마을로');
	await expect(panel.locator('.dl-tomenu')).toHaveText('X마을로');

	await dialog.getByRole('button', { name: '진행 과정' }).click();
	await expect(hintOf(panel)).toHaveText('Z/Enter 다음 · X 메뉴로');
	await nextOf(dialog).click();
	await expect(crumbOf(panel)).toContainText('2/');
	await page.keyboard.press('x');
	const active = dialog.locator('.dl-menu[data-open] button[data-active]');
	await expect(active).toContainText('진행 과정');
	// 다 읽지 않았으니 읽음 표시는 없다
	await expect(active).toHaveAttribute('aria-pressed', 'false');

	await page.keyboard.press('Enter');
	// 대화 상자를 눌러도 넘어간다
	await dialog.locator('.dl-box').click();
	await expect(crumbOf(panel)).toContainText('2/');
	await panel.getByRole('button', { name: '메뉴로' }).click();
	await expect(active).toContainText('진행 과정');

	// 끝맺음 장에서는 메뉴로 돌아가는 것만
	await page.keyboard.press('Enter');
	await readUntil(dialog, dialog.getByText('이 주제를 다 봤습니다'), 30);
	await expect(hintOf(panel)).toHaveText('Z/Enter 메뉴로 돌아가기');
});

test('dialogue: 모든 주제를 다 보면 엔딩이 나오고, 그다음 메뉴로 돌아간다', async ({ page }) => {
	const { panel } = await openLook(page, {
		id: 'qru',
		tab: /QRU/,
		look: 'dialogue',
		override: {
			highlights: [{ title: '하나뿐인 기능', body: '이 주제 하나만 읽으면 됩니다.' }],
			build: [],
			usage: null,
			troubleshooting: null,
			controls: null,
			timeline: null,
			team: null,
			deployments: null,
			credits: null,
			chapters: null,
			gallery: [],
			galleryFolder: null,
			facts: [],
			specs: [],
			stack: [],
			contributions: [],
		},
	});
	const dialog = dialogOf(panel);
	await toMenu(dialog);
	// 남은 주제(주요 기능, 맡은 일)를 NEXT 차례대로 읽는다: 메뉴에서는 Enter(커서가 NEXT에 있다), 이야기 중에는 Z
	const crumb = crumbOf(panel);
	for (let i = 0; i < 40 && (await crumb.textContent()) !== '엔딩'; i++) {
		if (await dialog.getByText('엔딩으로 갑니다').isVisible()) await expect(crumb).toContainText('끝');
		await page.keyboard.press((await dialog.locator('.dl-menu[data-open]').count()) > 0 ? 'Enter' : 'z');
	}
	await expect(crumb).toHaveText('엔딩');
	await expect(dialog).toContainText('모든 주제를 다 봤습니다');
	await expect(hintOf(panel)).toHaveText('Z/Enter 메뉴로 돌아가기');
	await readUntil(dialog, dialog.locator('.dl-menu[data-open]'));
	await expect(dialog.locator('.dl-menu[data-open] button[data-next]')).toHaveCount(0);
});

test('dialogue: 게임 화면이 한 배도 안 들어가는 좁은 창에서는 메뉴가 한 열이고 방향 키 ↓로 차례대로 내려간다', async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'hyeoniverse', tab: /HYEONIVERSE/, look: 'dialogue' });
	await panel.evaluate((el) => {
		const win = el.closest('[data-app="safari"]') as HTMLElement | null;
		if (win) win.style.width = '330px';
	});
	await expect(panel.locator('.dl')).toHaveAttribute('data-fit', 'compact');
	const dialog = dialogOf(panel);
	await toMenu(dialog);
	const active = dialog.locator('.dl-menu[data-open] button[data-active]');
	await expect(active).toContainText('주요 기능');
	await page.keyboard.press('ArrowDown');
	await expect(active).toContainText('만든 방법');
});

// ─── 마을: 주인공을 움직여 장소마다 주제를 연다 ───

test('dialogue 마을: 타이틀에서 Z를 누르면 입구에 주인공이 서고, 방향 키·WASD로 한 칸씩 걸으며 돌부처 상·집에 막힌다', async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	const root = rootOf(panel);
	const hero = heroOf(panel);
	// 타이틀: 마을 위에 표지판과 ▶ PRESS Z, 주인공은 아직 없다
	await expect(root).toHaveAttribute('data-mode', 'greet');
	await expect(panel.locator('.dl-stage [data-panel="title"]')).toContainText('PRESS Z');
	await expect(panel.locator('.dl-village').first()).toBeAttached();
	await expect(hero).toBeHidden();
	// 마을은 Ninja Adventure 타일로 칠한 판 (그림을 받으면 칠한다), 사람·몬스터는 그 묶음의 그림 칸
	await expect(panel.locator('canvas.dl-village[data-painted]').first()).toBeAttached();
	const actor = panel.locator('.dl-actor[data-kind="person"] .dl-actor-body').first();
	await expect(actor).toBeAttached();
	expect(await actor.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('/imgs/rpg/ninja/chars/');
	// 키가 페이지에 닿게 탭 단추의 포커스를 푼다
	await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
	for (let i = 0; i < 6 && (await root.getAttribute('data-mode')) === 'greet'; i++) await page.keyboard.press('z');
	await expect(root).toHaveAttribute('data-mode', 'world');
	await expect(hero).toBeVisible();
	expect(await spot(panel)).toEqual({ x: 19, y: 21, facing: 'up' });
	await expect(panel.locator('.dl-hud .dl-hp-count')).toHaveText(/읽은 주제 0\/\d+/);

	// 한 칸씩 (움직임 줄이기라 누르는 즉시)
	await page.keyboard.press('ArrowRight');
	expect(await spot(panel)).toEqual({ x: 20, y: 21, facing: 'right' });
	await page.keyboard.press('ArrowLeft');
	await press(page, 'ArrowUp', 8);
	expect(await spot(panel)).toEqual({ x: 19, y: 13, facing: 'up' });
	// 광장 가운데 돌부처 상에 막힌다
	await page.keyboard.press('ArrowUp');
	expect(await spot(panel)).toEqual({ x: 19, y: 13, facing: 'up' });

	// 서쪽 길을 따라 여관 문 앞까지, 여관 벽에 막힌다 (WASD도 걷는다)
	await press(page, 'ArrowLeft', 7);
	await press(page, 'w', 6);
	expect(await spot(panel)).toEqual({ x: 12, y: 7, facing: 'up' });
	await page.keyboard.press('w');
	expect(await spot(panel)).toEqual({ x: 12, y: 7, facing: 'up' });
	await page.keyboard.press('a');
	await page.keyboard.press('d');
	await page.keyboard.press('w');
	expect(await spot(panel)).toEqual({ x: 12, y: 7, facing: 'up' });
	// 앞의 장소: 길잡이와 안내 창, 읽기 프로그램 알림
	await expect(crumbOf(panel)).toHaveText('마을▸여관');
	await expect(panel.locator('.dl-prompt')).toHaveText('Z여관 · 맡은 일 보기');
	await expect(panel.getByRole('status').filter({ hasText: '앞에 있는 곳은 여관입니다' })).toBeAttached();

	// Z: 맡은 일을 연다. X는 마을의 같은 자리로 돌아온다
	await page.keyboard.press('z');
	await expect(root).toHaveAttribute('data-mode', 'topic');
	await expect(crumbOf(panel)).toContainText('마을▸맡은 일▸1/');
	await expect(hintOf(panel)).toContainText('X 마을로');
	await page.keyboard.press('x');
	await expect(root).toHaveAttribute('data-mode', 'world');
	expect(await spot(panel)).toEqual({ x: 12, y: 7, facing: 'up' });

	// 북쪽 문: 아직 닫혀 있다는 알림
	await press(page, 'ArrowRight', 7);
	await press(page, 'ArrowUp', 5);
	expect(await spot(panel)).toEqual({ x: 19, y: 3, facing: 'up' });
	await expect(panel.locator('.dl-prompt')).toContainText('북쪽 문 · 닫혀 있음');
	await page.keyboard.press('z');
	await expect(panel.locator('.dl-prompt')).toHaveText('북쪽 문이 닫혀 있습니다. 모든 주제를 읽으면 열립니다.');
	await expect(root).toHaveAttribute('data-mode', 'world');
});

test("dialogue 마을: 게시판 앞에서 Z를 누르면 주요 기능을 읽고, 다 읽으면 마을의 그 자리로 돌아와 '!'가 ✓로 바뀐다", async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	const dialog = dialogOf(panel);
	const root = rootOf(panel);
	await toVillage(panel);
	const board = markOf(panel, 'board');
	await expect(board).toHaveAttribute('data-state', 'new');

	// 게시판(21–22, 18)에 막혀 그 앞에 선다
	await press(page, 'ArrowRight', 2);
	await press(page, 'ArrowUp', 3);
	expect(await spot(panel)).toEqual({ x: 21, y: 19, facing: 'up' });
	await expect(crumbOf(panel)).toHaveText('마을▸퀘스트 게시판');
	await expect(panel.locator('.dl-prompt')).toContainText('퀘스트 게시판 · 주요 기능 보기');

	await page.keyboard.press('z');
	await expect(crumbOf(panel)).toContainText('마을▸주요 기능▸1/');
	await expect(panel.locator('.dl-stage [data-panel="quests"]')).toBeVisible();
	await readUntil(dialog, dialog.getByText('이 주제를 다 봤습니다. 마을로 돌아갑니다.'), 40);
	await expect(hintOf(panel)).toHaveText('Z/Enter 마을로 돌아가기');
	await page.keyboard.press('z');
	await expect(root).toHaveAttribute('data-mode', 'world');
	expect(await spot(panel)).toEqual({ x: 21, y: 19, facing: 'up' });
	await expect(board).toHaveAttribute('data-state', 'read');
	await expect(panel.locator('.dl-hud .dl-hp-count')).toHaveText(/읽은 주제 1\/\d+/);
	await expect(panel.locator('.dl-prompt')).toContainText('✓');
});

test('dialogue 마을: 화면을 누르면 그 칸까지 걸어가고, 장소를 누르면 옆까지 가서 그 주제를 연다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	const root = rootOf(panel);
	await toVillage(panel);
	const hero = heroOf(panel);
	/** 주인공 칸에서 (dx, dy)칸 떨어진 칸의 가운데를 누른다 (주인공 그림의 폭이 한 칸) */
	const clickTile = async (dx: number, dy: number) => {
		const box = await hero.boundingBox();
		if (!box) throw new Error('주인공이 안 보인다');
		const tile = box.width;
		await page.mouse.click(box.x + tile / 2 + dx * tile, box.y + box.height - tile / 2 + dy * tile);
	};
	// 풀밭 두 칸 왼쪽 (19, 21) → (17, 21)
	await clickTile(-2, 0);
	await expect(hero).toHaveAttribute('data-x', '17');
	await expect(hero).toHaveAttribute('data-y', '21');
	// 바로 왼쪽의 조작 안내판(16, 21)을 누르면 그쪽을 보고 조작법을 연다
	await clickTile(-1, 0);
	await expect(root).toHaveAttribute('data-mode', 'topic');
	await expect(crumbOf(panel)).toContainText('마을▸조작법');
	await page.keyboard.press('x');
	await expect(root).toHaveAttribute('data-mode', 'world');
	expect(await spot(panel)).toEqual({ x: 17, y: 21, facing: 'left' });
	// 떨어진 장소(게시판)를 누르면 길을 찾아 옆까지 걸어가 연다
	await clickTile(4, -3);
	await expect(crumbOf(panel)).toContainText('마을▸주요 기능');
});

test('dialogue 마을: 바로 가기 메뉴(X)로 걷지 않고 모든 주제에 닿고, X로 마을에 돌아온다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	const dialog = dialogOf(panel);
	const root = rootOf(panel);
	await toVillage(panel);
	await page.keyboard.press('x');
	const menu = dialog.locator('.dl-menu[data-open]');
	await expect(menu).toBeVisible();
	const labels = await menu.locator('.dl-choices .dl-label').allTextContents();
	expect(labels.length).toBeGreaterThan(10);
	for (const label of labels) {
		await menu.getByRole('button', { name: label }).click();
		if (label === '더 많은 이야기') {
			await expect(crumbOf(panel)).toHaveText(`메뉴▸${label}`);
			await expect(dialog.locator('.dl-menu[data-open] .dl-choices button').first()).toBeVisible();
		} else {
			await expect(root).toHaveAttribute('data-mode', 'topic');
			await expect(crumbOf(panel)).toContainText(`메뉴▸${label}`);
		}
		await page.keyboard.press('x');
		await expect(menu).toBeVisible();
	}
	// 처음 메뉴에서 X는 마을로 (주인공은 그 자리 그대로)
	await page.keyboard.press('x');
	await expect(root).toHaveAttribute('data-mode', 'world');
	expect(await spot(panel)).toEqual({ x: 19, y: 21, facing: 'up' });
});

test('dialogue 마을: 모든 주제를 읽으면 북쪽 문이 열리고, 문으로 들어가면 엔딩 뒤 마을로 돌아온다', async ({
	page,
}) => {
	const { panel } = await openLook(page, {
		id: 'qru',
		tab: /QRU/,
		look: 'dialogue',
		override: {
			highlights: [{ title: '하나뿐인 기능', body: '이 주제 하나만 읽으면 됩니다.' }],
			build: [],
			usage: null,
			troubleshooting: null,
			controls: null,
			timeline: null,
			team: null,
			deployments: null,
			credits: null,
			chapters: null,
			gallery: [],
			galleryFolder: null,
			facts: [],
			specs: [],
			stack: [],
			contributions: [],
			role: '',
		},
	});
	const dialog = dialogOf(panel);
	const root = rootOf(panel);
	await toVillage(panel);
	await expect(markOf(panel, 'gate')).toHaveCount(0);
	// 없는 주제의 자리에는 장소가 없다 (상점은 빈집, 몬스터는 없다)
	await expect(markOf(panel, 'shop')).toHaveCount(0);
	await expect(markOf(panel, 'monster')).toHaveCount(0);

	await press(page, 'ArrowRight', 2);
	await press(page, 'ArrowUp', 2);
	await page.keyboard.press('z');
	await readUntil(dialog, dialog.getByText('모든 주제를 다 봐서 마을 북쪽 문이 열렸습니다'), 10);
	await page.keyboard.press('z');
	await expect(root).toHaveAttribute('data-mode', 'world');
	await expect(markOf(panel, 'gate')).toHaveAttribute('data-state', 'new');

	// 입구 길로 돌아가 돌부처 상을 비켜 북쪽 문 앞까지
	await press(page, 'ArrowLeft', 2);
	await press(page, 'ArrowUp', 6);
	await page.keyboard.press('ArrowLeft');
	await press(page, 'ArrowUp', 4);
	await page.keyboard.press('ArrowRight');
	await press(page, 'ArrowUp', 7);
	expect(await spot(panel)).toEqual({ x: 19, y: 3, facing: 'up' });
	await expect(panel.locator('.dl-prompt')).toContainText('북쪽 문 · 엔딩 보기');
	await page.keyboard.press('z');
	await expect(crumbOf(panel)).toHaveText('엔딩');
	await expect(hintOf(panel)).toHaveText('Z/Enter 마을로 돌아가기');
	for (let i = 0; i < 6 && (await root.getAttribute('data-mode')) === 'ending'; i++) await page.keyboard.press('z');
	await expect(root).toHaveAttribute('data-mode', 'world');
	expect(await spot(panel)).toEqual({ x: 19, y: 3, facing: 'up' });
});

test('dialogue 마을: 움직임을 줄이지 않으면 한 칸을 걸음 프레임으로 걷고, 움직임 줄이기에서는 바로 옮기며 말풍선도 멈춘다', async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /북클럽/, override: noImageSample() });
	await toVillage(panel);
	const hero = heroOf(panel);
	// 움직임 줄이기(시험 기본값): 누르는 즉시 옮기고, '!'는 뛰지 않는다
	await page.keyboard.press('ArrowRight');
	expect(await spot(panel)).toMatchObject({ x: 20, y: 21 });
	expect(await hero.getAttribute('data-moving')).toBeNull();
	expect(await markOf(panel, 'board').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

	// 움직임을 켜면: 키를 누른 동안 걷는 중(아직 앞 칸)이다가, 다 걸으면 한 칸 옮겨 멈춘다
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.keyboard.down('ArrowLeft');
	expect(await hero.getAttribute('data-moving')).toBe('');
	expect(await hero.getAttribute('data-x')).toBe('20');
	await page.keyboard.up('ArrowLeft');
	await expect(hero).toHaveAttribute('data-x', '19');
	await expect(hero).not.toHaveAttribute('data-moving');
	expect(await markOf(panel, 'board').evaluate((el) => getComputedStyle(el).animationName)).toBe('dl-bob');
});
