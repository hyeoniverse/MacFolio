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
	/**
	 * 앞에 둔 프록시(nginx, Cloudflare) 수. 있으면 X-Forwarded-For에서 실제 IP를 읽는다 (요청 제한이 IP로 센다).
	 * 없으면 0: 헤더를 믿지 않는다 (누구나 헤더를 꾸며 제한을 피할 수 있으므로)
	 */
	trustProxy: number;
	/** 댓글 쓰기·지우기를 IP마다 1분에 몇 번까지 받을지 */
	commentRateLimit: number;
	/**
	 * IP를 그대로 저장하지 않고 이 키로 HMAC해 둔다 (같은 사람이 쓴 글을 묶어 볼 때만 쓴다).
	 * 배포에서는 반드시 정한다. 로컬·테스트는 기본값
	 */
	ipHashSecret: string;
	/** 글에 넣을 사진 찾기 (키가 없으면 그 서비스만 꺼진다) */
	stockPhotos: {
		unsplashAccessKey?: string;
		pexelsApiKey?: string;
	};
	/**
	 * GitHub 앱이 보여 줄 프로필·README·저장소를 GitHub API에서 받을 때 쓰는 토큰 (없어도 된다).
	 * 없으면 이 서버 IP로 시간당 60번까지라, 받은 값을 오래 들고 있는다
	 */
	githubToken?: string;
	/**
	 * 음성 만들기 데모 (Fish → Google → Edge). 키가 없는 공급자는 건너뛴다 (Edge는 키가 필요 없다).
	 * 비용을 막으려고 IP마다, 사이트 전체로 하루에 만들 수 있는 횟수를 정한다
	 */
	speech: {
		fishAudioApiKey?: string;
		googleTtsApiKey?: string;
		perIpPerDay: number;
		totalPerDay: number;
	};
	/** 번역 데모 (DeepL → Google). 키 이름은 HYEONIVERSE와 같다. 하루 상한은 음성과 같은 방식 */
	translate: {
		deeplApiKey?: string;
		googleTranslateApiKey?: string;
		perIpPerDay: number;
		totalPerDay: number;
	};
	/** AI 요약 데모 (Gemini가 한국어·영어 요약을 함께 만든다) */
	summary: {
		geminiApiKey?: string;
		/** 기본은 늘 최신 Flash를 가리키는 별칭. 고정하고 싶으면 GEMINI_MODEL로 정한다 (내려간 모델이면 응답이 권하는 모델로 한 번 다시 묻는다) */
		geminiModel: string;
		perIpPerDay: number;
		totalPerDay: number;
	};
	/** AI 커버 데모 (Cloudflare Workers AI → Hugging Face, 둘 다 FLUX). 무료 한도 안에서 쓰도록 상한을 아주 낮게 둔다 */
	cover: {
		/** Cloudflare 계정 ID와 Workers AI 권한만 준 API 토큰: 둘 다 있어야 Cloudflare로 그린다 */
		cloudflareAccountId?: string;
		cloudflareAiToken?: string;
		huggingfaceApiKey?: string;
		perIpPerDay: number;
		totalPerDay: number;
	};
	/** 관리자 로그인. GitHub OAuth App 값이 없으면 로그인만 막히고 나머지는 동작한다 */
	auth: {
		githubClientId?: string;
		githubClientSecret?: string;
		/**
		 * 관리자로 인정할 GitHub 계정의 숫자 ID. 계정 이름은 바꿀 수 있고, 바꾸면 옛 이름을 다른 사람이 가져갈 수 있어서
		 * 바뀌지 않는 ID로 비교한다 (확인: gh api users/<이름> --jq .id)
		 */
		adminGithubId: number;
		/** 로그인 요청(시작·콜백)을 IP마다 1분에 몇 번까지 받을지 */
		loginRateLimit: number;
		/** 쿠키를 https에서만 보낸다 (배포) */
		secureCookies: boolean;
	};
}

/** github.com/hyeoniverse의 숫자 ID */
const HYEONIVERSE_GITHUB_ID = 68999618;

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

	const adminGithubId = Number(env.ADMIN_GITHUB_ID ?? HYEONIVERSE_GITHUB_ID);
	if (!Number.isInteger(adminGithubId) || adminGithubId <= 0)
		throw new Error(`ADMIN_GITHUB_ID가 올바르지 않습니다: ${env.ADMIN_GITHUB_ID}`);

	const ipHashSecret = env.IP_HASH_SECRET || (env.NODE_ENV === 'production' ? '' : 'macfolio-dev-ip-hash-secret');
	if (!ipHashSecret) throw new Error('IP_HASH_SECRET이 없습니다. 배포에서는 긴 무작위 값을 넣어 주세요.');

	return {
		port,
		databaseUrl,
		corsOrigins,
		frontendUrl: env.FRONTEND_URL ?? corsOrigins[0] ?? 'http://localhost:5173',
		apiUrl: (env.API_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
		trustProxy: Number(env.TRUST_PROXY ?? 0) || 0,
		commentRateLimit: Number(env.COMMENT_RATE_LIMIT ?? 5) || 5,
		ipHashSecret,
		stockPhotos: {
			unsplashAccessKey: env.UNSPLASH_ACCESS_KEY || undefined,
			pexelsApiKey: env.PEXELS_API_KEY || undefined,
		},
		githubToken: env.GITHUB_TOKEN || undefined,
		speech: {
			fishAudioApiKey: env.FISH_AUDIO_API_KEY || undefined,
			googleTtsApiKey: env.GOOGLE_TTS_API_KEY || undefined,
			perIpPerDay: Number(env.SPEECH_PER_IP_PER_DAY ?? 3) || 3,
			totalPerDay: Number(env.SPEECH_TOTAL_PER_DAY ?? 50) || 50,
		},
		translate: {
			deeplApiKey: env.DEEPL_API_KEY || undefined,
			googleTranslateApiKey: env.GOOGLE_TRANSLATE_API_KEY || undefined,
			perIpPerDay: Number(env.TRANSLATE_PER_IP_PER_DAY ?? 3) || 3,
			totalPerDay: Number(env.TRANSLATE_TOTAL_PER_DAY ?? 50) || 50,
		},
		summary: {
			geminiApiKey: env.GEMINI_API_KEY || undefined,
			geminiModel: env.GEMINI_MODEL || 'gemini-flash-latest',
			perIpPerDay: Number(env.SUMMARY_PER_IP_PER_DAY ?? 3) || 3,
			totalPerDay: Number(env.SUMMARY_TOTAL_PER_DAY ?? 50) || 50,
		},
		cover: {
			cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID || undefined,
			cloudflareAiToken: env.CLOUDFLARE_AI_TOKEN || undefined,
			huggingfaceApiKey: env.HUGGINGFACE_API_KEY || undefined,
			perIpPerDay: Number(env.COVER_PER_IP_PER_DAY ?? 1) || 1,
			totalPerDay: Number(env.COVER_TOTAL_PER_DAY ?? 5) || 5,
		},
		auth: {
			githubClientId: env.GITHUB_CLIENT_ID || undefined,
			githubClientSecret: env.GITHUB_CLIENT_SECRET || undefined,
			adminGithubId,
			loginRateLimit: Number(env.AUTH_RATE_LIMIT ?? 10) || 10,
			secureCookies: env.NODE_ENV === 'production',
		},
	};
}
