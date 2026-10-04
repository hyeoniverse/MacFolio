// AI 커버 데모의 규칙: 받을 제목과 스타일, 공급자 차례, 그릴 말. 바깥 호출 없이 시험할 수 있게 여기에 모은다.
import { demoText, pickProviders } from '../common/demo.js';

/** 공급자 차례 (HYEONIVERSE의 AI 커버와 같다): NanoBanana(Gemini) → 실패하면 Hugging Face FLUX */
export const COVER_PROVIDERS = ['nanobanana', 'huggingface'] as const;
export type CoverProvider = (typeof COVER_PROVIDERS)[number];

/** 제목 글자 수 상한 */
export const MAX_COVER_CHARS = 60;

/** HYEONIVERSE 커버 선택창의 스타일 열 가지와 같은 말 */
export const COVER_STYLES = {
	abstract: 'abstract art style, flowing shapes and colors',
	minimal: 'minimalist design, clean lines, simple composition',
	geometric: 'geometric patterns, bold shapes, modern design',
	photographic: 'high quality photograph, cinematic lighting',
	illustration: 'digital illustration, hand-drawn feel, vibrant colors',
	watercolor: 'soft watercolor painting, gentle color bleeding, artistic texture',
	cyberpunk: 'cyberpunk neon glow, dark futuristic atmosphere, high contrast',
	vintage: 'vintage retro aesthetic, muted warm tones, film grain texture',
	'3d-render': '3D rendered scene, soft lighting, glossy materials, depth of field',
	'flat-design': 'flat design, bold solid colors, no shadows, vector art style',
} as const;
export type CoverStyle = keyof typeof COVER_STYLES;

export interface CoverRequest {
	title: string;
	style: CoverStyle;
	/** 막아 둔 공급자: 대체 순서를 보여 주려고 화면에서 고른다 */
	skip: CoverProvider[];
}

/** 몸통을 검사해 요청으로 바꾼다. 모르는 스타일은 abstract (HYEONIVERSE 기본) */
export function parseCoverRequest(body: unknown): CoverRequest {
	const input = (body ?? {}) as Record<string, unknown>;
	const title = demoText(input.title, {
		max: MAX_COVER_CHARS,
		empty: '커버로 그릴 제목을 써 주세요.',
		refused: '이 제목으로는 그려 드릴 수 없습니다.',
	});
	const style =
		typeof input.style === 'string' && Object.hasOwn(COVER_STYLES, input.style)
			? (input.style as CoverStyle)
			: 'abstract';
	return { title, style, skip: pickProviders(COVER_PROVIDERS, input.skip) };
}

/** HYEONIVERSE와 같은 프롬프트: 넓은 가로 그림, 글자 없이 */
export const coverPrompt = ({ title, style }: Pick<CoverRequest, 'title' | 'style'>) =>
	`Blog cover image: ${title}. Style: ${COVER_STYLES[style]}. Wide landscape format, no text.`;
