import { env } from '@/shared/config/env';
import { PROFILE } from '@/shared/profile';
import { formatSessionTime, type AdminStatus } from '@/shared/auth/admin';
import GitHubAvatar from '@/shared/auth/GitHubAvatar';
import { refreshAdmin, signIn, signOut, useAdmin } from '@/shared/auth/adminStore';
import '@/shared/auth/AdminAccount.css';
import Button from '@/shared/ui/button/Button';

/** 관리자로 인정하는 GitHub 계정 (프로필 주소의 마지막 부분) */
const ADMIN_LOGIN = PROFILE.github.split('/').at(-1) ?? '';

const STATUS_TEXT: Record<AdminStatus, string> = {
	disabled: '관리자 서버가 아직 연결되지 않았습니다',
	checking: '확인하는 중…',
	offline: '관리자 서버에 연결할 수 없습니다',
	'signed-out': '로그인하지 않음',
	'signed-in': 'GitHub로 로그인됨',
};

/**
 * 관리자 계정 카드: 로그인 상태와 로그인·로그아웃 단추.
 * 설정(계정)과 암호 앱이 함께 쓴다.
 */
const AdminAccount = () => {
	const { status, login, signedInAt, expiresAt } = useAdmin();
	const signedIn = status === 'signed-in' && login;

	return (
		<section className="admin-account" aria-label="관리자 계정">
			<div className="admin-account-head">
				{signedIn ? (
					<GitHubAvatar className="admin-account-avatar" login={login} />
				) : (
					<span className="admin-account-avatar placeholder" aria-hidden="true">
						<i className="fa-solid fa-user" />
					</span>
				)}
				<div>
					<strong>{signedIn ? login : '관리자'}</strong>
					<p className="admin-account-status" data-status={status}>
						{STATUS_TEXT[status]}
					</p>
				</div>
			</div>

			<div className="admin-account-actions">
				{signedIn && <Button onClick={() => void signOut()}>로그아웃</Button>}
				{(status === 'signed-out' || status === 'disabled') && (
					<Button tone="primary" disabled={status === 'disabled'} onClick={signIn}>
						<i className="fa-brands fa-github" aria-hidden="true" /> GitHub로 로그인
					</Button>
				)}
				{status === 'offline' && <Button onClick={() => void refreshAdmin()}>다시 확인</Button>}
			</div>

			<dl className="admin-account-details">
				<div>
					<dt>할 수 있는 일</dt>
					<dd>메모 폴더·글 정리, 고정</dd>
				</div>
				<div>
					<dt>로그인</dt>
					<dd>GitHub {ADMIN_LOGIN} 계정만</dd>
				</div>
				<div>
					<dt>세션</dt>
					<dd>12시간</dd>
				</div>
				{signedIn && signedInAt && (
					<div>
						<dt>로그인 시각</dt>
						<dd>
							<time dateTime={signedInAt.toISOString()}>{formatSessionTime(signedInAt)}</time>
						</dd>
					</div>
				)}
				{signedIn && expiresAt && (
					<div>
						<dt>세션 만료</dt>
						<dd>
							<time dateTime={expiresAt.toISOString()}>{formatSessionTime(expiresAt)}</time>
						</dd>
					</div>
				)}
				{env.apiUrl && (
					<div>
						<dt>서버</dt>
						<dd>{new URL(env.apiUrl).host}</dd>
					</div>
				)}
			</dl>
			<p className="admin-account-note">
				비밀번호를 따로 두지 않고 GitHub 계정으로 확인합니다. 방문자는 읽기만 할 수 있고, 권한은 서버가 요청마다
				확인합니다.
			</p>
		</section>
	);
};

export default AdminAccount;
