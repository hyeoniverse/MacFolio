// 설정 도우미 모양(assistant): 단계 목록·계속/뒤로로 한 화면씩 넘기고, 주요 기능은 왼쪽에서 골라 오른쪽에 설명이 뜬다
import { test, expect } from '../fixtures';
import { openLook } from './open';

test('assistant: 단계를 계속·뒤로로 넘기고, 주요 기능을 고르고, 완료에 닿는다 (MacFolio)', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'macfolio', tab: /MacFolio/, look: 'assistant' });
	const steps = panel.getByRole('navigation', { name: '단계' });
	const current = steps.locator('[aria-current="step"]');
	const next = panel.getByRole('button', { name: '계속' });
	const back = panel.getByRole('button', { name: '뒤로' });

	// 환영 화면에서 시작한다. 뒤로는 눌리지 않는다
	await expect(current).toHaveText('환영');
	await expect(panel.getByRole('region', { name: '환영' }).getByText('환영합니다')).toBeVisible();
	await expect(back).toBeDisabled();

	// 계속 → 한눈에 보기 (숫자 카드)
	await next.click();
	await expect(current).toHaveText('한눈에 보기');
	await expect(panel.getByRole('region', { name: '한눈에 보기' }).getByText('서버 운영비')).toBeVisible();

	// 계속 → 주요 기능: 목록의 두 번째를 고르면 오른쪽 제목이 바뀐다
	await next.click();
	await expect(current).toHaveText('주요 기능');
	const pick = panel.getByRole('list', { name: '기능 목록' }).getByRole('button');
	await expect(pick.first()).toHaveAttribute('aria-pressed', 'true');
	await pick.nth(1).click();
	await expect(pick.nth(1)).toHaveAttribute('aria-pressed', 'true');
	await expect(panel.getByRole('region', { name: '주요 기능' }).getByRole('heading', { level: 3 })).toHaveText(
		'메모 앱이 곧 블로그'
	);

	// 계속 → 어디서 열어도: MacFolio의 화면 크기 시뮬레이터가 들어 있다
	await next.click();
	await expect(current).toHaveText('어디서 열어도');
	await expect(panel.getByRole('img', { name: '모니터에서 연 메모' })).toBeVisible();

	// 뒤로 → 주요 기능으로 돌아간다
	await back.click();
	await expect(current).toHaveText('주요 기능');

	// 단계 목록에서 바로 완료로: 체크 표시와 GitHub 링크
	await steps.getByRole('button', { name: '완료' }).click();
	await expect(current).toHaveText('완료');
	await expect(panel.getByText('설정이 끝났습니다')).toBeVisible();
	await expect(
		panel.getByRole('region', { name: '완료' }).getByRole('link', { name: /GitHub에서 보기/ })
	).toBeVisible();
	await expect(next).toHaveCount(0);
	await expect(panel.getByRole('button', { name: '처음으로' })).toBeVisible();
});

test('assistant: 다른 프로젝트(QRU)도 있는 단계만으로 끝까지 넘어간다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'assistant' });
	const current = panel.getByRole('navigation', { name: '단계' }).locator('[aria-current="step"]');
	const next = panel.getByRole('button', { name: '계속' });

	await expect(current).toHaveText('환영');
	// MacFolio 전용 단계는 없다
	await expect(
		panel.getByRole('navigation', { name: '단계' }).getByRole('button', { name: '어디서 열어도' })
	).toHaveCount(0);

	// 계속을 끝까지 누르면 완료에 닿는다
	for (let i = 0; i < 12 && (await next.count()) > 0; i++) await next.click();
	await expect(current).toHaveText('완료');
	await expect(panel.getByRole('link', { name: /GitHub에서 보기/ })).toBeVisible();
});
