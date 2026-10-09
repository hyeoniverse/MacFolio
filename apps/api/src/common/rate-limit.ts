// 요청 제한. 쓰기 경로는 모두 이 중 하나를 건다 (test/routes.e2e.test.ts가 빠진 경로를 잡는다).
// IP마다 1분에 몇 번까지 받을지를 이름마다 정하고, 횟수는 config.rateLimits(환경 변수)에서 읽는다.
// 데모(요약·번역·음성·커버)와 메일의 하루 상한은 여기와 별개로 서비스가 센다 (비용 보호).
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';

export const RATE_LIMIT_NAMES = ['login', 'comment', 'like', 'write', 'upload', 'demo', 'events'] as const;
export type RateLimitName = (typeof RATE_LIMIT_NAMES)[number];

/** 이름마다 무엇을 세는지와 기본 횟수 (1분에, IP마다). 환경 변수 이름은 config.ts */
export const RATE_LIMIT_DEFAULTS: Record<RateLimitName, { limit: number; description: string }> = {
	login: { limit: 10, description: '로그인 시작·콜백' },
	comment: { limit: 5, description: '방문자가 쓰는 것: 댓글, 메시지, 메일' },
	like: { limit: 30, description: '좋아요 누르기·취소 (글, 댓글)' },
	write: { limit: 60, description: '관리자의 쓰기: 글, 폴더 정리, 설정, 지우기' },
	upload: { limit: 20, description: '파일·배경화면 올리기' },
	demo: { limit: 10, description: 'AI 데모 (하루 상한은 따로 있다)' },
	events: { limit: 120, description: '트래픽 분석 이벤트 (5초마다 보낸다)' },
};

/** 창은 모두 1분 */
export const RATE_LIMIT_TTL_MS = 60_000;

/** 경로에 건 제한 이름 (시험이 읽는다) */
export const RATE_LIMIT_KEY = 'macfolio:rate-limit';

/**
 * 경로에 요청 제한을 건다. 이름 하나만 세고 나머지 이름은 건너뛴다. 횟수는 IP마다, 경로마다 센다.
 * 관리자 경로에서는 @UseGuards(AdminGuard) **아래**에 적는다: 데코레이터는 아래부터 적용되므로 그래야 ThrottlerGuard가
 * AdminGuard보다 먼저 돌고, 로그인하지 않은 요청도 횟수에 든다 (세션 조회 전에 막는다). routes.e2e가 이 순서를 확인한다
 */
export function RateLimit(name: RateLimitName) {
	const skip = Object.fromEntries(RATE_LIMIT_NAMES.filter((other) => other !== name).map((other) => [other, true]));
	return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), SkipThrottle(skip), UseGuards(ThrottlerGuard));
}
