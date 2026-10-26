import type { FakePost } from './fakeApi';

/** 긴 문단 (띄운 이미지 옆으로 흐르는지 보려면 이미지보다 길어야 한다) */
const LONG = Array.from({ length: 6 }, (_, i) => `띄운 이미지 옆으로 흐르는 문단 ${i + 1}. `.repeat(6)).join('\n\n');

/** 목차·이미지 배치 시험용 서버 글: 제목 넷, 정렬 둘, 띄우기 둘 */
export const LAYOUT_POST_TITLE = '이미지 배치 시험 글';
export function layoutPost(): FakePost {
	// 정렬은 본문 폭보다 좁은 그림에서만 차이가 난다: 256px 그림 (public 폴더)
	const small = '/imgs/projects/sproutfarm/scene.png';
	const img = './images/weather-app-phone.jpg';
	const body = [
		'## 정렬',
		'첫 문단.',
		`![왼쪽 그림](${small}#left)`,
		`![오른쪽 그림](${small}#right)`,
		'## 왼쪽에 띄우기',
		`![왼쪽에 띄운 그림](${img}#float-left '왼쪽에 띄운 캡션')`,
		LONG,
		'## 오른쪽에 띄우기',
		`![오른쪽에 띄운 그림](${img}#float-right)`,
		LONG,
		'### 마지막 소제목',
		'끝 문단.',
	].join('\n\n');
	const content = { title: LAYOUT_POST_TITLE, date: '2026-10-27', category: '개발기/MacFolio', summary: '', body };
	return { slug: 'layout-test', ...content, deleted: false, published: content };
}
