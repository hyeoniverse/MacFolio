import { useEffect, useRef, useState } from 'react';

declare global {
	interface Window {
		turnstile?: {
			render(element: HTMLElement, options: Record<string, unknown>): string;
			remove(widgetId: string): void;
		};
	}
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;

/** Turnstile 스크립트는 처음 쓸 때 한 번만 불러온다 */
function loadTurnstile(): Promise<void> {
	loading ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = SCRIPT;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			loading = null;
			reject(new Error('Turnstile을 불러오지 못했습니다.'));
		};
		document.head.append(script);
	});
	return loading;
}

/**
 * Cloudflare Turnstile(무료 사람 확인). 대부분은 아무것도 누르지 않아도 확인이 끝난다.
 * 토큰은 한 번만 쓸 수 있어서, 보내기에 실패하면 부르는 쪽이 resetKey를 바꿔 새로 받는다
 */
const Turnstile = ({
	siteKey,
	resetKey,
	onToken,
}: {
	siteKey: string;
	resetKey: number;
	onToken: (token: string | null) => void;
}) => {
	const box = useRef<HTMLDivElement>(null);
	const handler = useRef(onToken);
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		handler.current = onToken;
	});

	useEffect(() => {
		let alive = true;
		let widgetId: string | undefined;
		handler.current(null);
		loadTurnstile()
			.then(() => {
				if (!alive || !box.current || !window.turnstile) return;
				widgetId = window.turnstile.render(box.current, {
					sitekey: siteKey,
					theme: 'auto',
					language: 'ko',
					callback: (token: string) => handler.current(token),
					'expired-callback': () => handler.current(null),
					'error-callback': () => handler.current(null),
				});
			})
			.catch(() => alive && setFailed(true));
		return () => {
			alive = false;
			if (widgetId) window.turnstile?.remove(widgetId);
		};
	}, [siteKey, resetKey]);

	return (
		<div className="mail-turnstile">
			<div ref={box} />
			{failed && (
				<p className="mail-error" role="alert">
					사람 확인을 불러오지 못했습니다. 새로고침해 주세요.
				</p>
			)}
		</div>
	);
};

export default Turnstile;
