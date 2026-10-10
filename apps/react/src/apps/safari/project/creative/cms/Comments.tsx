import React, { useState } from 'react';

const NICKNAMES = ['🦊 여우', '🐳 고래', '🦉 부엉이', '🐢 거북이', '🦦 수달', '🐧 펭귄', '🦔 고슴도치'];
const REACTIONS = ['👍', '👎', '😄', '🎉', '😕', '❤️', '🚀', '👀'];

/**
 * 로그인 없는 댓글: 닉네임을 섞어 고르고, 이모지 반응 8종을 누르고, 지우면 내용을 보존한 채 가려졌다가 관리자가 되살린다.
 * 같은 브라우저는 저장된 식별자로 자동 인증, 다른 기기에서는 비밀번호로 인증한다
 */
export const Comments: React.FC = () => {
	const [nick, setNick] = useState(0);
	const [counts, setCounts] = useState<Record<string, number>>({ '👍': 3, '🎉': 1, '❤️': 2 });
	const [mine, setMine] = useState<string[]>([]);
	const [deleted, setDeleted] = useState(false);
	const [device, setDevice] = useState<'same' | 'other'>('same');
	const react = (emoji: string) => {
		const on = mine.includes(emoji);
		setMine((now) => (on ? now.filter((item) => item !== emoji) : [...now, emoji]));
		setCounts((now) => ({ ...now, [emoji]: (now[emoji] ?? 0) + (on ? -1 : 1) }));
	};

	return (
		<div className="cm-comments">
			<article className="cm-comment" data-deleted={deleted || undefined}>
				<header>
					<b>{NICKNAMES[nick]}</b>
					<button
						type="button"
						className="cm-shuffle"
						aria-label="닉네임 섞기"
						disabled={deleted}
						onClick={() => setNick((n) => (n + 1 + Math.floor(Math.random() * 5)) % NICKNAMES.length)}
					>
						<i className="fa-solid fa-shuffle" />
					</button>
					<small>방금</small>
				</header>
				<p>
					{deleted ? (
						<em>삭제된 댓글입니다 · 원문은 관리자만 볼 수 있게 보존</em>
					) : (
						<>
							<b>마크다운</b>도 됩니다. 스크립트는 <code>DOMPurify</code>가 걸러 냅니다.
						</>
					)}
				</p>
				<ul className="cm-reactions">
					{REACTIONS.map((emoji) => (
						<li key={emoji}>
							<button type="button" aria-pressed={mine.includes(emoji)} disabled={deleted} onClick={() => react(emoji)}>
								{emoji} {counts[emoji] ? <span>{counts[emoji]}</span> : null}
							</button>
						</li>
					))}
				</ul>
			</article>
			<div className="cm-row">
				<div className="cd-seg" role="group" aria-label="어디서 고치나">
					<button type="button" aria-pressed={device === 'same'} onClick={() => setDevice('same')}>
						같은 브라우저
					</button>
					<button type="button" aria-pressed={device === 'other'} onClick={() => setDevice('other')}>
						다른 기기
					</button>
				</div>
				{deleted ? (
					<button type="button" className="cd-ghost" onClick={() => setDeleted(false)}>
						<i className="fa-solid fa-rotate-left" /> 관리자: 되살리기
					</button>
				) : (
					<button type="button" className="cd-ghost" onClick={() => setDeleted(true)}>
						지우기
					</button>
				)}
			</div>
			<p className="cm-result" role="status">
				{device === 'same'
					? '같은 브라우저: 저장해 둔 식별자(SHA-256)로 비밀번호 없이 고치고 지웁니다'
					: '다른 기기: 쓸 때 정한 비밀번호(Bcrypt)로 확인한 뒤에만 고치고 지웁니다'}
			</p>
		</div>
	);
};
