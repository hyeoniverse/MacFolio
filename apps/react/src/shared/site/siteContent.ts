// 사이트 콘텐츠 (서버의 GET /site): 관리자가 시스템 설정에서 고친 프로필과 프로젝트.
// 앱 목록(apps/manifest.ts), Safari 탭, 사진 앨범 같은 여러 모듈이 프로젝트 목록을 읽을 때 한 번 계산해 두므로,
// 그 모듈을 불러오기 **전에** 서버의 내용을 합친다 (main.tsx가 이것을 기다린 뒤에 앱을 불러온다).
// 배포한 사이트는 Worker가 HTML에 내용을 넣어 주므로(apps/react/worker) 기다리지 않는다. 로컬·시험은 API에 묻는다
import { readProfile, readProjects, mergeProjects, type SiteProjects } from '@macfolio/desktop-core/site';
import { env } from '@/shared/config/env';
import { DEFAULT_PROJECTS, PROJECTS } from '@/shared/profile';
import { setSiteProfile } from './profileStore';

/** Worker가 index.html에 넣는 <script type="application/json"> (실행되지 않는 데이터) */
export const SITE_CONTENT_ELEMENT_ID = 'site-content';

/** API에 물을 때 기다리는 한도. 넘으면 코드의 기본값으로 연다 */
const FETCH_TIMEOUT_MS = 2500;

let savedProjects: SiteProjects | null = null;

/** 서버에 저장된 프로젝트 내용 (숨긴 것까지). 시스템 설정 › 프로젝트가 고칠 때 바탕으로 쓴다 */
export const getSavedProjects = () => savedProjects;

/** 저장한 뒤: 다음에 시스템 설정을 열 때 바탕이 되도록 기억한다 (보이는 목록은 새로고침해야 바뀐다) */
export const setSavedProjects = (projects: SiteProjects | null) => {
	savedProjects = projects;
};

/** 받은 내용을 쓴다. 규칙에 맞지 않는 값은 버리고 기본값을 쓴다 (서버도 검사하지만 한 번 더) */
export function applySiteContent(body: unknown) {
	const content = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	setSiteProfile(readProfile(content.profile));
	savedProjects = readProjects(content.projects);
	PROJECTS.splice(0, PROJECTS.length, ...mergeProjects(DEFAULT_PROJECTS, savedProjects));
}

function readInjected(): unknown {
	const element = document.getElementById(SITE_CONTENT_ELEMENT_ID);
	if (!element?.textContent) return undefined;
	try {
		return JSON.parse(element.textContent) as unknown;
	} catch {
		return undefined;
	}
}

/** 앱 시작 때 한 번. 서버가 없거나 닿지 않으면 코드의 기본값 그대로 */
export async function loadSiteContent(fetchImpl: typeof fetch = fetch) {
	const injected = readInjected();
	if (injected !== undefined) return applySiteContent(injected);
	if (!env.apiUrl) return;
	try {
		const response = await fetchImpl(`${env.apiUrl}/site`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
		if (response.ok) applySiteContent(await response.json());
	} catch {
		// 기본값 그대로
	}
}

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

/** 관리자: 프로젝트 내용을 저장(PUT)하거나 지운다(DELETE: 코드의 기본값으로). 서버가 틀린 이유를 모두 돌려준다 */
export async function sendProjects(projects: SiteProjects | null): Promise<SaveResult> {
	try {
		const response = await fetch(`${env.apiUrl}/site/projects`, {
			method: projects ? 'PUT' : 'DELETE',
			credentials: 'include',
			...(projects ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projects) } : {}),
		});
		const body = (await response.json().catch(() => null)) as {
			projects?: unknown;
			message?: string | string[];
		} | null;
		if (!response.ok) {
			const message = body?.message;
			return {
				ok: false,
				errors: Array.isArray(message) ? message : [message ?? `저장하지 못했습니다 (${response.status}).`],
			};
		}
		setSavedProjects(readProjects(body?.projects));
		return { ok: true };
	} catch {
		return { ok: false, errors: ['서버에 연결하지 못했습니다.'] };
	}
}
