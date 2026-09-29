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
 * 예상하지 못한 에러는 내용(스택, DB 메시지 등)을 밖으로 내보내지 않고 500으로만 알리며, 서버 로그에 남긴다.
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
		if (!(exception instanceof HttpException)) this.logger.error(exception);
	}
}

export function toErrorBody(exception: unknown, path: string, now = new Date()): ErrorBody {
	if (exception instanceof HttpException) {
		const statusCode = exception.getStatus();
		const body = exception.getResponse();
		const message =
			typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
		return { statusCode, error: statusName(statusCode), message, path, timestamp: now.toISOString() };
	}
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
