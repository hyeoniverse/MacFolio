// 사진이 없는 글의 공유 카드 그림 (1200×630 PNG). 글 제목으로 메모 앱 창 모양 카드를 그린다.
// - 저장소 글: 프론트엔드 빌드가 그려 dist/og/에 넣는다 (apps/react/vite.config.ts의 seoPlugin)
// - 서버에 쓴 글: API가 요청이 오면 그린다 (GET /posts/<글>/og.png)
// satori가 글자를 글꼴의 윤곽선으로 바꾼 SVG를 만들고, resvg가 PNG로 굽는다. 시스템 글꼴을 읽지 않아 어느 컴퓨터에서나 같다
import { renderAsync } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori, { type Font } from 'satori';

/** 카드에 쓰는 글의 값 */
export interface OgPost {
	title: string;
	/** YYYY-MM-DD */
	date: string;
	/** 폴더 경로 (개발기/MacFolio) */
	category: string;
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** 카드에 쓰는 글꼴: apps/react/public/fonts의 Pretendard (사이트 화면과 같은 글꼴, SIL OFL). satori는 woff2를 읽지 못해 woff를 쓴다 */
export interface OgFonts {
	regular: Buffer;
	bold: Buffer;
}

/** 카드를 그리는 데 드는 파일: 글꼴 둘과 메모 앱 아이콘(data: 주소) */
export interface OgAssets {
	fonts: OgFonts;
	icon: string;
}

/** 사이트의 public 폴더(apps/react/public)에서 글꼴과 아이콘을 읽는다 */
export async function loadOgAssets(publicDir: string): Promise<OgAssets> {
	const [regular, bold, icon] = await Promise.all([
		readFile(join(publicDir, 'fonts/Pretendard-Medium.woff')),
		readFile(join(publicDir, 'fonts/Pretendard-Bold.woff')),
		readFile(join(publicDir, 'imgs/memo.png')),
	]);
	return { fonts: { regular, bold }, icon: `data:image/png;base64,${icon.toString('base64')}` };
}

/** satori가 읽는 요소 (JSX 없이 쓴다) */
interface Node {
	type: string;
	props: { style?: Record<string, unknown>; children?: (Node | string)[] | Node | string; src?: string };
}
const h = (type: string, style: Record<string, unknown>, children?: Node['props']['children']): Node => ({
	type,
	props: { style, children },
});

const dot = (color: string) => h('div', { width: 22, height: 22, borderRadius: 11, background: color });

/** 메모 앱 창 하나: 신호등 단추, 폴더 경로, 제목(세 줄까지), 날짜와 사이트 이름 */
function card(post: OgPost, site: string, icon: string): Node {
	const folder = post.category.split('/').join(' › ');
	return h(
		'div',
		{
			width: OG_WIDTH,
			height: OG_HEIGHT,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			background: 'linear-gradient(135deg, #f6d365 0%, #fda085 45%, #a18cd1 100%)',
		},
		h(
			'div',
			{
				width: 1080,
				height: 510,
				display: 'flex',
				flexDirection: 'column',
				background: '#ffffff',
				borderRadius: 28,
				// 흐린 그림자(box-shadow)는 굽는 시간이 세 배라 쓰지 않는다
				border: '2px solid rgba(255, 255, 255, 0.6)',
				overflow: 'hidden',
			},
			[
				h(
					'div',
					{ display: 'flex', alignItems: 'center', gap: 14, height: 72, padding: '0 32px', background: '#f5f5f7' },
					[
						dot('#ff5f57'),
						dot('#febc2e'),
						dot('#28c840'),
						h('div', { marginLeft: 20, fontSize: 26, color: '#86868b' }, folder),
					]
				),
				h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '44px 64px 40px' }, [
					h(
						'div',
						{
							display: 'block',
							fontSize: 64,
							fontWeight: 700,
							lineHeight: 1.3,
							color: '#1d1d1f',
							lineClamp: 3,
							wordBreak: 'keep-all',
						},
						post.title
					),
					h('div', { display: 'flex', alignItems: 'center', marginTop: 'auto', fontSize: 28, color: '#86868b' }, [
						h('div', { display: 'flex' }, post.date.replace(/-/g, '. ')),
						h('div', { display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto', color: '#1d1d1f' }, [
							{
								type: 'img',
								props: { src: icon, style: { width: 48, height: 48, borderRadius: 11, border: '1px solid #d2d2d7' } },
							},
							h('div', { display: 'flex' }, site),
						]),
					]),
				]),
			]
		)
	);
}

// satori는 같은 글꼴 목록(같은 배열)이면 읽어 둔 글꼴을 다시 쓴다. 3.8MB짜리를 글마다 다시 읽지 않게 묶어 둔다
const fontLists = new WeakMap<OgFonts, Font[]>();
const fontListOf = (fonts: OgFonts) => {
	let list = fontLists.get(fonts);
	if (!list) {
		list = [
			{ name: 'Pretendard', data: fonts.regular, weight: 400, style: 'normal' },
			{ name: 'Pretendard', data: fonts.bold, weight: 700, style: 'normal' },
		];
		fontLists.set(fonts, list);
	}
	return list;
};

/** 글 하나의 카드 PNG. site는 카드 오른쪽 아래의 사이트 이름 */
export async function ogImagePng(post: OgPost, { site, icon, fonts }: OgAssets & { site: string }): Promise<Buffer> {
	const svg = await satori(card(post, site, icon) as Parameters<typeof satori>[0], {
		width: OG_WIDTH,
		height: OG_HEIGHT,
		fonts: fontListOf(fonts),
	});
	// renderAsync는 libuv 스레드에서 굽는다. 여러 글을 한꺼번에 부르면 나란히 돈다
	return (await renderAsync(svg)).asPng();
}
