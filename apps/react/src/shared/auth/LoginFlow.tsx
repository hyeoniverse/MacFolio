import { useEffect, useRef } from 'react';
import { env } from '@/shared/config/env';
import { loginOutcome } from '@/shared/auth/admin';
import GitHubAvatar from '@/shared/auth/GitHubAvatar';
import { dismissLoginResult, useAdmin, useLoginFlow } from '@/shared/auth/adminStore';
import '@/shared/auth/LoginFlow.css';
import Button from '@/shared/ui/button/Button';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';

/**
 * 로그인하러 다녀오는 흐름을 화면에 보여 준다.
 * - 떠날 때: "GitHub로 이동하는 중" (갑자기 다른 페이지로 바뀌지 않게)
 * - 돌아왔을 때: 결과 창. 확인을 누를 때까지 떠 있다 (배너는 금방 사라져 놓치기 쉽다)
 */
const LoginFlow = () => {
	const { redirecting, result } = useLoginFlow();
	const admin = useAdmin();
	const confirmRef = useRef<HTMLButtonElement>(null);
	// 닫히면 바탕은 흐려지고 가운데 상자는 작아지며 사라진다 (motion.css)
	const layer = useExitMotion<HTMLDivElement>('fade-out');
	// 서버에 로그인 상태를 물어본 뒤에 결과를 보여 준다
	const outcome = result && admin.status !== 'checking' ? loginOutcome(result, admin) : null;

	useEffect(() => {
		if (!outcome) return;
		confirmRef.current?.focus();
		const close = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' && event.key !== 'Enter') return;
			event.preventDefault();
			dismissLoginResult();
		};
		window.addEventListener('keydown', close);
		return () => window.removeEventListener('keydown', close);
	}, [outcome]);

	if (redirecting) {
		return (
			<div ref={layer} className="login-flow" role="status" aria-label="GitHub로 이동하는 중">
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
		<div
			ref={layer}
			className="login-flow"
			onClick={(event) => event.target === event.currentTarget && dismissLoginResult()}
		>
			<div className="login-flow-card" role="alertdialog" aria-modal="true" aria-label={outcome.title}>
				{outcome.tone === 'success' && admin.login ? (
					<GitHubAvatar className="login-flow-avatar" login={admin.login} />
				) : (
					<img className="login-flow-icon" src={`${env.imageUrl}/passwords.svg`} alt="" />
				)}
				<strong>
					{outcome.tone === 'success' && <i className="fa-solid fa-circle-check login-flow-check" aria-hidden="true" />}
					{outcome.title}
				</strong>
				<p>{outcome.body}</p>
				<Button ref={confirmRef} tone="primary" className="login-flow-button" onClick={dismissLoginResult}>
					확인
				</Button>
			</div>
		</div>
	);
};

export default LoginFlow;
