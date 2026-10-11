// 아케이드 모양(arcade): 캐비닛 화면, INSERT COIN, 캐릭터 선택 카드, 버튼 조작법, 어트랙트 모드 단추, 크레딧 롤
import { test, expect } from '../fixtures';
import { openLook } from './open';

test.describe('arcade 모양', () => {
	test('새싹 농장: 캐비닛·점수판·캐릭터 선택·조작법·갤러리 단추·크레딧', async ({ page }) => {
		// sproutfarm은 기본 모양이 arcade라 look을 덮어쓰지 않는다
		const { panel } = await openLook(page, { id: 'sproutfarm', tab: /SproutFarm/, look: 'arcade' });

		// 타이틀 화면: INSERT COIN, 네온 간판(이름), 캐비닛 안의 게임 장면
		await expect(panel.getByText('INSERT COIN')).toBeVisible();
		await expect(panel.getByRole('heading', { level: 1, name: 'SproutFarm 새싹 농장' })).toBeVisible();
		await expect(panel.getByRole('img', { name: 'SproutFarm 새싹 농장 장면' })).toHaveAttribute('src', /scene\.png$/);
		await expect(panel.getByRole('button', { name: '여기서 플레이' }).first()).toBeVisible();

		// HIGH SCORE 점수판은 facts (3줄)
		const board = panel.getByRole('region', { name: '한눈에' });
		await expect(board.getByText('HIGH SCORE')).toBeVisible();
		await expect(board.locator('.ac-scores li')).toHaveCount(3);
		await expect(board).toContainText('20마리');

		// 캐릭터 선택 카드 수 = highlights 수 (shared/profile.ts의 sproutfarm은 4개)
		const select = panel.getByRole('region', { name: '주요 기능' });
		await expect(select.locator('.ac-char')).toHaveCount(4);
		await expect(select.getByRole('heading', { name: '잡아서 울타리로' })).toBeVisible();

		// 조작법은 큰 버튼에 키 이름
		const controls = panel.getByRole('region', { name: '조작법' });
		await expect(controls.getByText('Shift')).toBeVisible();
		await expect(controls).toContainText('달리기');

		// 만든 방식은 STAGE 1-1 …
		const stages = panel.getByRole('region', { name: '만든 방식' });
		await expect(stages.locator('.ac-stage')).toHaveCount(4);
		await expect(stages.getByText('STAGE 1-1')).toBeVisible();

		// 어트랙트 모드: 움직임 줄이기라 저절로 넘어가지 않고, 단추로 넘긴다
		const gallery = panel.getByRole('region', { name: '화면 모음' });
		await gallery.scrollIntoViewIfNeeded();
		await expect(gallery.locator('.ac-attract-count')).toHaveText('1/8');
		await gallery.getByRole('button', { name: '다음 화면' }).click();
		await expect(gallery.locator('.ac-attract-count')).toHaveText('2/8');
		await expect(gallery.locator('.ac-attract-caption')).toContainText('오전 9시');
		await gallery.getByRole('button', { name: '이전 화면' }).click();
		await gallery.getByRole('button', { name: '이전 화면' }).click();
		await expect(gallery.locator('.ac-attract-count')).toHaveText('8/8');

		// 기술 사양
		await expect(panel.getByRole('region', { name: '기술 사양' })).toContainText('Vercel');

		// 크레딧 롤: 맡은 일과 빌려 쓴 에셋 (a 안에는 이름만)
		const credits = panel.getByRole('region', { name: '맡은 일' });
		await expect(credits).toContainText('Unity C# 스크립트 전체');
		const asset = credits.getByRole('link', { name: 'Sprout Lands Asset Pack', exact: true });
		await expect(asset).toHaveAttribute('href', 'https://cupnooble.itch.io/sprout-lands-asset-pack');
		await expect(credits).toContainText('THANK YOU FOR PLAYING');

		// 새싹 농장에서만 스프라이트 장식
		await expect(panel.locator('.ac-sprites')).toHaveCount(1);
	});

	test('다른 프로젝트(WTD)에 arcade를 입혀도 깨지지 않는다 (스프라이트·조작법·갤러리 없이)', async ({ page }) => {
		const { panel } = await openLook(page, { id: 'whattodo', tab: /WTD/, look: 'arcade' });
		await expect(panel.getByText('INSERT COIN')).toBeVisible();
		await expect(panel.getByRole('heading', { level: 1, name: 'WTD (What To Do)' })).toBeVisible();
		// 게임 장면이 없으니 캐비닛에는 화면 캡처
		await expect(panel.getByRole('img', { name: 'WTD (What To Do) 화면' })).toBeVisible();
		await expect(panel.getByRole('region', { name: '주요 기능' }).locator('.ac-char').first()).toBeVisible();
		await expect(panel.getByRole('region', { name: '조작법' })).toHaveCount(0);
		await expect(panel.getByRole('region', { name: '화면 모음' })).toHaveCount(0);
		await expect(panel.locator('.ac-sprites')).toHaveCount(0);
		await expect(panel.getByRole('region', { name: '맡은 일' })).toContainText('THANK YOU FOR PLAYING');
		await expect(panel.getByRole('link', { name: /GitHub에서 보기/ }).first()).toHaveAttribute('href', /github\.com/);
	});
});
