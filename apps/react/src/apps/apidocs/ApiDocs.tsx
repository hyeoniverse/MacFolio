import AppWindow from '@/desktop/window/Window';
import { env } from '@/shared/config/env';
import WebFrame from '@/shared/ui/web-frame/WebFrame';
import '@/apps/apidocs/ApiDocs.css';

/**
 * API 문서: 이 사이트 서버(API)의 Swagger 문서를 창 안에 띄운다 (메뉴 막대의 서버 상태 → 'API 문서 열기').
 * API가 /docs만 이 사이트의 iframe에 들어가는 것을 허용한다 (apps/api/src/app.setup.ts).
 */
const ApiDocs = () => (
	<AppWindow title="API 문서" appName="apidocs">
		{env.apiUrl ? (
			<WebFrame src={`${env.apiUrl}/docs`} title="API 문서" appName="apidocs" icon={`${env.imageUrl}/apidocs.svg`} />
		) : (
			<div className="apidocs-empty" role="status">
				<img src={`${env.imageUrl}/apidocs.svg`} alt="" />
				<p>연결된 서버가 없습니다.</p>
				<p className="apidocs-hint">VITE_API_URL을 설정하면 이 창에 API 문서가 열립니다.</p>
			</div>
		)}
	</AppWindow>
);

export default ApiDocs;
