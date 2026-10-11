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
