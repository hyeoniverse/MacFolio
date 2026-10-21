// 이력서 Markdown 한 장. 관리자가 Finder의 이력서 문서에서 고친 값(서버의 GET /site의 resume)이 있으면 그 값, 없으면 코드의 기본 이력서.
// Finder 문서·PDF·터미널 resume가 모두 여기를 읽는다: 컴포넌트는 useResume(), 그 밖은 getResume()
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import type { ResumeInput, SiteView } from '@macfolio/contracts';
import { api, type ApiOptions, reasonsFrom } from '@/shared/api/client';
import DEFAULT_RESUME from '@/shared/profile/resume.md?raw';

export { DEFAULT_RESUME };

interface ResumeState {
	markdown: string;
	/** 서버에 저장한 값을 쓰는 중인지 (기본값으로 되돌리기를 보여 줄지) */
	custom: boolean;
}

const resumeStore = createStore<ResumeState>({ markdown: DEFAULT_RESUME, custom: false });

const apply = (resume: ResumeInput | null | undefined) =>
	resumeStore.setState({ markdown: resume?.markdown ?? DEFAULT_RESUME, custom: Boolean(resume) });

/** 서버에 저장한 이력서를 쓴다 (앱 시작 때 shared/site/siteContent.ts가 부른다). null이면 기본 이력서 */
export const setSiteResume = (resume: ResumeInput | null) => apply(resume);

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

async function send(options: ApiOptions): Promise<SaveResult> {
	try {
		const body = await api<Partial<SiteView> | null>('/site/resume', { ...options, fallback: '저장하지 못했습니다.' });
		apply(body?.resume ?? null);
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: reasonsFrom(error) };
	}
}

/** 관리자: 이력서를 저장한다. 서버가 규칙을 어긴 이유를 돌려준다 */
export const saveResume = (markdown: string) => send({ method: 'PUT', json: { markdown } });

/** 관리자: 저장한 이력서를 지우고 코드의 기본 이력서로 돌아간다 */
export const resetResume = () => send({ method: 'DELETE' });

export const getResume = () => resumeStore.getState().markdown;

export function useResumeState(): ResumeState {
	return useSyncExternalStore(resumeStore.subscribe, resumeStore.getState);
}

export const useResume = () => useResumeState().markdown;
