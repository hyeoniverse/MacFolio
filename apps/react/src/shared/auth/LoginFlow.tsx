import { useEffect, useRef } from 'react';
import { env } from '@/shared/config/env';
import { avatarUrl, loginOutcome } from '@/shared/auth/admin';
import { dismissLoginResult, useAdmin, useLoginFlow } from '@/shared/auth/adminStore';
import '@/shared/auth/LoginFlow.css';

/**
 * 로그인하러 다녀오는 흐름을 화면에 보여 준다.
 * - 떠날 때: "GitHub로 이동하는 중" (갑자기 다른 페이지로 바뀌지 않게)
 * - 돌아왔을 때: 결과 창. 확인을 누를 때까지 떠 있다 (배너는 금방 사라져 놓치기 쉽다)
 */
const LoginFlow = () => {
	const { redirecting, result } = useLoginFlow();
	const admin = useAdmin();
	const confirmRef = useRef<HTMLButtonElement>(null);
	// 서버에 로그인 상태를 물어본 뒤에 결과를 보여 준다
	const outcome = result && admin.status !== 'checking' ? loginOutcome(result, admin) : null;

	useEffect(() => {
		if (!outcome) return;
		confirmRef.current?.focus();
		const close = (event: KeyboardEvent) => {
			if (event.key === 'Escape' || event.key === 'Enter') dismissLoginResult();
		};
		window.addEventListener('keydown', close);
		return () => window.removeEventListener('keydown', close);
	}, [outcome]);

	if (redirecting) {
		return (
			<div className="login-flow" role="status" aria-label="GitHub로 이동하는 중">
				<div className="login-flow-card">
					<i className="fa-brands fa-github login-flow-github" aria-hidden="true" />
					<strong>GitHub로 이동하는 중…</strong>
					<p>로그인을 마치면 이 화면으로 돌아옵니다.</p>
					<span className="login-flow-spinner" aria-hidden="true" />
				</div>
			</div>
		);
	}

	if (!outcome) return null;
	return (
		<div className="login-flow" onClick={(event) => event.target === event.currentTarget && dismissLoginResult()}>
			<div className="login-flow-card" role="alertdialog" aria-modal="true" aria-label={outcome.title}>
				{outcome.tone === 'success' && admin.login ? (
					<img className="login-flow-avatar" src={avatarUrl(admin.login)} alt="" />
				) : (
					<img className="login-flow-icon" src={`${env.imageUrl}/passwords.svg`} alt="" />
				)}
				<strong>
					{outcome.tone === 'success' && <i className="fa-solid fa-circle-check login-flow-check" aria-hidden="true" />}
					{outcome.title}
				</strong>
				<p>{outcome.body}</p>
				<button ref={confirmRef} type="button" className="login-flow-button" onClick={dismissLoginResult}>
					확인
				</button>
			</div>
		</div>
	);
};

export default LoginFlow;
