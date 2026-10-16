// AI 커버 데모의 규칙: 받을 제목과 스타일, 공급자 차례, 그릴 말. 바깥 호출 없이 시험할 수 있게 여기에 모은다.
import { type CoverInput as CoverRequest, CoverInput, type CoverStyle, parse } from '@macfolio/contracts';
import { demoInput } from '../common/demo.js';

export { COVER_PROVIDERS, type CoverProvider, type CoverStyle, MAX_COVER_CHARS } from '@macfolio/contracts';
export type { CoverRequest };

/** HYEONIVERSE 커버 선택창의 스타일 열 가지와 같은 말 */
export const COVER_STYLES: Record<CoverStyle, string> = {
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
};

/** 몸통을 검사해 요청으로 바꾼다. 모르는 스타일은 abstract (HYEONIVERSE 기본) */
export const parseCoverRequest = (body: unknown): CoverRequest => demoInput(parse(CoverInput, body));

/** HYEONIVERSE와 같은 프롬프트: 넓은 가로 그림, 글자 없이 */
export const coverPrompt = ({ title, style }: Pick<CoverRequest, 'title' | 'style'>) =>
	`Blog cover image: ${title}. Style: ${COVER_STYLES[style]}. Wide landscape format, no text.`;
