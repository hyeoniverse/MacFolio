// 환경 변수를 읽어 검사한다. 잘못되었으면 서버를 띄우지 않고 바로 알린다.

export interface AppConfig {
	port: number;
	databaseUrl: string;
	/** 요청을 허용할 프론트엔드 주소 */
	corsOrigins: string[];
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

	return { port, databaseUrl, corsOrigins };
}
