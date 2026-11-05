import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

const body = [
	'> [!NOTE]',
	'> 정규화는 의미로 판단한다.',
	'',
	'> [!WARNING] Heath의 정리',
	'> 역은 성립하지 않는다.',
	'',
	'```math',
	'\\sigma_{\\text{학과}=\\text{컴퓨터}}(\\text{학생})',
	'```',
	'',
	'인라인 `\\pi_{X}(R){:math}` 수식과 `SELECT * FROM ENROL{:sql}` 코드.',
].join('\n');

const post = (title: string) => {
	const content = { title, date: '2026-11-05', category: '기술 노트/Git', summary: '', body };
	return { slug: 'callout-math-post', ...content, deleted: false, published: content };
};

test('읽기 화면: 콜아웃은 제목 있는 상자로, ```math·{:math} 수식은 KaTeX로 그린다', async ({ page }) => {
	const api = await fakeApi(page);
	api.posts = [post('수식과 콜아웃')];
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await memo.locator('.memo-item', { hasText: '수식과 콜아웃' }).click();
	const article = memo.locator('.memo-markdown').first();

	const callouts = article.locator('aside.memo-callout');
	await expect(callouts).toHaveCount(2);
	await expect(callouts.first().locator('.memo-callout-title')).toHaveText('참고');
	await expect(callouts.last()).toHaveClass(/memo-callout-warning/);
	await expect(callouts.last().locator('.memo-callout-title')).toHaveText('Heath의 정리');
	await expect(article.getByText('[!NOTE]')).toHaveCount(0);

	// KaTeX는 이 글을 열 때 불러와 그린다 (블록 하나, 인라인 하나)
	await expect(article.locator('.memo-math-block .katex-display')).toHaveCount(1);
	await expect(article.locator('span.memo-math .katex')).toHaveCount(1);
	await expect(article).not.toContainText('{:math}');
	await expect(article.locator('code.language-sql .hljs-keyword').first()).toHaveText('SELECT');
});

test('편집 화면: [!NOTE] 인용 블록은 같은 콜아웃 색으로, 수식은 코드 그대로 보이고 저장도 그대로다', async ({
	page,
}) => {
	const api = await fakeApi(page, { signedIn: true });
	api.posts = [post('수식과 콜아웃')];
	await enterDesktop(page);
	await dockItem(page, 'memo').click();
	const memo = appWindow(page, 'memo');
	await memo.locator('.memo-item', { hasText: '수식과 콜아웃' }).click();
	const editor = memo.locator('.ProseMirror');
	await expect(editor.locator('blockquote.memo-callout-note')).toHaveCount(1);
	await expect(editor.locator('blockquote.memo-callout-warning')).toHaveCount(1);
	await expect(editor.locator('pre code')).toContainText('\\sigma_{');

	await editor.locator('p', { hasText: '인라인' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' 끝');
	await expect.poll(() => api.posts[0].body).toContain('코드. 끝');
	const saved = api.posts[0].body;
	expect(saved).toContain('> [!NOTE]\n> 정규화는 의미로 판단한다.');
	expect(saved).toContain('```math\n\\sigma_{\\text{학과}=\\text{컴퓨터}}(\\text{학생})\n```');
	expect(saved).toContain('`\\pi_{X}(R){:math}`');
});
