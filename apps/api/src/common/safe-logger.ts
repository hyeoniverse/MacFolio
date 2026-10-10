import { ConsoleLogger } from '@nestjs/common';
import { redactValue } from './redact.js';

/**
 * 모든 로그를 쓰기 전에 비밀 값(DB 비밀번호, API 키, 쿠키, 메일 주소)을 가리는 로거.
 * app.setup에서 app.useLogger로 걸면 서비스마다 만든 `new Logger(이름)`이 모두 이쪽으로 온다.
 */
export class SafeLogger extends ConsoleLogger {
	override log(message: unknown, ...rest: unknown[]) {
		super.log(redactValue(message), ...rest.map(redactValue));
	}
	override error(message: unknown, ...rest: unknown[]) {
		super.error(redactValue(message), ...rest.map(redactValue));
	}
	override warn(message: unknown, ...rest: unknown[]) {
		super.warn(redactValue(message), ...rest.map(redactValue));
	}
	override debug(message: unknown, ...rest: unknown[]) {
		super.debug(redactValue(message), ...rest.map(redactValue));
	}
	override verbose(message: unknown, ...rest: unknown[]) {
		super.verbose(redactValue(message), ...rest.map(redactValue));
	}
	override fatal(message: unknown, ...rest: unknown[]) {
		super.fatal(redactValue(message), ...rest.map(redactValue));
	}
}
