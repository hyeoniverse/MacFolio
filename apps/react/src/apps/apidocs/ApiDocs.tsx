import AppWindow from '@/desktop/window/Window';
import { env } from '@/shared/config/env';
import WebFrame from '@/shared/ui/web-frame/WebFrame';

/**
 * API 문서: 이 사이트 서버(API)의 문서 (메뉴 막대의 서버 상태 → 'API 문서 열기', Launchpad).
 * 서버의 /docs가 아니라 이 사이트의 api-docs.html을 띄운다. 그 페이지가 openapi.json(API 코드에서 만든다)을 Scalar로 그리므로
 * 서버가 꺼져 있어도 문서는 보인다. 따로 된 페이지에 두는 까닭은 Scalar가 주소(#)와 방문 기록, 전역 CSS를 직접 쓰기 때문이다.
 * 이 사이트의 주소 막대는 맨 앞 창만 바꾼다 (desktop/AppStateContext의 syncAddressBar)
 */
const ApiDocs = () => (
	<AppWindow title="API 문서" appName="apidocs">
		<WebFrame
			src={`${import.meta.env.BASE_URL}api-docs.html`}
			title="API 문서"
			appName="apidocs"
			icon={`${env.imageUrl}/apidocs.svg`}
		/>
	</AppWindow>
);

export default ApiDocs;
