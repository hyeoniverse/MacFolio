import { useSyncExternalStore } from 'react';
import { prefersDarkScheme } from '@/shared/lib/media';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import document from '@/apps/apidocs/openapi.json';
import { env } from '@/shared/config/env';

/** 사이트(이 페이지를 띄운 창)의 <html>. 설정 앱이 data-theme을 정한다. 따로 열었으면 null */
const siteRoot = (() => {
	try {
		return window.parent !== window ? window.parent.document.documentElement : null;
	} catch {
		return null;
	}
})();

const subscribeTheme = (onChange: () => void) => {
	if (!siteRoot) return () => {};
	const observer = new MutationObserver(onChange);
	observer.observe(siteRoot, { attributes: true, attributeFilter: ['data-theme'] });
	return () => observer.disconnect();
};
const isDark = () => (siteRoot ? siteRoot.dataset.theme === 'dark' : prefersDarkScheme());

/** 관리자 API는 세션 쿠키로 확인한다. 'Test Request'에도 쿠키를 함께 보낸다 (서버 CORS가 이 사이트에 credentials를 허용한다) */
const fetchWithCookies: typeof fetch = (input, init) => fetch(input, { ...init, credentials: 'include' });

/**
 * openapi.json을 Scalar로 그린다. 바깥으로 나가는 기능(사용 통계, AI 채팅, MCP, 글꼴)은 끈다.
 * 'Test Request'는 Scalar 프록시를 거치지 않고 서버로 바로 간다. 서버 주소가 없으면 문서만 보여 준다
 */
const ApiReference = () => {
	const dark = useSyncExternalStore(subscribeTheme, isDark);
	return (
		<ApiReferenceReact
			configuration={{
				content: document,
				servers: env.apiUrl ? [{ url: env.apiUrl }] : [],
				hideTestRequestButton: !env.apiUrl,
				customFetch: fetchWithCookies,
				forceDarkModeState: dark ? 'dark' : 'light',
				hideDarkModeToggle: true,
				hideClientButton: true,
				showDeveloperTools: 'never',
				telemetry: false,
				withDefaultFonts: false,
				agent: { disabled: true },
				mcp: { disabled: true },
				customCss: `.scalar-app { --scalar-font: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif; }`,
			}}
		/>
	);
};

export default ApiReference;
