import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/** 모든 에러 응답의 모양 */
export interface ErrorBody {
	statusCode: number;
	/** HTTP 상태 이름 (예: Not Found) */
	error: string;
	/** 사람이 읽을 설명. 입력 검증 실패면 항목마다 하나씩 */
	message: string | string[];
	path: string;
	timestamp: string;
}

/**
 * 에러 응답을 한 가지 모양(ErrorBody)으로 맞춘다.
 * - NestJS의 HttpException: 상태와 설명을 그대로
 * - Express 미들웨어(body-parser 등)의 http-errors: 상태는 그대로, 설명은 우리말로 (너무 큰 몸통 413, 깨진 JSON 400)
 * - 그 밖의 에러(DB, 코드 버그): 내용(스택, DB 메시지 등)을 밖으로 내보내지 않고 500으로만 알리며, 서버 로그에 남긴다
 *   (로그의 비밀 값은 SafeLogger가 가린다)
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
	private readonly logger = new Logger(HttpErrorFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const context = host.switchToHttp();
		const request = context.getRequest<Request>();
		const response = context.getResponse<Response>();
		const body = toErrorBody(exception, request.url);
		response.status(body.statusCode).json(body);
		if (body.statusCode >= 500) this.logger.error(`${request.method} ${request.url} → ${body.statusCode}`, exception);
	}
}

/** Express 미들웨어가 던지는 에러(http-errors 패키지): 4xx면 상태를 믿는다 */
interface HttpLikeError {
	status?: unknown;
	expose?: unknown;
	type?: unknown;
	message?: unknown;
}

const HTTP_LIKE_MESSAGES: Record<string, string> = {
	'entity.too.large': '요청이 너무 큽니다.',
	'entity.parse.failed': '요청 본문을 읽을 수 없습니다.',
	'entity.verify.failed': '요청 본문을 읽을 수 없습니다.',
	'encoding.unsupported': '지원하지 않는 인코딩입니다.',
	'charset.unsupported': '지원하지 않는 문자 집합입니다.',
	'request.aborted': '요청이 중간에 끊겼습니다.',
};

function httpLikeStatus(exception: unknown): { statusCode: number; message: string } | null {
	if (!exception || typeof exception !== 'object') return null;
	const { status, expose, type, message } = exception as HttpLikeError;
	if (typeof status !== 'number' || status < 400 || status >= 500 || expose !== true) return null;
	const known = typeof type === 'string' ? HTTP_LIKE_MESSAGES[type] : undefined;
	return { statusCode: status, message: known ?? (typeof message === 'string' ? message : statusName(status)) };
}

export function toErrorBody(exception: unknown, path: string, now = new Date()): ErrorBody {
	if (exception instanceof HttpException) {
		const statusCode = exception.getStatus();
		const body = exception.getResponse();
		const message =
			typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
		return { statusCode, error: statusName(statusCode), message, path, timestamp: now.toISOString() };
	}
	const httpLike = httpLikeStatus(exception);
	if (httpLike) return { ...httpLike, error: statusName(httpLike.statusCode), path, timestamp: now.toISOString() };
	const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
	return {
		statusCode,
		error: statusName(statusCode),
		message: '서버에서 문제가 생겼습니다.',
		path,
		timestamp: now.toISOString(),
	};
}

/** 404 → 'Not Found' */
const statusName = (status: number) =>
	(HttpStatus[status] ?? 'Error')
		.toLowerCase()
		.split('_')
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(' ');
