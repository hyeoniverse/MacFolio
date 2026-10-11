import { test, expect } from '../fixtures';
import { openLook } from './open';

// checklist 모양: 페이지가 할 일 앱이다. 항목을 체크하면 완료로 세어지고 설명이 펼쳐진다
test('checklist: 항목을 체크하면 진행이 오르고 설명이 펼쳐진다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'whattodo', tab: /WTD/, look: 'checklist' });
	const article = panel.getByRole('article', { name: 'WTD (What To Do)' });
	await expect(article).toBeVisible();

	// 처음엔 0 완료
	const ring = article.getByRole('progressbar');
	await expect(ring).toHaveAttribute('aria-valuenow', '0');
	await expect(article.getByText(/^0 \/ \d+ 완료$/)).toBeVisible();
	const total = Number(await ring.getAttribute('aria-valuemax'));
	expect(total).toBeGreaterThan(0);

	// '주요 기능'의 첫 항목을 체크
	const features = article.getByRole('region', { name: '주요 기능' });
	const first = features.getByRole('checkbox', { name: '할 일과 세부 할 일' });
	await expect(first).not.toBeChecked();
	await expect(first).toHaveAttribute('aria-expanded', 'false');
	await first.click();
	await expect(first).toBeChecked();
	await expect(first).toHaveAttribute('aria-expanded', 'true');
	await expect(ring).toHaveAttribute('aria-valuenow', '1');
	await expect(article.getByText(`1 / ${total} 완료`)).toBeVisible();
	await expect(features.getByText(/세부 할 일\(SubTask\)을 두고/)).toBeVisible();
	await expect(features.getByText('1/4')).toBeVisible();

	// 다시 누르면 해제
	await first.click();
	await expect(first).not.toBeChecked();
	await expect(ring).toHaveAttribute('aria-valuenow', '0');

	// 이미 끝낸 일(맡은 일, 진행 과정)은 체크된 채로 시작한다
	const mine = article.getByRole('region', { name: '맡은 일' });
	await expect(mine.getByRole('checkbox', { name: '프로젝트 뼈대와 화면 구성, 라우터' })).toBeChecked();
	await expect(article.getByRole('region', { name: '진행 과정' }).getByRole('checkbox').first()).toBeChecked();

	// 정렬 토글은 눌러도 깨지지 않는다
	await article.getByRole('button', { name: '우선순위' }).click();
	await expect(features).toBeVisible();
});

test('checklist: 데이터가 다른 프로젝트(qru)도 깨지지 않는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'checklist' });
	const article = panel.getByRole('article', { name: /QRU/ });
	await expect(article).toBeVisible();
	await expect(article.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
	await expect(article.getByRole('region', { name: '주요 기능' })).toBeVisible();
	await expect(article.getByRole('region', { name: '맡은 일' })).toBeVisible();
});
