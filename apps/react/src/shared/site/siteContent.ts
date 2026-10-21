// 사이트 콘텐츠 (서버의 GET /site): 관리자가 시스템 설정에서 고친 프로필과 프로젝트.
// 앱 목록(apps/manifest.ts), Safari 탭, 사진 앨범 같은 여러 모듈이 프로젝트 목록을 읽을 때 한 번 계산해 두므로,
// 그 모듈을 불러오기 **전에** 서버의 내용을 합친다 (main.tsx가 이것을 기다린 뒤에 앱을 불러온다).
// 배포한 사이트는 Worker가 HTML에 내용을 넣어 주므로(apps/react/worker) 기다리지 않는다. 로컬·시험은 API에 묻는다
import { useSyncExternalStore } from 'react';
import { readProjects, mergeProjects, type SiteProjects } from '@macfolio/desktop-core/site';
import { readProfile, readResume, type SiteView } from '@macfolio/contracts';
import { api, reasonsFrom } from '@/shared/api/client';
import { env } from '@/shared/config/env';
import { DEFAULT_PROJECTS, PROJECTS } from '@/shared/profile';
import { setSiteProfile } from './profileStore';
import { setSiteResume } from './resumeStore';
import { completeProject } from './publicImages';

/** 올린 그림(/files/<id>)은 API 주소라, 로컬의 http 주소도 받는다 (서버와 같은 규칙) */
export const PARSE_OPTIONS = { allowOrigins: env.apiUrl ? [env.apiUrl] : [] };

/** Worker가 index.html에 넣는 <script type="application/json"> (실행되지 않는 데이터) */
export const SITE_CONTENT_ELEMENT_ID = 'site-content';

/** API에 물을 때 기다리는 한도. 넘으면 코드의 기본값으로 연다 */
const FETCH_TIMEOUT_MS = 2500;

let savedProjects: SiteProjects | null = null;

/** 프로젝트 목록이 바뀐 횟수. 저장하면 늘어나고, 목록을 그리는 화면(Safari·Finder)이 다시 그린다 */
let projectsVersion = 0;
const listeners = new Set<() => void>();
const subscribeProjects = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
const getProjectsVersion = () => projectsVersion;

/** 프로젝트 목록이 바뀌면 다시 그리게 한다 (PROJECTS 배열은 그대로 두고 안만 바꾸므로, 이 값으로 바뀐 것을 안다) */
export const useProjectsVersion = () => useSyncExternalStore(subscribeProjects, getProjectsVersion, getProjectsVersion);

/** 서버의 덮어쓸 값을 코드의 기본값과 합쳐 PROJECTS를 채운다 (배열은 그대로, 안만 바꾼다) */
function fillProjects(saved: SiteProjects | null) {
	PROJECTS.splice(
		0,
		PROJECTS.length,
		...mergeProjects(DEFAULT_PROJECTS, saved).map((project) => completeProject(project))
	);
}

/** 서버에 저장된 프로젝트 내용 (숨긴 것까지). 시스템 설정 › 프로젝트가 고칠 때 바탕으로 쓴다 */
export const getSavedProjects = () => savedProjects;

/**
 * 저장한 뒤: 기억해 두고 PROJECTS를 다시 채워 화면에 바로 적용한다.
 * 다만 앱 목록(Dock·Launchpad, apps/manifest.ts)과 사진 앨범은 시작할 때 한 번 정하므로 새로고침해야 바뀐다
 */
export const setSavedProjects = (projects: SiteProjects | null) => {
	savedProjects = projects;
	fillProjects(projects);
	projectsVersion += 1;
	for (const listener of listeners) listener();
};

/** 받은 내용을 쓴다. 규칙에 맞지 않는 값은 버리고 기본값을 쓴다 (서버도 검사하지만 한 번 더) */
export function applySiteContent(body: unknown) {
	const content = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	setSiteProfile(readProfile(content.profile));
	setSiteResume(readResume(content.resume));
	setSiteResume(readResume(content.resumeEn), 'en');
	savedProjects = readProjects(content.projects, PARSE_OPTIONS);
	fillProjects(savedProjects);
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
		applySiteContent(await api<SiteView>('/site', { fetchImpl, timeout: FETCH_TIMEOUT_MS }));
	} catch {
		// 서버가 없거나 읽지 못하면 기본값 그대로
	}
}

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

/** 관리자: 프로젝트 내용을 저장(PUT)하거나 지운다(DELETE: 코드의 기본값으로). 서버가 틀린 이유를 모두 돌려준다 */
export async function sendProjects(projects: SiteProjects | null): Promise<SaveResult> {
	try {
		const body = await api<Partial<SiteView> | null>('/site/projects', {
			...(projects ? { method: 'PUT', json: projects } : { method: 'DELETE' }),
			fallback: '저장하지 못했습니다.',
		});
		setSavedProjects(readProjects(body?.projects, PARSE_OPTIONS));
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: reasonsFrom(error) };
	}
}
