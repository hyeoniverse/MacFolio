// dialogue 모양: RPG 대화창으로 읽는다 — 인사 → 선택지 → 주제를 '다음'으로 한 장씩 → 다시 선택지(읽음 표시)
import type { Locator } from '@playwright/test';
import { test, expect } from '../fixtures';
import { openLook } from './open';

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
	await expect(panel.getByRole('list', { name: '숫자' })).toContainText('20마리');

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

test('dialogue: 조작법이 없는 프로젝트(qru)도 깨지지 않는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'dialogue' });
	const dialog = dialogOf(panel);
	await expect(dialog).toContainText('QR 한 장에 담은 나');
	await nextOf(dialog).click();
	await expect(dialog.getByRole('button', { name: '주요 기능 알려줘' })).toBeVisible();
	await expect(dialog.getByRole('button', { name: '조작법' })).toHaveCount(0);
	await expect(dialog.getByRole('button', { name: '링크 줘' })).toBeVisible();
});

test('dialogue: 숫자 판에 무엇의 숫자인지 늘 보이고, 선택지 커서를 옮기면 장면이 그 주제의 그림으로 바뀐다', async ({
	page,
}) => {
	const { safari, panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'dialogue' });
	// 장면과 숫자 판은 창이 넉넉할 때 보인다
	await safari.getByRole('button', { name: '전체 화면' }).click();
	const dialog = dialogOf(panel);

	// HUD: 값 옆의 설명이 화면에 보인다
	const stats = panel.getByRole('list', { name: '숫자' });
	await expect(stats.getByText('자정 전에 데려올 동물')).toBeVisible();
	await expect(stats.getByText('서버에서 다시 계산하는 랭킹')).toBeVisible();

	// 선택지: 커서를 옮기면 장면 액자의 그림이 바뀐다
	await nextOf(dialog).click();
	const preview = panel.locator('.dl-preview .dl-shot-frame img');
	await expect(preview).toBeVisible();
	const first = await preview.getAttribute('src');
	await dialog.getByRole('button', { name: '어떻게 만들었어?' }).hover();
	await expect(preview).not.toHaveAttribute('src', first ?? '');
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

test('dialogue: 배경은 프로젝트에 정한 테마를 따른다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'dialogue' });
	const scene = panel.locator('.dl');
	// 코드의 기본값: QRU는 사무실 (그림을 픽셀로 깔지 않는다)
	await expect(scene).toHaveAttribute('data-theme', 'office');
	await expect(scene.locator('.dl-pixel canvas')).toHaveCount(0);
});

test('dialogue: 배경 테마가 자동이면 대표 화면을 픽셀로 바꿔 하늘 자리에 깐다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'dialogue', override: { backdrop: null } });
	const scene = panel.locator('.dl');
	await expect(scene).toHaveAttribute('data-theme', 'auto');
	await expect(scene.locator('.dl-pixel canvas')).toHaveCount(1);
	await expect(scene).toHaveAttribute('data-pixel', '');
});

test('dialogue: 새 배경 테마(숲)를 고르면 그 장면을 깐다', async ({ page }) => {
	const { panel } = await openLook(page, {
		id: 'qru',
		tab: /QRU/,
		look: 'dialogue',
		override: { backdrop: { theme: 'forest' } },
	});
	const scene = panel.locator('.dl');
	await expect(scene).toHaveAttribute('data-theme', 'forest');
	await expect(scene.locator('.dl-ground')).toHaveCount(1);
	await expect(scene.locator('.dl-pixel canvas')).toHaveCount(0);
});

test('dialogue: 자동이면 바닥 타일 없이 픽셀 그림이 화면 전체를 덮는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'dialogue', override: { backdrop: null } });
	const scene = panel.locator('.dl');
	await expect(scene).toHaveAttribute('data-pixel', '');
	await expect(scene.locator('.dl-ground')).toHaveCount(0);
	await expect(scene.locator('.dl-pixel[data-full]')).toHaveCount(1);
});
