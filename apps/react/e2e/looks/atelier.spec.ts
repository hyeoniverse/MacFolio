// 아틀리에 모양: 세리프 머리와 로고, 왼쪽 sticky 목차가 읽는 항목을 따라가는 주요 기능, 장·진행 과정 구역
import { test, expect } from '../fixtures';
import { openLook } from './open';

test('atelier: 로고와 이탤릭 tagline, 주요 기능 목차는 읽는 항목을 따라가고, 장과 진행 과정이 구역으로 있다', async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'newpick', tab: /NewPick/, look: 'atelier' });
	const article = panel.getByRole('article', { name: 'NewPick 뉴픽' });
	await expect(article).toBeVisible();
	// h1은 tagline, 로고 그림의 이름은 프로젝트 이름
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('아침 뉴스, 요약해서 한 통에.');
	await expect(article.getByRole('img', { name: 'NewPick 뉴픽', exact: true })).toBeVisible();

	// 주요 기능: 왼쪽 목차 항목 수 = highlights 수(6), 처음에는 첫 항목을 읽는 중
	const features = article.getByRole('region', { name: '주요 기능' });
	const index = features.getByRole('list', { name: '주요 기능 목록' }).getByRole('listitem');
	await expect(index).toHaveCount(6);
	await expect(index.first()).toHaveAttribute('aria-current', 'true');
	// 마지막 항목까지 내려가면 목차의 읽는 중이 마지막으로 옮겨 간다
	await features.locator('.at-hl-flow > li').last().scrollIntoViewIfNeeded();
	await expect(index.last()).toHaveAttribute('aria-current', 'true');
	await expect(index.first()).not.toHaveAttribute('aria-current', 'true');
	// 목차를 누르면 그 항목으로 간다
	await index.nth(1).getByRole('button').click();
	await expect(index.nth(1)).toHaveAttribute('aria-current', 'true');

	// 장은 제목이 이름인 구역, 진행 과정에는 날짜
	await expect(article.getByRole('region', { name: '로그인과 첫 화면' })).toBeVisible();
	await expect(article.getByRole('region', { name: '읽고 구독하기' })).toBeAttached();
	await expect(article.getByRole('region', { name: '진행 과정' })).toContainText('12.26');
	await expect(article.getByRole('region', { name: '맡은 일' })).toContainText('Google 로그인');
	// 마지막은 저장소로 가는 큰 링크
	await expect(article.getByRole('link', { name: /저장소 보기/ })).toHaveAttribute(
		'href',
		'https://github.com/Devcourse-NewPick/front'
	);
});

test('atelier: 다른 프로젝트(QRU)에 덮어써도 깨지지 않는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'atelier' });
	const article = panel.getByRole('article', { name: 'QRU 큐알유' });
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('QR 한 장에 담은 나.');
	await expect(article.getByRole('region', { name: '주요 기능' })).toBeVisible();
	await expect(article.getByRole('region', { name: '기술 사양' })).toBeAttached();
	await expect(article.getByRole('link', { name: /저장소 보기/ })).toBeAttached();
});
