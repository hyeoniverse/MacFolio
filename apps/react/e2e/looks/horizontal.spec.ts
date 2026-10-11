import { test, expect } from '../fixtures';
import { openLook } from './open';

// 움직임 줄이기 상태라 가로 트랙이 풀려 패널이 세로로 쌓인다. 단추·번호·구역은 두 모드가 같다
test('horizontal: 패널 번호와 다음 단추, 주요 기능·진행 과정 구역, 끝 패널의 링크', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'newpick', tab: /NewPick/, look: 'horizontal' });
	const article = panel.getByRole('article', { name: 'NewPick 뉴픽' });
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('NewPick 뉴픽');

	// 진행 표시 '01 / N'의 N은 실제 패널 수
	const count = article.locator('.hz-count');
	await expect(count).toHaveText(/^01 \/ \d\d$/);
	const total = Number((await count.textContent())!.split('/')[1]);
	await expect(article.locator('[data-panel]')).toHaveCount(total);

	// 다음 단추를 누르면 둘째 패널(숫자)로 가고 번호가 02
	await article.getByRole('button', { name: '다음' }).click();
	await expect(count).toHaveText(`02 / ${String(total).padStart(2, '0')}`);
	await expect(article.getByRole('region', { name: '한눈에 보는 숫자' })).toContainText('6주');

	// 주요 기능 묶음에 첫 기능 제목, 진행 과정에 날짜, 끝 패널에 저장소 링크
	const features = article.getByRole('region', { name: '주요 기능' });
	await expect(features.getByRole('heading', { level: 2 }).first()).toHaveText('AI 뉴스 요약');
	await expect(article.getByRole('region', { name: '진행 과정' }).locator('time').first()).toHaveText('12.26');
	await article.getByRole('button', { name: '이전' }).click();
	await expect(count).toHaveText(/^01 \//);
	await expect(
		article.getByRole('region', { name: '마무리' }).getByRole('link', { name: 'GitHub에서 보기' })
	).toHaveAttribute('href', 'https://github.com/Devcourse-NewPick/front');
});

test('horizontal: 다른 프로젝트(WTD)로 골라도 같은 짜임으로 선다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'whattodo', tab: /WTD/, look: 'horizontal' });
	const article = panel.getByRole('article', { name: 'WTD (What To Do)' });
	await expect(article.locator('.hz-count')).toHaveText(/^01 \//);
	await expect(
		article.getByRole('region', { name: '주요 기능' }).getByRole('heading', { level: 2 }).first()
	).toHaveText('할 일과 세부 할 일');
	await expect(article.getByRole('region', { name: '맡은 일' })).toBeVisible();
});
