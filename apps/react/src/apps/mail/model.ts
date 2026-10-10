// 메일 앱의 데스크톱(Mail.tsx)과 휴대폰(MailMobile.tsx) 화면이 함께 쓰는 타입과 이름.
// 둘이 서로를 import하면 순환이 되므로 공통은 여기에만 둔다 (madge가 CI에서 막는다)

export type Mailbox = 'inbox' | 'sent';

export const MAILBOX_LABEL: Record<Mailbox, string> = { inbox: '받은 편지함', sent: '보낸 편지함' };

/** 목록과 읽기 칸이 함께 쓰는 메일 한 통 */
export interface ListMail {
	id: string;
	fromName: string;
	fromEmail: string;
	/** 받는 사람 (읽기 칸에 보인다) */
	to: string;
	subject: string;
	/** ISO 8601 */
	date: string;
	body: string;
	/** 사이트 주인의 답장 (서버에 저장된 메일만) */
	replies: { id: string; body: string; createdAt: string }[];
	/** 서버에 저장된 받은 메일: 관리자가 앱에서 답장한다 */
	replyable?: boolean;
}
