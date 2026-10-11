// 시네마 모양: 한 화면씩 고정되는 장면. 시험은 움직임 줄이기라 장면이 고정되지 않고 세로로 모두 보인다
import { test, expect } from '../fixtures';
import { openLook } from './open';

test('cinema: 제목이 글자마다 나타나고, 기능마다 한 장면, 숫자 장면, 시뮬레이터와 요청 경로, 어두운 표', async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'macfolio', tab: /MacFolio/ });
	const article = panel.getByRole('article', { name: 'MacFolio' });

	// 첫 장면: 제목은 글자마다 span으로 나눠도 읽히는 글은 그대로
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('포트폴리오를, 데스크톱으로.');
	expect(await article.locator('.cn-letter').count()).toBeGreaterThan(10);
	await expect(article.getByRole('img', { name: 'MacFolio 화면' })).toBeVisible();

	// 기능 장면: 기능마다 한 장면씩, 번호와 제목
	const features = article.getByRole('region', { name: '주요 기능' });
	await expect(features.locator('.cn-scene')).toHaveCount(4);
	for (const title of ['진짜 같은 데스크톱', '메모 앱이 곧 블로그', '가입 없이 남기는 글', '주소가 있는 화면']) {
		await expect(features.getByRole('heading', { level: 3, name: title })).toBeVisible();
	}
	await expect(features.locator('.cn-counter').last()).toHaveText('04/ 04');

	// 숫자 장면: 숫자가 하나씩 거대하게
	const numbers = article.getByRole('list', { name: '한눈에 보는 숫자' });
	await expect(numbers.getByRole('listitem')).toHaveCount(3);
	await expect(numbers).toContainText('0원');

	// 어디서 열어도 (MacFolio 전용 시뮬레이터): 앱을 고르면 두 화면이 함께 바뀌고, 크기 단계를 눌러 고른다
	const devices = article.getByRole('region', { name: '어디서 열어도' });
	await devices.scrollIntoViewIfNeeded();
	await expect(devices.getByRole('img', { name: '모니터에서 연 메모' })).toBeVisible();
	await devices.getByRole('button', { name: /메시지/ }).click();
	await expect(devices.getByRole('button', { name: /메시지/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(devices.getByRole('img', { name: '모니터에서 연 메시지' })).toBeVisible();
	await devices.getByRole('button', { name: /휴대폰/ }).click();
	await expect(devices.getByRole('button', { name: /휴대폰/ })).toHaveAttribute('aria-current', 'step');
	await expect(devices.getByRole('img', { name: '휴대폰에서 연 메시지' })).toBeVisible();
	await expect(devices.getByRole('img', { name: '모니터에서 연 메시지' })).toHaveCount(0);
	await expect(devices).toContainText('767px 이하에서는 iOS 홈 화면');

	// 만든 방식: 요청이 지나는 길 그림과 번호 붙은 글
	const build = article.getByRole('region', { name: '만든 방식' });
	await expect(build.getByRole('img', { name: /Cloudflare Tunnel/ })).toBeVisible();
	await expect(build.getByRole('heading', { level: 3 })).toHaveCount(4);

	// 어두운 평면 표: 맡은 일, 기술 사양, 링크
	await expect(article.getByRole('region', { name: '맡은 일' })).toContainText('NestJS API 서버와 DB 설계');
	await expect(article.getByRole('region', { name: '기술 사양' })).toContainText('NestJS');
	await expect(article.getByRole('link', { name: 'GitHub에서 보기' })).toHaveAttribute(
		'href',
		'https://github.com/hyeoniverse/MacFolio'
	);
	// MacFolio 전용 장면은 다른 구역을 밀어내지 않는다 (진행 과정은 데이터에 없으니 그리지 않는다)
	await expect(article.getByRole('region', { name: '진행 과정' })).toHaveCount(0);
});

test('cinema: 다른 프로젝트(QRU)에 씌워도 깨지지 않고, MacFolio 전용 장면은 없다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'cinema' });
	const article = panel.getByRole('article', { name: 'QRU 큐알유' });
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('QR 한 장에 담은 나.');
	const features = article.getByRole('region', { name: '주요 기능' });
	await expect(features).toBeVisible();
	await expect(features.locator('.cn-scene')).toHaveCount(5);
	await expect(article.getByRole('region', { name: '어디서 열어도' })).toHaveCount(0);
	await expect(article.getByRole('region', { name: '기술 사양' })).toBeVisible();
	await expect(article.getByRole('region', { name: '맡은 일' })).toBeVisible();
});
