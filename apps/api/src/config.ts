// 환경 변수를 읽어 검사한다. 잘못되었으면 서버를 띄우지 않고 바로 알린다.

export interface AppConfig {
	port: number;
	databaseUrl: string;
	/** 요청을 허용할 프론트엔드 주소 */
	corsOrigins: string[];
	/** 로그인을 마치고 돌아갈 프론트엔드 주소 */
	frontendUrl: string;
	/** 이 API의 바깥 주소 (OAuth 콜백 주소를 만든다) */
	apiUrl: string;
	/** 관리자 로그인. GitHub OAuth App 값이 없으면 로그인만 막히고 나머지는 동작한다 */
	auth: {
		githubClientId?: string;
		githubClientSecret?: string;
		/** 관리자로 인정할 GitHub 계정 */
		adminGithubLogin: string;
		/** 쿠키를 https에서만 보낸다 (배포) */
		secureCookies: boolean;
	};
}

/** 의존성 주입 토큰 */
export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
	const databaseUrl = env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL이 없습니다. apps/api/.env.example을 참고하세요.');

	const port = Number(env.PORT ?? 4000);
	if (!Number.isInteger(port) || port <= 0) throw new Error(`PORT가 올바르지 않습니다: ${env.PORT}`);

	const corsOrigins = (env.CORS_ORIGINS ?? 'http://localhost:5173')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	return {
		port,
		databaseUrl,
		corsOrigins,
		frontendUrl: env.FRONTEND_URL ?? corsOrigins[0] ?? 'http://localhost:5173',
		apiUrl: (env.API_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
		auth: {
			githubClientId: env.GITHUB_CLIENT_ID || undefined,
			githubClientSecret: env.GITHUB_CLIENT_SECRET || undefined,
			adminGithubLogin: env.ADMIN_GITHUB_LOGIN ?? 'hyeoniverse',
			secureCookies: env.NODE_ENV === 'production',
		},
	};
}
