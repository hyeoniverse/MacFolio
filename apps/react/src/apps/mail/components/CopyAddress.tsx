import { notify } from '@/desktop/notifications/notificationStore';
import { PROFILE } from '@/shared/profile';

/** '김정현 <hyeoniverse.dev@gmail.com>' */
export const OWNER_ADDRESS = `${PROFILE.name} <${PROFILE.email}>`;

/** 이메일 주소(이름 없이)를 복사하고, 사이트의 다른 복사(공유, 링크 복사)처럼 알림으로 알린다 */
async function copyEmail() {
	try {
		await navigator.clipboard.writeText(PROFILE.email);
		notify({ app: 'mail', title: '이메일 주소 복사됨', body: PROFILE.email });
	} catch {
		notify({ app: 'mail', title: '이메일 주소를 복사하지 못했습니다', body: PROFILE.email });
	}
}

/**
 * 사이트 주인의 주소. 누르면 이메일 주소(이름 없이)를 복사하고 알림을 띄운다.
 * macOS 메일에서 주소 칩을 눌러 '이메일 주소 복사'를 고르는 것을 한 번에 한다.
 * withName이 false면 주소만 보인다 (읽기 화면의 보낸 사람 줄처럼 이름이 이미 위에 있을 때)
 */
const CopyAddress = ({ className = '', withName = true }: { className?: string; withName?: boolean }) => (
	<button
		type="button"
		className={`mail-copy-address ${className}`}
		title="눌러서 이메일 주소 복사"
		aria-label={`${withName ? OWNER_ADDRESS : PROFILE.email} (눌러서 이메일 주소 복사)`}
		onClick={() => void copyEmail()}
	>
		<span className="mail-copy-text">{withName ? OWNER_ADDRESS : PROFILE.email}</span>
	</button>
);

export default CopyAddress;
