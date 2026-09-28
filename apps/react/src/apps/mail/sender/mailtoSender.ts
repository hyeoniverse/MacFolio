import { buildMailto } from '../contact';
import type { MailSender } from './types';

/**
 * 작성한 내용이 채워진 상태로 방문자의 메일 앱을 연다.
 * @param open mailto 주소를 여는 함수 (테스트에서 바꿔 끼울 수 있다)
 */
export function createMailtoSender(
	to: string,
	open: (url: string) => void = (url) => window.open(url, '_self')
): MailSender {
	return {
		async send(input) {
			try {
				open(buildMailto(to, input));
				return { status: 'handed-off' };
			} catch {
				return { status: 'failed', message: '메일 앱을 열지 못했습니다.' };
			}
		},
	};
}
