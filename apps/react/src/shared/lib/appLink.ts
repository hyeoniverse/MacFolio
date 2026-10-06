// 앱 안의 화면 하나를 가리키는 주소: https://<사이트>/<앱>/<항목>
//   메모의 글 → /memo/<글 주소>, Safari의 프로젝트 탭 → /safari/<프로젝트 id>
// 사이트는 Cloudflare의 single-page-application 설정으로 어떤 경로든 index.html을 돌려준다.
// 앱이 시작할 때 이 경로를 읽어 그 앱을 그 항목으로 열고, 쓰는 동안에는 맨 앞 창이 가리키는 곳을 주소 막대에 둔다.
import { createStore } from './createStore';
import { notify } from '@/desktop/notifications/notificationStore';

export const LINKED_APPS = ['memo', 'safari'] as const;
export type LinkedApp = (typeof LINKED_APPS)[number];

export interface AppLink {
	app: LinkedApp;
	id: string;
}

/** 항목의 경로 (/<앱>/<항목>) */
export const appPath = ({ app, id }: AppLink) => `/${app}/${encodeURIComponent(id)}`;

/** 공유할 주소 */
export const appUrl = (link: AppLink, origin = window.location.origin) => `${origin}${appPath(link)}`;

/** 경로가 앱의 항목을 가리키면 그 항목, 아니면 null */
export function parseAppPath(pathname: string): AppLink | null {
	const match = /^\/([a-z]+)\/([^/]+)\/?$/.exec(pathname);
	if (!match || !(LINKED_APPS as readonly string[]).includes(match[1])) return null;
	try {
		return { app: match[1] as LinkedApp, id: decodeURIComponent(match[2]) };
	} catch {
		return null;
	}
}

/**
 * 링크(href)가 이 사이트의 앱 항목을 가리키면 그 항목 (`/memo/<글>`, 같은 사이트의 전체 주소도). 아니면 null.
 * 글 안의 링크를 새 탭이 아니라 사이트 안의 앱으로 열 때 쓴다
 */
export function appLinkOf(href: string | undefined, origin = window.location.origin): AppLink | null {
	if (!href) return null;
	let url: URL;
	try {
		url = new URL(href, origin);
	} catch {
		return null;
	}
	if (url.origin !== origin) return null;
	return parseAppPath(url.pathname);
}

/** 처음 연 주소가 가리키는 항목 (페이지를 연 순간의 주소. 앱이 주소를 바꾸기 전에 읽어 둔다) */
const initial = typeof window === 'undefined' ? null : parseAppPath(window.location.pathname);

/** 처음 연 주소가 이 앱을 가리키면 그 항목 id */
export const linkedId = (app: LinkedApp) => (initial?.app === app ? initial.id : null);

/** 처음 연 주소가 가리키는 앱 */
export const linkedApp = () => initial?.app ?? null;

/** 앱마다 지금 보여 주는 항목 (주소가 없는 화면이면 null). 맨 앞 창의 것을 주소 막대에 둔다 */
export const appAddresses = createStore<Partial<Record<LinkedApp, string | null>>>({});

/** 앱이 지금 보여 주는 항목을 알린다 (창을 닫을 때는 null) */
export const setAppAddress = (app: LinkedApp, id: string | null) =>
	appAddresses.setState((current) => (current[app] === id ? current : { ...current, [app]: id }));

/** 맨 앞의 앱이 가리키는 항목으로 주소 막대를 바꾼다 (없으면 사이트 주소) */
export function syncAddressBar(front: string | null) {
	const linked = front !== null && (LINKED_APPS as readonly string[]).includes(front);
	const id = linked ? appAddresses.getState()[front as LinkedApp] : null;
	// 맨 앞 앱이 아직 알리지 않았으면(글을 읽어 오는 중) 들어온 주소를 그대로 둔다
	if (id === undefined) return;
	const path = id ? appPath({ app: front as LinkedApp, id }) : '/';
	if (window.location.pathname === path) return;
	window.history.replaceState(window.history.state, '', path + window.location.search + window.location.hash);
}

/**
 * 공유: 휴대폰처럼 공유 시트가 있으면 그걸 열고(메시지·카카오톡으로 바로 보낸다),
 * 아니면 주소를 클립보드에 넣고 알린다.
 */
export async function shareLink(link: AppLink, title: string) {
	const url = appUrl(link);
	if (navigator.share && window.matchMedia?.('(pointer: coarse)').matches) {
		try {
			await navigator.share({ title, url });
			return;
		} catch (error) {
			// 공유 시트를 닫은 것뿐이면 아무것도 하지 않는다
			if ((error as DOMException).name === 'AbortError') return;
		}
	}
	try {
		await navigator.clipboard.writeText(url);
		notify({ app: link.app, title: '링크 복사됨', body: `‘${title}’ 링크를 복사했습니다.` });
	} catch {
		notify({ app: link.app, title: '링크를 복사하지 못했습니다', body: url });
	}
}
