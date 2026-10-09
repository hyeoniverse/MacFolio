import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import { fakeApi, type FakePost } from './fakeApi';

// 메모 글은 관리자가 쓰지만, 글이 서버에 저장되는 이상 서버나 계정이 뚫리면 바깥 내용과 같다.
// 글에 넣은 위험한 링크·HTML이 스크립트가 되지 않는 것을 고정한다 (README는 src/apps/github/readmeSafety.test.ts)
const ATTACKS = [
	'[자바스크립트 링크](javascript:alert(1))',
	'[대문자 섞은 링크](JaVaScRiPt:alert(1))',
	'[데이터 링크](data:text/html,<script>alert(1)</script>)',
	'<script>window.__pwned = true</script>',
	'<img src="x" onerror="window.__pwned = true">',
	'<a href="javascript:alert(1)">HTML 링크</a>',
	'<iframe src="https://evil.example"></iframe>',
	'[안전한 링크](https://example.com/a)',
].join('\n\n');

const post = (): FakePost => {
	const content = { title: '위험한 본문', date: '2026-10-09', category: '개발기/MacFolio', summary: '', body: ATTACKS };
	return { slug: 'unsafe-body', ...content, deleted: false, published: content };
};

test('메모 글의 위험한 링크·HTML은 스크립트가 되지 않는다', async ({ page }) => {
	const api = await fakeApi(page, { signedIn: false });
	api.posts = [post()];
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await memo.locator('.memo-item', { hasText: '위험한 본문' }).click();
	const body = memo.locator('.memo-markdown');
	await expect(body.getByRole('link', { name: '안전한 링크' })).toHaveAttribute('href', 'https://example.com/a');

	const found = await body.evaluate((root) => ({
		scripts: root.querySelectorAll('script, iframe').length,
		handlers: [...root.querySelectorAll('*')].filter((el) => [...el.attributes].some((a) => a.name.startsWith('on')))
			.length,
		badLinks: [...root.querySelectorAll('[href], [src]')]
			.map((el) => el.getAttribute('href') ?? el.getAttribute('src') ?? '')
			.filter((url) => /^\s*(javascript|vbscript|data):/i.test(url)),
	}));
	expect(found).toEqual({ scripts: 0, handlers: 0, badLinks: [] });
	expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
});
