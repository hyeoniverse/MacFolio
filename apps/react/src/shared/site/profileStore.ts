// 사이트 주인의 프로필. 관리자가 시스템 설정 › 정보에서 고친 값(서버의 GET /site)이 있으면 그 값, 없으면 코드의 기본값.
// 프로필을 읽는 곳은 모두 여기를 거친다: 컴포넌트는 useProfile(), 그 밖(메일 보내기 등)은 getProfile()
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import { githubLogin, type SiteProfile } from '@macfolio/desktop-core/site';
import { api, type ApiOptions, reasonsFrom } from '@/shared/api/client';
import { PROFILE, SITE_STACK, SKILLS } from '@/shared/profile';

export { githubLogin, type SiteProfile };

/** 코드의 기본값 (서버에 저장한 값이 없거나 서버가 없을 때) */
export const DEFAULT_PROFILE: SiteProfile = {
	...PROFILE,
	skills: { frontend: [...SKILLS.frontend], backend: [...SKILLS.backend], interaction: [...SKILLS.interaction] },
	siteStack: [...SITE_STACK],
};

interface ProfileState {
	profile: SiteProfile;
	/** 서버에 저장한 값을 쓰는 중인지 (기본값으로 되돌리기를 보여 줄지) */
	custom: boolean;
}

const profileStore = createStore<ProfileState>({ profile: DEFAULT_PROFILE, custom: false });

const apply = (profile: SiteProfile | null) =>
	profileStore.setState({ profile: profile ?? DEFAULT_PROFILE, custom: profile !== null });

/** 앱 시작 시 한 번: 서버에 저장한 프로필을 읽는다. 서버가 없거나 읽지 못하면 기본값 그대로 */
export async function loadSiteProfile(fetchImpl: typeof fetch = fetch) {
	try {
		const body = await api<{ profile: SiteProfile | null }>('/site', { fetchImpl });
		apply(body.profile);
	} catch {
		// 서버가 없거나 읽지 못하면 기본값 그대로
	}
}

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

async function send(options: ApiOptions): Promise<SaveResult> {
	try {
		const body = await api<{ profile?: SiteProfile | null } | null>('/site/profile', {
			...options,
			fallback: '저장하지 못했습니다.',
		});
		apply(body?.profile ?? null);
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: reasonsFrom(error) };
	}
}

/** 관리자: 프로필을 저장한다. 서버가 규칙을 어긴 이유를 모두 돌려준다 */
export const saveProfile = (profile: SiteProfile) => send({ method: 'PUT', json: profile });

/** 관리자: 저장한 프로필을 지우고 코드의 기본값으로 돌아간다 */
export const resetProfile = () => send({ method: 'DELETE' });

export const getProfile = () => profileStore.getState().profile;

export function useProfileState(): ProfileState {
	return useSyncExternalStore(profileStore.subscribe, profileStore.getState);
}

export const useProfile = () => useProfileState().profile;

/** GitHub 프로필 사진. 132px 동그라미를 레티나 화면에서도 또렷하게 (2배) */
export const photoUrl = (profile: SiteProfile) =>
	`https://github.com/${encodeURIComponent(githubLogin(profile))}.png?size=280`;

/** '김정현 <hyeoniverse.dev@gmail.com>' */
export const ownerAddress = (profile: SiteProfile) => `${profile.name} <${profile.email}>`;
