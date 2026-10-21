// 이력서 Markdown (국문 ko, 영문 en). 관리자가 텍스트 편집기에서 고친 값(서버의 GET /site의 resume·resumeEn)이 있으면 그 값,
// 없으면 코드의 기본 이력서. Finder 문서·PDF·터미널 resume가 모두 여기를 읽는다: 컴포넌트는 useResume(), 그 밖은 getResume()
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import type { ResumeInput, SiteView } from '@macfolio/contracts';
import { api, type ApiOptions, reasonsFrom } from '@/shared/api/client';
import DEFAULT_RESUME from '@/shared/profile/resume.md?raw';
import DEFAULT_RESUME_EN from '@/shared/profile/resume.en.md?raw';

export { DEFAULT_RESUME, DEFAULT_RESUME_EN };

export type ResumeLang = 'ko' | 'en';

const DEFAULTS: Record<ResumeLang, string> = { ko: DEFAULT_RESUME, en: DEFAULT_RESUME_EN };
/** 서버 경로와 응답의 칸 */
const PATHS: Record<ResumeLang, string> = { ko: '/site/resume', en: '/site/resume/en' };
const FIELDS = { ko: 'resume', en: 'resumeEn' } as const;

interface ResumeState {
	markdown: string;
	/** 서버에 저장한 값을 쓰는 중인지 (기본값으로 되돌리기를 보여 줄지) */
	custom: boolean;
}

const stores = {
	ko: createStore<ResumeState>({ markdown: DEFAULT_RESUME, custom: false }),
	en: createStore<ResumeState>({ markdown: DEFAULT_RESUME_EN, custom: false }),
};

const apply = (lang: ResumeLang, resume: ResumeInput | null | undefined) =>
	stores[lang].setState({ markdown: resume?.markdown ?? DEFAULTS[lang], custom: Boolean(resume) });

/** 서버에 저장한 이력서를 쓴다 (앱 시작 때 shared/site/siteContent.ts가 부른다). null이면 기본 이력서 */
export const setSiteResume = (resume: ResumeInput | null, lang: ResumeLang = 'ko') => apply(lang, resume);

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

async function send(lang: ResumeLang, options: ApiOptions): Promise<SaveResult> {
	try {
		const body = await api<Partial<SiteView> | null>(PATHS[lang], { ...options, fallback: '저장하지 못했습니다.' });
		apply(lang, body?.[FIELDS[lang]] ?? null);
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: reasonsFrom(error) };
	}
}

/** 관리자: 이력서를 저장한다. 서버가 규칙을 어긴 이유를 돌려준다 */
export const saveResume = (markdown: string, lang: ResumeLang = 'ko') =>
	send(lang, { method: 'PUT', json: { markdown } });

/** 관리자: 저장한 이력서를 지우고 코드의 기본 이력서로 돌아간다 */
export const resetResume = (lang: ResumeLang = 'ko') => send(lang, { method: 'DELETE' });

export const getResume = (lang: ResumeLang = 'ko') => stores[lang].getState().markdown;

export function useResumeState(lang: ResumeLang = 'ko'): ResumeState {
	return useSyncExternalStore(stores[lang].subscribe, stores[lang].getState);
}

export const useResume = (lang: ResumeLang = 'ko') => useResumeState(lang).markdown;
