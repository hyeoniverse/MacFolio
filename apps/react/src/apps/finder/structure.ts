// Finder의 구조를 API에서 읽고 쓴다: 폴더 구조(/finder/layout)와 블로그 쪽의 메모 정리 내용(/memo/organization).
// 누구나 읽고, 관리자만 쓴다 (서버가 세션으로 확인한다). 화면에 먼저 반영하고, 저장하지 못하면 알리고 서버 내용으로 되돌린다
import { useSyncExternalStore } from 'react';
import { EMPTY_FINDER_LAYOUT, type FinderLayoutValue } from '@macfolio/contracts';
import { createStore } from '@macfolio/desktop-core';
import { EMPTY_ORGANIZATION, type Organization } from '@macfolio/desktop-core/memo';
import { api, messageOf } from '@/shared/api/client';
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import {
	fetchOrganization,
	organizationEvents,
	publishOrganization,
	saveOrganization,
} from '@/apps/memo/organizationApi';
import type { Change } from './edit';

interface State {
	layout: FinderLayoutValue;
	organization: Organization;
	/** 처음 읽기를 마쳤는지 */
	loaded: boolean;
}

const store = createStore<State>({ layout: EMPTY_FINDER_LAYOUT, organization: EMPTY_ORGANIZATION, loaded: false });
let pending: Promise<void> | null = null;

/** 폴더 구조를 읽는다. 서버가 없거나 읽지 못하면 기본 구조 */
async function fetchLayout(): Promise<FinderLayoutValue> {
	if (!env.apiUrl) return EMPTY_FINDER_LAYOUT;
	try {
		const {
			folders = [],
			files = {},
			aliases = null,
			trash = {},
		} = await api<Partial<FinderLayoutValue>>('/finder/layout');
		return { folders, files, aliases, trash };
	} catch {
		return EMPTY_FINDER_LAYOUT;
	}
}

/** 구조와 정리 내용을 (한 번) 읽는다. force면 다시 */
export function loadStructure(force = false): Promise<void> {
	if (!force && store.getState().loaded) return Promise.resolve();
	pending ??= Promise.all([fetchLayout(), fetchOrganization(env.apiUrl)])
		.then(([layout, organization]) => store.setState({ layout, organization, loaded: true }))
		.finally(() => {
			pending = null;
		});
	return pending;
}

// 메모가 저장한 정리 내용(메모에서 폴더를 옮김)을 따라간다
organizationEvents.subscribe(({ organization, source }) => {
	if (organization && source === 'memo') store.setState({ organization });
});

export const useStructure = (): State => useSyncExternalStore(store.subscribe, store.getState);
export const structureNow = () => store.getState();

/** 저장 차례 (연달아 바꿔도 요청이 뒤바뀌어 도착하지 않게) */
let queue: Promise<unknown> = Promise.resolve();

/** 관리자의 편집을 화면에 바로 반영하고 서버에 저장한다. 실패하면 알리고 서버 내용으로 되돌린다 */
export function commit(change: Change): Promise<boolean> {
	const { layout, organization } = change;
	store.setState((state) => ({
		...state,
		layout: layout ?? state.layout,
		organization: organization ?? state.organization,
	}));
	const run = queue.then(async () => {
		try {
			if (layout) await api('/finder/layout', { method: 'PUT', json: layout });
			if (organization) {
				if (!(await saveOrganization(env.apiUrl, organization))) throw new Error('메모 정리를 저장하지 못했습니다.');
				publishOrganization(organization, 'finder');
			}
			return true;
		} catch (error) {
			notify({ app: 'finder', title: '저장하지 못함', body: messageOf(error, '다시 로그인해 주세요.') });
			await loadStructure(true);
			return false;
		}
	});
	queue = run;
	return run;
}
