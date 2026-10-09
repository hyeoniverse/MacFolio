import { useEffect, useState } from 'react';
import { PROFILE } from '@/shared/profile';

/** '김정현 <hyeoniverse.dev@gmail.com>' */
export const OWNER_ADDRESS = `${PROFILE.name} <${PROFILE.email}>`;

/**
 * 사이트 주인의 주소. 누르면 이메일 주소(이름 없이)를 복사하고, 잠깐 '복사했어요'를 띄운다.
 * macOS 메일에서 주소 칩을 눌러 '이메일 주소 복사'를 고르는 것을 한 번에 한다.
 * withName이 false면 주소만 보인다 (읽기 화면의 보낸 사람 줄처럼 이름이 이미 위에 있을 때)
 */
const CopyAddress = ({ className = '', withName = true }: { className?: string; withName?: boolean }) => {
	const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(null), 1600);
		return () => window.clearTimeout(timer);
	}, [copied]);

	return (
		<button
			type="button"
			className={`mail-copy-address ${className}`}
			title="눌러서 이메일 주소 복사"
			aria-label={`${withName ? OWNER_ADDRESS : PROFILE.email} (눌러서 이메일 주소 복사)`}
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(PROFILE.email);
					setCopied('ok');
				} catch {
					setCopied('failed');
				}
			}}
		>
			<span className="mail-copy-text">{withName ? OWNER_ADDRESS : PROFILE.email}</span>
			{copied && (
				<span className={`mail-copied ${copied}`} role="status">
					{copied === 'ok' ? '복사했어요' : '복사하지 못했어요'}
				</span>
			)}
		</button>
	);
};

export default CopyAddress;
