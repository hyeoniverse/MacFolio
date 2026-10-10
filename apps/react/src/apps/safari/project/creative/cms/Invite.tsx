import React, { useEffect, useRef, useState } from 'react';

type Who = 'invited' | 'stranger' | 'owner';
const PEOPLE: { key: Who; label: string; email: string }[] = [
	{ key: 'invited', label: '초대받은 사람', email: 'writer@example.com' },
	{ key: 'stranger', label: '모르는 사람', email: 'someone@example.com' },
	{ key: 'owner', label: '소유자', email: 'owner@example.com' },
];
const GATES = ['OWNER_EMAIL인가', '이미 역할이 있나', '초대 행이 있나'];
/** 사람마다 세 관문의 결과 */
const PASSES: Record<Who, boolean[]> = {
	owner: [true, false, false],
	invited: [false, false, true],
	stranger: [false, false, false],
};

/**
 * GitHub 로그인과 초대: OAuth는 누구인지만 알려 주고, 들여보낼지는 서버의 /auth/callback이 정한다.
 * 소유자 메일인지, 이미 역할이 있는지, 초대 행이 있는지 차례로 보고, 하나도 아니면 그 계정을 지운다
 */
export const Invite: React.FC = () => {
	const [who, setWho] = useState<Who | null>(null);
	const [step, setStep] = useState(0);
	const timer = useRef(0);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const login = (key: Who) => {
		setWho(key);
		setStep(0);
		window.clearTimeout(timer.current);
		const passes = PASSES[key];
		const stop = passes.indexOf(true);
		const last = stop < 0 ? GATES.length : stop + 1;
		const next = (n: number) => {
			setStep(n);
			if (n < last) timer.current = window.setTimeout(() => next(n + 1), 550);
		};
		timer.current = window.setTimeout(() => next(1), 300);
	};
	const passes = who ? PASSES[who] : [];
	const stop = passes.indexOf(true);
	const last = stop < 0 ? GATES.length : stop + 1;
	const done = who !== null && step >= last;
	const allowed = done && stop >= 0;

	return (
		<div className="cm-invite">
			<p className="cm-invite-step">
				<i className="fa-brands fa-github" /> GitHub로 로그인할 사람
			</p>
			<div className="cm-row">
				{PEOPLE.map((person) => (
					<button
						key={person.key}
						type="button"
						className="cd-ghost"
						aria-pressed={who === person.key}
						onClick={() => login(person.key)}
					>
						{person.label}
					</button>
				))}
			</div>
			<ol className="cm-gates">
				{GATES.map((gate, i) => (
					<li
						key={gate}
						data-state={!who || i >= step ? undefined : passes[i] ? 'pass' : 'fail'}
						data-skip={(who !== null && done && i >= last) || undefined}
					>
						<span>{gate}</span>
						<b>{!who || i >= step ? '' : passes[i] ? '예' : '아니오'}</b>
					</li>
				))}
			</ol>
			<p className="cm-result" data-kind={done ? (allowed ? 'ok' : 'conflict') : undefined} role="status">
				{!who
					? '로그인할 사람을 골라 보세요. /auth/callback이 세 가지를 차례로 봅니다'
					: !done
						? `${PEOPLE.find((person) => person.key === who)?.email} 확인 중`
						: allowed
							? who === 'owner'
								? '들어옵니다 · 소유자 역할을 app_metadata에 한 번 못박습니다'
								: '들어옵니다 · 초대에 적힌 역할을 붙이고 초대를 소비(consumed_at)합니다'
							: '들여보내지 않습니다 · 로그아웃하고 그 계정을 지웁니다'}
			</p>
		</div>
	);
};
