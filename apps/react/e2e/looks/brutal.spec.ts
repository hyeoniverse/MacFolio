// brutal 모양: 이름·흐르는 띠·12열 격자 블록. 움직임 줄이기 상태라 띠는 멈춰 있고 블록은 바로 보인다
import { test, expect } from '../fixtures';
import { openLook, scrollPanel } from './open';

// shared/profile.ts의 whattodo에서 시험이 확인하는 값 (프로젝트 자료가 바뀌면 여기도)
const whattodo = {
	name: 'WTD (What To Do)',
	tagline: '할 일은 끌어서. 루틴은 알아서.',
	url: 'https://github.com/Devcourse-WhatToDo/todo-front',
	facts: ['4명', '94개', '0단계'],
	highlights: ['할 일과 세부 할 일', '끌어서 순서 바꾸기', '완료한 일은 보관함으로', '루틴'],
	timeline: ['10.05', '10.10', '10.14', '10.15', '10.16', '10.17', '10.18', '10.19'],
	specs: 6,
	contributions: 8,
};

test('brutal: 이름이 h1, 격자 블록에 기능·숫자·진행 과정 표가 있고 GitHub 링크로 간다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'whattodo', tab: /WTD/ });
	const article = panel.getByRole('article', { name: whattodo.name });
	await expect(article.getByRole('heading', { level: 1 })).toHaveText(whattodo.name);
	await expect(article.locator('.br-tagline')).toHaveText(whattodo.tagline);

	// 흐르는 띠 둘은 보조 기술에서 숨기고(aria-hidden), 같은 글을 두 번 이어 붙였다
	const marquees = article.locator('.br-marquee');
	await expect(marquees).toHaveCount(2);
	await expect(marquees.first()).toHaveAttribute('aria-hidden', 'true');
	await expect(marquees.first().locator('.br-marquee-track > div')).toHaveCount(2);

	// 숫자는 띠와 별개로 '한눈에 보기' 구역에
	const facts = article.getByRole('region', { name: '한눈에 보기' });
	for (const value of whattodo.facts) await expect(facts).toContainText(value);

	// 주요 기능은 블록마다 [번호] FEATURE 라벨과 제목
	const features = article.getByRole('region', { name: '주요 기능' });
	await scrollPanel(panel, 900);
	for (const title of whattodo.highlights) {
		await expect(features.getByRole('heading', { level: 3, name: title })).toBeVisible();
	}
	await expect(features.locator('.br-tag').first()).toContainText('FEATURE');

	// 진행 과정은 표(날짜 열), 폴더 구조는 pre
	const timeline = article.getByRole('region', { name: '진행 과정' });
	const rows = timeline.getByRole('row');
	await expect(rows).toHaveCount(whattodo.timeline.length + 1);
	for (const date of whattodo.timeline) await expect(timeline.getByRole('table')).toContainText(date);
	await expect(timeline.locator('pre')).toContainText('src/');

	// 기술 사양 표와 맡은 일 체크
	await expect(article.getByRole('region', { name: '기술 사양' }).getByRole('row')).toHaveCount(whattodo.specs);
	await expect(article.getByRole('region', { name: '맡은 일' }).getByRole('listitem')).toHaveCount(
		whattodo.contributions
	);

	await expect(article.getByRole('link', { name: 'GitHub에서 보기' }).first()).toHaveAttribute('href', whattodo.url);
});

test('brutal: 진행 과정·쓰는 법·폴더 구조가 없는 프로젝트(qru)도 깨지지 않는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'brutal' });
	const article = panel.getByRole('article', { name: 'QRU 큐알유' });
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('QRU 큐알유');
	await expect(article.getByRole('region', { name: '주요 기능' })).toBeVisible();
	await expect(article.getByRole('region', { name: '기술 사양' })).toBeAttached();
	await expect(article.getByRole('region', { name: '진행 과정' })).toHaveCount(0);
	await expect(article.getByRole('link', { name: 'GitHub에서 보기' }).first()).toBeAttached();
});
