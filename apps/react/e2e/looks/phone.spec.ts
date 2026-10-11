import { test, expect } from '../fixtures';
import { openLook } from './open';

// 폰 모양: 오른쪽 고정된 폰 안의 화면이 왼쪽 이야기 단계를 따라 바뀐다
test('phone: 이야기 단계를 지나면 폰 화면이 그 단계의 그림으로 바뀐다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'phone' });

	await expect(panel.getByRole('heading', { level: 1 })).toHaveText('QR 한 장에 담은 나.');
	await expect(panel.getByRole('link', { name: /GitHub에서 보기/ })).toBeVisible();

	// 이야기 목록은 주요 기능 하나가 한 단계 (profile.ts의 qru highlights 5개)
	const story = panel.getByRole('list', { name: '이야기' });
	const steps = story.getByRole('listitem');
	await expect(steps).toHaveCount(5);

	// 처음엔 소개 단계(0)의 그림
	const screen = panel.locator('[aria-label^="폰 화면:"]');
	await expect(screen).toHaveAttribute('data-step', '0');
	await expect(screen).toHaveAttribute('aria-label', '폰 화면: QRU 큐알유');

	// 마지막 단계를 가운데로 올리면 폰 화면이 그 단계의 그림으로
	const last = steps.last();
	const lastIndex = await last.getAttribute('data-step');
	await last.evaluate((el) => el.scrollIntoView({ block: 'center' }));
	await expect(screen).toHaveAttribute('data-step', lastIndex!);
	await expect(screen).toHaveAttribute('aria-label', '폰 화면: 내 명함 관리');
	await expect(screen).toHaveAttribute('src', /mypage/);
	await expect(last).toHaveClass(/ph-active/);

	// 숫자 뱃지와 기술 사양, 저장소 주소 카드
	await expect(panel.getByRole('list', { name: '한눈에' }).getByRole('listitem')).toHaveCount(3);
	const specs = panel.getByRole('region', { name: '기술 사양' });
	await specs.evaluate((el) => el.scrollIntoView({ block: 'center' }));
	await expect(specs).toHaveClass(/ph-active/);
	await expect(specs.getByText('qrcode.react')).toBeVisible();
	await expect(panel.getByRole('link', { name: 'github.com/hyeoniverse/QRU' })).toBeVisible();
});

// 그림이 없는 단계도 깨지지 않는다 (whattodo의 주요 기능은 그림이 없어 화면 모음에서 돌려 받는다)
test('phone: 다른 프로젝트에 입혀도 그려진다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'whattodo', tab: /WTD/, look: 'phone' });

	await expect(panel.getByRole('heading', { level: 1 })).toHaveText('할 일은 끌어서. 루틴은 알아서.');
	const steps = panel.getByRole('list', { name: '이야기' }).getByRole('listitem');
	await expect(steps).toHaveCount(4);
	const screen = panel.locator('[aria-label^="폰 화면:"]');
	await expect(screen).toHaveAttribute('data-step', '0');
	await steps.last().evaluate((el) => el.scrollIntoView({ block: 'center' }));
	await expect(screen).toHaveAttribute('aria-label', '폰 화면: 루틴');
	await expect(panel.getByRole('region', { name: '기술 사양' })).toBeVisible();
});
