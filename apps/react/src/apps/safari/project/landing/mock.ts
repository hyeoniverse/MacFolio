// 랜딩 키트의 순수 도우미: 가짜 화면(MockScreen)의 종류 고르기, 그래프 모양, 이름 줄이기, 숫자 읽기
import type { Project, ProjectPoint } from '@/shared/profile';

export const MOCK_KINDS = ['dashboard', 'list', 'chat', 'editor', 'mobile', 'game'] as const;
export type MockKind = (typeof MOCK_KINDS)[number];

const has = (words: readonly string[], pattern: RegExp) => words.some((word) => pattern.test(word));

const GAME = /unity|phaser|godot|pixi|three\.?js|babylon|unreal|cocos|love2d|pygame|bevy|game|게임/i;
const MOBILE = /react native|expo|swift|swiftui|kotlin|flutter|android|ios|capacitor|ionic|jetpack/i;
const CHAT = /chat|채팅|챗|메신저|messenger|socket|llm|openai|gpt|claude|gemini|assistant|도우미|협업/i;
const EDITOR =
	/milkdown|tiptap|prosemirror|lexical|quill|monaco|codemirror|slate|yjs|editor|에디터|메모|노트|문서|markdown|canvas|포스터/i;
const LIST = /todo|할 일|습관|task|체크|inbox|메일|mail|레터|letter|일정|calendar|kanban|issue|예약/i;

/**
 * 프로젝트에 어울리는 가짜 화면 종류. 모양(look)과 조작법·플레이 여부가 먼저, 그다음 기술(stack)과 이름·소개의 낱말로 고른다.
 * 게임 → 도우미 모양은 chat → mobile(앱 기술) → 할 일·메일 모양은 list → editor → chat → list → 나머지는 dashboard
 */
export function pickMockKind(project: Project): MockKind {
	const stack = project.stack ?? [];
	const words = [project.name, project.description ?? '', project.tagline ?? ''];
	if (project.look === 'arcade' || project.look === 'dialogue' || project.app?.play || project.controls?.length)
		return 'game';
	if (has(stack, GAME)) return 'game';
	if (project.look === 'assistant') return 'chat';
	if (project.look === 'phone' || has(stack, MOBILE)) return 'mobile';
	if (project.look === 'checklist' || project.look === 'inbox') return 'list';
	if (has(stack, EDITOR) || has([project.name], EDITOR)) return 'editor';
	if (has(stack, CHAT) || has([project.name], CHAT)) return 'chat';
	if (has(words, LIST)) return 'list';
	return 'dashboard';
}

/** FeatureVisual의 변형: 항목 차례대로 돌려 쓴다 */
export const FEATURE_VARIANTS = ['toast', 'window', 'orbit', 'meter'] as const;
export type FeatureVariant = (typeof FEATURE_VARIANTS)[number];

/** 글을 정수로 (같은 글이면 늘 같은 값). 그래프 모양·변형 고르기에 쓴다 */
export function hashString(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/**
 * 그래프 한 줄: 0~1 사이 값 n개. 씨앗(글)이 같으면 늘 같은 모양이고, 들쭉날쭉하면서 오른쪽으로 갈수록 오른다
 * (끝 값이 가장 높은 쪽에 가깝다: 제품 화면의 "성장" 그래프처럼)
 */
export function mockSeries(seed: string, n = 12): number[] {
	let state = hashString(seed) || 1;
	const next = () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return ((state >>> 0) % 1000) / 1000;
	};
	return Array.from({ length: n }, (_, i) => {
		const trend = n === 1 ? 1 : i / (n - 1);
		const value = 0.18 + trend * 0.62 + (next() - 0.5) * 0.28;
		return Math.round(Math.min(1, Math.max(0.06, value)) * 1000) / 1000;
	});
}

/** 0~1 값들을 SVG 꺾은선 경로로 (가로 w, 세로 h). area면 바닥까지 닫은 면 */
export function seriesPath(values: number[], w: number, h: number, area = false): string {
	if (values.length === 0) return '';
	const step = values.length === 1 ? 0 : w / (values.length - 1);
	const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - v * h).toFixed(1)}`);
	const line = `M${points.join(' L')}`;
	return area ? `${line} L${w},${h} L0,${h} Z` : line;
}

/** "1,800명", "92%", "4.8점" → 1800, 92, 4.8 (숫자가 없으면 null) */
export function parseFactNumber(text: string): number | null {
	const match = /-?\d[\d,]*(?:\.\d+)?/.exec(text);
	if (!match) return null;
	const value = Number(match[0].replace(/,/g, ''));
	return Number.isFinite(value) ? value : null;
}

/** "북클럽 – 독서 모임 플랫폼" → "북클럽" (앱 상단 바에 들어갈 짧은 이름. 앱 이름이 있으면 그것) */
export function shortName(project: Pick<Project, 'name' | 'app'>): string {
	if (project.app?.label) return project.app.label;
	return project.name.split(/\s+[–—|:-]\s+/)[0].trim() || project.name;
}

/** 이름의 첫 글자 (아이콘이 없을 때 타일에) */
export const initialOf = (name: string) => Array.from(name.trim())[0]?.toUpperCase() ?? '•';

/** 항목에 아이콘이 없을 때 차례로 돌려 쓸 Font Awesome 아이콘 */
const FALLBACK_ICONS = [
	'fa-bolt',
	'fa-layer-group',
	'fa-wand-magic-sparkles',
	'fa-shield-halved',
	'fa-chart-line',
	'fa-cube',
	'fa-compass',
	'fa-gauge-high',
];

export const iconOf = (point: Pick<ProjectPoint, 'icon'> | undefined, index: number) =>
	point?.icon || FALLBACK_ICONS[((index % FALLBACK_ICONS.length) + FALLBACK_ICONS.length) % FALLBACK_ICONS.length];

/** 가짜 화면에 올릴 항목들: 주요 기능 → 쓰는 법 → 만든 방식 순 (제목이 빈 것은 뺀다) */
export const mockPoints = (project: Project): ProjectPoint[] =>
	[...(project.highlights ?? []), ...(project.usage ?? []), ...(project.build ?? [])].filter((point) =>
		point.title?.trim()
	);

/** "src/\n├── app/\n│   └── main.ts" 같은 폴더 트리 → [{ name, depth }] (그림 글자를 걷어 낸다) */
export function parseTree(structure: string | undefined): { name: string; depth: number }[] {
	if (!structure) return [];
	return structure
		.split('\n')
		.map((line) => {
			const match = /^([\s│|├└─`\\-]*)(.*)$/.exec(line.replace(/\t/g, '    '));
			const lead = match?.[1] ?? '';
			const name = (match?.[2] ?? '').replace(/\s+#.*$/, '').trim();
			return { name, depth: Math.floor(lead.length / 4) };
		})
		.filter((row) => row.name);
}
