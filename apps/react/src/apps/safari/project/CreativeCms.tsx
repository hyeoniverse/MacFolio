// HYEONIVERSE 관리자와 CMS 장의 직접 만져 보는 도식들: 그림 대신 그 규칙대로 움직이는 작은 화면.
// 세 겹 자동 저장과 버전 확인, 글 한 편의 일생, 로그인 없는 댓글, 메일함, GitHub 로그인과 초대
import React, { useEffect, useRef, useState } from 'react';
import '@/apps/safari/project/CreativeCms.css';
import { KITCHEN_EMOJIS, KITCHEN_PAIRS } from '@/apps/safari/project/CreativeKitchenData';

/** 자동 저장이 서버에 수정본을 남기기까지 기다리는 시간 (그 사이트와 같다) */
const IDLE_MS = 3000;

type Lane = 'local' | 'server' | 'beacon';
const LANES: { key: Lane; when: string; what: string; note: string }[] = [
	{ key: 'local', when: '즉시', what: '브라우저 저장소', note: '새로고침 · 탭 종료 대비' },
	{ key: 'server', when: '3초 입력 없음', what: '서버 수정본', note: 'revisions · 되돌리기용' },
	{ key: 'beacon', when: '페이지 이탈', what: 'sendBeacon', note: '마지막 변경 전송' },
];

/**
 * 세 겹 자동 저장과 버전 확인: 글을 고치면 브라우저 저장이 바로 켜지고, 3초 손을 떼면 서버 수정본이 쌓이고,
 * 떠나기를 누르면 마지막 변경을 보낸다. 저장할 때는 열 때 받은 버전과 서버 버전을 비교해, 다른 화면이 먼저 저장했으면 409
 */
export const Autosave: React.FC = () => {
	const [text, setText] = useState('자동 저장은 세 겹으로 일어납니다.');
	const [flash, setFlash] = useState<Record<Lane, number>>({ local: 0, server: 0, beacon: 0 });
	const [waiting, setWaiting] = useState(false);
	const [revisions, setRevisions] = useState(3);
	const [opened, setOpened] = useState(7);
	const [server, setServer] = useState(7);
	const [other, setOther] = useState(false);
	const [result, setResult] = useState<'ok' | 'conflict' | null>(null);
	const idle = useRef(0);
	useEffect(() => () => window.clearTimeout(idle.current), []);
	const light = (lane: Lane) => setFlash((now) => ({ ...now, [lane]: now[lane] + 1 }));

	const type = (value: string) => {
		setText(value);
		setResult(null);
		light('local');
		setWaiting(true);
		window.clearTimeout(idle.current);
		idle.current = window.setTimeout(() => {
			setWaiting(false);
			setRevisions((n) => n + 1);
			light('server');
		}, IDLE_MS);
	};
	const save = () => {
		// 다른 화면이 먼저 저장했다면 서버 버전이 이미 하나 올라가 있다
		const current = other ? server + 1 : server;
		if (other) setServer(current);
		if (current !== opened) {
			setResult('conflict');
			return;
		}
		setServer(current + 1);
		setOpened(current + 1);
		setResult('ok');
	};
	const reopen = () => {
		setOpened(server);
		setOther(false);
		setResult(null);
	};

	return (
		<div className="cm-save">
			<label className="cm-save-editor">
				<span>편집기</span>
				<textarea value={text} rows={2} onChange={(event) => type(event.target.value)} />
			</label>
			<ol className="cm-lanes">
				{LANES.map((lane) => (
					<li
						key={lane.key}
						data-waiting={(lane.key === 'server' && waiting) || undefined}
						data-count={flash[lane.key] > 0 || undefined}
					>
						<span className="cm-lane-when">{lane.when}</span>
						<span className="cm-lane-box" key={flash[lane.key]} data-flash={flash[lane.key] > 0 || undefined}>
							<strong>{lane.what}</strong>
							<small>
								{lane.key === 'server' ? `${lane.note} · ${revisions}개` : lane.note}
								{lane.key === 'server' && waiting && ' · 손을 떼면 3초 뒤'}
							</small>
							{lane.key === 'server' && <i className="cm-lane-timer" aria-hidden="true" key={text} />}
						</span>
					</li>
				))}
			</ol>
			<div className="cm-save-version">
				<p>
					열 때 받은 버전 <b>v{opened}</b> · 서버 버전 <b>v{other && result !== 'conflict' ? server + 1 : server}</b>
				</p>
				<label className="cm-check">
					<input type="checkbox" checked={other} onChange={(event) => setOther(event.target.checked)} /> 다른 화면에서
					먼저 저장
				</label>
				<div className="cm-row">
					<button type="button" className="cd-primary" onClick={save}>
						저장
					</button>
					<button type="button" className="cd-ghost" onClick={() => light('beacon')}>
						페이지 떠나기
					</button>
					{result === 'conflict' && (
						<button type="button" className="cd-ghost" onClick={reopen}>
							새로 받기
						</button>
					)}
				</div>
				<p className="cm-result" data-kind={result ?? undefined} role="status">
					{result === 'ok'
						? `버전이 같아 저장했습니다 · v${opened}`
						: result === 'conflict'
							? '409 Conflict · 다른 화면이 먼저 저장해 덮어쓰지 않았습니다'
							: '글을 고쳐 보고, 다른 화면에서 먼저 저장한 뒤 저장해 보세요'}
				</p>
			</div>
		</div>
	);
};

type Stage = 'draft' | 'scheduled' | 'published' | 'trash' | 'purged';
const STAGES: { key: Stage; label: string }[] = [
	{ key: 'draft', label: '초안' },
	{ key: 'scheduled', label: '예약' },
	{ key: 'published', label: '발행' },
	{ key: 'trash', label: '휴지통' },
	{ key: 'purged', label: '영구 삭제' },
];

/**
 * 글 한 편의 일생: 초안을 예약하면 DB 안의 pg_cron이 매분 확인해 발행하고, 저장마다 버전이 오르고, 지우면 휴지통에서
 * 30일(인기 글은 90일) 뒤 매일 03:00 정리 작업이 영구 삭제한다. 단추로 넘기며 칼럼 값이 바뀌는 모습을 본다
 */
export const Lifecycle: React.FC = () => {
	const [stage, setStage] = useState<Stage>('draft');
	const [version, setVersion] = useState(1);
	const [popular, setPopular] = useState(false);
	const [cron, setCron] = useState<string | null>(null);
	const timer = useRef(0);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const runCron = (label: string, next: Stage) => {
		setCron(label);
		timer.current = window.setTimeout(() => {
			setCron(null);
			setStage(next);
		}, 1400);
	};
	const at = STAGES.findIndex((item) => item.key === stage);
	const days = popular ? 90 : 30;
	const columns: [string, string][] = [
		['published', String(stage === 'published')],
		['scheduled_at', stage === 'scheduled' ? "'오늘 09:00'" : 'null'],
		['version', stage === 'purged' ? '—' : String(version)],
		['deleted_at', stage === 'trash' ? "'방금'" : 'null'],
		['purge_after', stage === 'trash' ? `'${days}일 뒤'` : 'null'],
	];

	return (
		<div className="cm-life">
			<ol className="cm-life-track">
				{STAGES.map((item, i) => (
					<li key={item.key} data-done={i < at || undefined} data-now={i === at || undefined}>
						<span>{item.label}</span>
					</li>
				))}
			</ol>
			<div className="cm-life-card" data-stage={stage}>
				<p className="cm-life-title">{stage === 'purged' ? '사라진 글' : '혼자 운영하는 서비스의 설계'}</p>
				<dl>
					{columns.map(([name, value]) => (
						<div key={name}>
							<dt>{name}</dt>
							<dd key={value}>{value}</dd>
						</div>
					))}
				</dl>
				{/* 정리 작업 문구 자리는 늘 잡아 두어, 문구가 떠도 카드 크기가 바뀌지 않는다 */}
				<p className="cm-life-cron" role="status" data-on={cron ? '' : undefined}>
					{cron && (
						<>
							<i className="fa-solid fa-clock" /> {cron}
						</>
					)}
				</p>
			</div>
			<div className="cm-row">
				{stage === 'draft' && (
					<>
						<button type="button" className="cd-primary" onClick={() => setStage('scheduled')}>
							예약하기
						</button>
						<button type="button" className="cd-ghost" onClick={() => setStage('published')}>
							바로 발행
						</button>
					</>
				)}
				{stage === 'scheduled' && (
					<button
						type="button"
						className="cd-primary"
						disabled={!!cron}
						onClick={() => runCron('pg_cron이 매분 확인 · 예약 시각이 지나 발행합니다', 'published')}
					>
						예약 시각 지나기
					</button>
				)}
				{stage === 'published' && (
					<>
						<button type="button" className="cd-primary" onClick={() => setVersion((n) => n + 1)}>
							고쳐 저장 (버전 +1)
						</button>
						<button type="button" className="cd-ghost" onClick={() => setStage('trash')}>
							지우기
						</button>
					</>
				)}
				{stage === 'trash' && (
					<>
						<button type="button" className="cd-ghost" disabled={!!cron} onClick={() => setStage('published')}>
							복구
						</button>
						<button
							type="button"
							className="cd-primary"
							disabled={!!cron}
							onClick={() => runCron(`${days}일이 지나 매일 03:00 정리 작업이 지웁니다`, 'purged')}
						>
							{days}일 지나기
						</button>
						<label className="cm-check">
							<input type="checkbox" checked={popular} onChange={(event) => setPopular(event.target.checked)} /> 인기 글
							(90일 보관)
						</label>
					</>
				)}
				{stage === 'purged' && (
					<button
						type="button"
						className="cd-ghost"
						onClick={() => {
							setStage('draft');
							setVersion(1);
						}}
					>
						처음부터
					</button>
				)}
			</div>
		</div>
	);
};

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

const MAILS = [
	{
		icon: 'fa-reply',
		from: '답글 알림',
		title: '남긴 댓글에 답글이 달렸습니다',
		body: '댓글을 쓸 때 메일을 적어 둔 사람에게만 보냅니다.',
	},
	{
		icon: 'fa-user-plus',
		from: '작성자 초대',
		title: 'HYEONIVERSE 저자로 초대되었습니다',
		body: '이 메일 주소로 GitHub 로그인을 하면 역할이 붙습니다.',
	},
	{
		icon: 'fa-laptop',
		from: '새 기기 확인',
		title: '처음 보는 기기에서 로그인했습니다',
		body: '24시간 안에 링크를 눌러야 그 기기에서 들어올 수 있습니다.',
	},
	{
		icon: 'fa-clock',
		from: '예약 발행',
		title: '예약한 글 1편을 발행했습니다',
		body: 'Next.js가 아니라 DB(pg_net)가 Resend로 직접 보냅니다.',
	},
];

/** 메일함: 사이트가 Resend로 보내는 메일 네 가지가 화면에 들어오면 하나씩 도착하고, 누르면 내용을 펼친다 */
export const Mailbox: React.FC = () => {
	const box = useRef<HTMLDivElement>(null);
	const [arrived, setArrived] = useState(0);
	const [open, setOpen] = useState<number | null>(null);
	useEffect(() => {
		const node = box.current;
		if (!node || typeof IntersectionObserver === 'undefined') {
			setArrived(MAILS.length);
			return;
		}
		let timer = 0;
		const observer = new IntersectionObserver(([entry]) => {
			if (!entry.isIntersecting) return;
			observer.disconnect();
			const next = (n: number) => {
				setArrived(n);
				if (n < MAILS.length) timer = window.setTimeout(() => next(n + 1), 600);
			};
			next(1);
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			window.clearTimeout(timer);
		};
	}, []);

	return (
		<div className="cm-mail" ref={box}>
			<p className="cm-mail-head">
				<i className="fa-solid fa-inbox" /> 받은편지함 <span>{arrived}</span>
			</p>
			<ul>
				{MAILS.map((mail, i) => (
					<li key={mail.from} data-in={i < arrived || undefined} data-open={open === i || undefined}>
						<button type="button" onClick={() => setOpen(open === i ? null : i)} disabled={i >= arrived}>
							<i className={`fa-solid ${mail.icon}`} aria-hidden="true" />
							<span>
								<small>{mail.from}</small>
								<b>{mail.title}</b>
							</span>
						</button>
						<p>{mail.body}</p>
					</li>
				))}
			</ul>
		</div>
	);
};

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

type Role = 'owner' | 'admin' | 'author' | 'visitor';
const ROLES: { key: Role; label: string }[] = [
	{ key: 'owner', label: '소유자' },
	{ key: 'admin', label: '관리자' },
	{ key: 'author', label: '저자' },
	{ key: 'visitor', label: '방문자' },
];
/** 동작마다 할 수 있는 역할 (그 사이트의 RLS 정책과 같다) */
const ACTIONS: { label: string; roles: Role[] }[] = [
	{ label: '공개 글 읽기 · 댓글 · 좋아요', roles: ['owner', 'admin', 'author', 'visitor'] },
	{ label: '자기 글 작성 · 수정 · 삭제', roles: ['owner', 'admin', 'author'] },
	{ label: '모든 글 · 작업물 편집', roles: ['owner', 'admin'] },
	{ label: '댓글 · 신고 중재 · 대시보드', roles: ['owner', 'admin'] },
	{ label: '사이트 설정', roles: ['owner'] },
	{ label: '저자 초대 · 권한 관리', roles: ['owner'] },
];

/**
 * 누가 무엇을 할 수 있나: 역할을 고르면 그 역할 칸이 강조되고, 동작을 누르면 DB의 RLS 정책이 JWT의 app_metadata에서
 * 역할을 읽어 허용하거나 막는다. API 코드가 확인을 빠뜨려도 DB가 마지막에 막는다
 */
export const Roles: React.FC = () => {
	const [role, setRole] = useState<Role>('author');
	const [picked, setPicked] = useState<number | null>(null);
	const action = picked === null ? null : ACTIONS[picked];
	const allowed = action ? action.roles.includes(role) : false;
	const name = ROLES.find((item) => item.key === role)?.label;

	return (
		<div className="cm-roles">
			<div className="cd-seg" role="group" aria-label="누구로 해 볼까">
				{ROLES.map((item) => (
					<button
						key={item.key}
						type="button"
						aria-pressed={role === item.key}
						onClick={() => {
							setRole(item.key);
							setPicked(null);
						}}
					>
						{item.label}
					</button>
				))}
			</div>
			<table className="cm-roles-table">
				<thead>
					<tr>
						<th scope="col">동작</th>
						{ROLES.map((item) => (
							<th key={item.key} scope="col" data-on={role === item.key || undefined}>
								{item.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{ACTIONS.map((row, i) => (
						<tr key={row.label} data-picked={picked === i || undefined} data-ok={row.roles.includes(role) || undefined}>
							<th scope="row">
								<button type="button" onClick={() => setPicked(i)}>
									{row.label}
								</button>
							</th>
							{ROLES.map((item) => (
								<td key={item.key} data-on={role === item.key || undefined}>
									{row.roles.includes(item.key) ? (
										<i className="cm-dot" aria-label="할 수 있음" />
									) : (
										<span aria-label="할 수 없음">—</span>
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			<p className="cm-result" data-kind={action ? (allowed ? 'ok' : 'conflict') : undefined} role="status">
				{action
					? allowed
						? `${name}: ${action.label} → 허용 · RLS가 auth.jwt()의 app_metadata.role을 보고 통과시킵니다`
						: `${name}: ${action.label} → 거부 · API가 확인을 빠뜨려도 DB의 RLS 정책이 막습니다`
					: '역할을 고르고, 해 볼 동작을 눌러 보세요. 역할은 사용자가 바꿀 수 없는 app_metadata에 있습니다'}
			</p>
		</div>
	);
};

/** 조합 그림 주소 (그 사이트 lib/emojiKitchen과 같다): gstatic은 코드포인트 덩어리마다 u를 붙인다 */
const kitchenUrl = ([date, left, right]: [string, string, string]) => {
	const u = (code: string) => `u${code.split('-').join('-u')}`;
	return `https://www.gstatic.com/android/keyboard/emojikitchen/${date}/${u(left)}/${u(left)}_${u(right)}.png`;
};

/**
 * 이모지 키친: 이모지 두 개를 고르면 Google Gboard가 섞어 그린 그림이 나온다. 그 사이트는 조합 14만 7천 개를 가벼운
 * 목록(meta.json + pairs.bin)으로 줄여 두고, 고른 조합을 커스텀 이모지로 가져와 글과 댓글에 쓴다
 */
export const Kitchen: React.FC = () => {
	const [left, setLeft] = useState(KITCHEN_EMOJIS[0]);
	const [right, setRight] = useState(KITCHEN_EMOJIS[3]);
	const [broken, setBroken] = useState<string | null>(null);
	const pair = KITCHEN_PAIRS[`${left}+${right}`] ?? KITCHEN_PAIRS[`${right}+${left}`];
	const src = pair ? kitchenUrl(pair) : null;
	const row = (value: string, set: (emoji: string) => void, label: string) => (
		<div className="cm-kitchen-row" role="group" aria-label={label}>
			{KITCHEN_EMOJIS.map((emoji) => (
				<button key={emoji} type="button" aria-pressed={value === emoji} onClick={() => set(emoji)}>
					{emoji}
				</button>
			))}
		</div>
	);

	return (
		<div className="cm-kitchen">
			{row(left, setLeft, '첫 이모지')}
			<div className="cm-kitchen-mix">
				<span>{left}</span>
				<i className="fa-solid fa-plus" aria-hidden="true" />
				<span>{right}</span>
				<i className="fa-solid fa-equals" aria-hidden="true" />
				<figure>
					{src && broken !== src ? (
						<img key={src} src={src} alt={`${left}와 ${right}를 섞은 이모지`} onError={() => setBroken(src)} />
					) : (
						<em>{src ? '그림을 불러오지 못했습니다' : '이 둘은 조합이 없습니다'}</em>
					)}
				</figure>
			</div>
			{row(right, setRight, '둘째 이모지')}
		</div>
	);
};

type Feature = 'translation' | 'summary' | 'cover' | 'tts';
/** cost: 요청 한 번에 쓰는 양 (번역은 글자, 음성은 바이트, 나머지는 번) */
const FEATURES: { key: Feature; label: string; providers: string[]; cost: number }[] = [
	{ key: 'translation', label: '번역', providers: ['DeepL', 'Google Translate', 'Gemini', 'Claude'], cost: 1_800 },
	{ key: 'summary', label: '요약', providers: ['Gemini', 'OpenAI', 'Claude'], cost: 1 },
	{ key: 'cover', label: '커버', providers: ['NanoBanana', 'Hugging Face'], cost: 1 },
	{ key: 'tts', label: '음성', providers: ['Fish Audio', 'Google Cloud TTS', 'Edge'], cost: 24_000 },
];

/** 실패 원인 (그 사이트의 FailureKind). fatal은 사람이 고쳐야 풀리는 원인 */
type Kind = 'network' | 'rate_limit' | 'server' | 'invalid_key' | 'expired' | 'forbidden' | 'quota' | 'billing';
const KINDS: Record<Kind, { label: string; fatal: boolean }> = {
	network: { label: '시간 초과', fatal: false },
	rate_limit: { label: '요청 속도 제한(429)', fatal: false },
	server: { label: '서버 오류(503)', fatal: false },
	invalid_key: { label: '키 오류(401)', fatal: true },
	expired: { label: '키 만료', fatal: true },
	forbidden: { label: '권한 없음(403)', fatal: true },
	quota: { label: '한도 초과', fatal: true },
	billing: { label: '결제 필요', fatal: true },
};
/** 같은 원인으로 이만큼 이어 실패하면 그 공급자를 끈다: 사람이 고쳐야 하는 원인은 3번, 저절로 풀릴 수 있는 원인은 5번 */
const FATAL_LIMIT = 3;
const TRANSIENT_LIMIT = 5;

/**
 * 공급자마다 미리 정해 둔 성향: 이번 달 사용량, 무료 한도(또는 한도 설명), 실패할 확률과 그때의 원인.
 * 응답은 무작위지만, 몇 번 보내다 보면 대체·한도 초과·자동으로 꺼짐·키 없음·앱 상한을 모두 겪게 짜 두었다
 */
type Profile = {
	used: number;
	unit: string;
	/** 한 달 무료 한도 (넘으면 한도 초과) */
	limit?: number;
	/** 이 앱이 스스로 멈추는 상한 (넘을 요청은 보내지 않는다) */
	cap?: number;
	/** 한도를 숫자로 모를 때의 설명 */
	note?: string;
	/** 키가 없으면 부르지 않고 건너뛴다 (실패로 세지 않는다) */
	noKey?: boolean;
	fail: number;
	kinds: Kind[];
	/** 화면에 보이는 성향 한 줄 */
	trait: string;
};
const PROFILES: Record<string, Profile> = {
	DeepL: {
		used: 482_000,
		limit: 500_000,
		unit: '자',
		fail: 0.1,
		kinds: ['network'],
		trait: '무료 한도 직전',
	},
	'Google Translate': {
		used: 61_000,
		limit: 500_000,
		unit: '자',
		fail: 0.6,
		kinds: ['rate_limit', 'server'],
		trait: '자주 불안정',
	},
	Gemini: {
		used: 214,
		unit: '번',
		note: '무료 등급은 분·하루 요청 수 제한',
		fail: 0.35,
		kinds: ['rate_limit'],
		trait: '가끔 429',
	},
	Claude: {
		used: 12,
		unit: '번',
		note: '무료 한도 없음 · 선불 크레딧',
		fail: 0.5,
		kinds: ['billing'],
		trait: '크레딧 바닥',
	},
	OpenAI: {
		used: 3,
		unit: '번',
		note: '무료 한도 없음 · 선불 크레딧',
		fail: 0.6,
		kinds: ['quota', 'expired'],
		trait: '키 만료 임박',
	},
	NanoBanana: { used: 0, unit: '번', note: '무료 한도 없음 · 유료', noKey: true, fail: 0, kinds: [], trait: '키 없음' },
	'Hugging Face': {
		used: 9,
		unit: '번',
		note: '월 무료 크레딧 소량',
		fail: 0.4,
		kinds: ['server', 'network'],
		trait: '모델 깨우는 중 503',
	},
	'Fish Audio': {
		used: 41_200,
		unit: '바이트',
		note: '2026-11-30까지 무료',
		fail: 0.25,
		kinds: ['network', 'forbidden'],
		trait: '가끔 시간 초과',
	},
	'Google Cloud TTS': {
		used: 776_000,
		limit: 1_000_000,
		cap: 800_000,
		unit: '바이트',
		fail: 0.05,
		kinds: ['server'],
		trait: '앱 상한 80만 직전',
	},
	Edge: { used: 31, unit: '번', note: '키 없이 무료', fail: 0.1, kinds: ['network'], trait: '키 없이 무료' },
};
type Health = { fatal: number; transient: number; last?: Kind };
const HEALTHY: Health = { fatal: 0, transient: 0 };
type Step = { name: string; outcome: string; ok?: boolean; skip?: boolean };

const isOff = (health: Health | undefined) =>
	!!health && (health.fatal >= FATAL_LIMIT || health.transient >= TRANSIENT_LIMIT);

/**
 * 공급자 고르기와 대체 차례, 사용량: 기능마다 기본 공급자와 대체 차례를 정하고, 이번 달 사용량을 무료 한도와 함께 본다.
 * 요청을 보내면 공급자마다 미리 정한 확률로 성공하거나 실패하고, 성공하면 사용량이 오른다. 같은 원인으로 이어 실패하면
 * 꺼지고, 다음 달로 넘기면 사용량과 한도·일시 오류로 꺼진 공급자가 풀린다 (키·결제 문제는 사람이 고쳐야 풀린다)
 */
export const Providers: React.FC = () => {
	const [feature, setFeature] = useState<Feature>('translation');
	const [orders, setOrders] = useState<Record<Feature, string[]>>(
		() => Object.fromEntries(FEATURES.map((item) => [item.key, item.providers])) as Record<Feature, string[]>
	);
	const [fallback, setFallback] = useState(true);
	const [usage, setUsage] = useState<Record<string, number>>(() =>
		Object.fromEntries(Object.entries(PROFILES).map(([name, profile]) => [name, profile.used]))
	);
	const [health, setHealth] = useState<Record<string, Health>>({});
	const [month, setMonth] = useState(10);
	const [busy, setBusy] = useState(false);
	const [trail, setTrail] = useState<Step[] | null>(null);
	const timer = useRef<number>(undefined);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const current = FEATURES.find((item) => item.key === feature)!;
	const order = orders[feature];
	const move = (i: number, dir: number) => {
		const next = [...order];
		[next[i], next[i + dir]] = [next[i + dir], next[i]];
		setOrders((now) => ({ ...now, [feature]: next }));
		setTrail(null);
	};

	// 차례대로 시도한다: 꺼졌거나 키가 없거나 앱 상한에 닿으면 건너뛰고, 무료 한도를 넘을 요청은 한도 초과,
	// 나머지는 그 공급자의 확률로 성공하거나 실패한다. 성공하면 이어진 실패를 지우고 사용량을 더한다
	const send = () => {
		const steps: Step[] = [];
		const nextHealth = { ...health };
		const nextUsage = { ...usage };
		for (const name of fallback ? order : order.slice(0, 1)) {
			const profile = PROFILES[name];
			const state = nextHealth[name] ?? HEALTHY;
			const used = nextUsage[name];
			if (isOff(state)) {
				steps.push({ name, outcome: '꺼짐', skip: true });
				continue;
			}
			if (profile.noKey) {
				steps.push({ name, outcome: '키 없음', skip: true });
				continue;
			}
			if (profile.cap && used + current.cost > profile.cap) {
				steps.push({ name, outcome: '앱 상한이라 보내지 않음', skip: true });
				continue;
			}
			const kind: Kind | null =
				profile.limit && used + current.cost > profile.limit
					? 'quota'
					: Math.random() < profile.fail
						? profile.kinds[Math.floor(Math.random() * profile.kinds.length)]
						: null;
			if (kind) {
				const fatal = KINDS[kind].fatal;
				// 원인이 바뀌면 그 갈래의 횟수는 새로 센다
				nextHealth[name] = {
					fatal: fatal ? (state.last === kind ? state.fatal : 0) + 1 : state.fatal,
					transient: fatal ? state.transient : state.transient + 1,
					last: kind,
				};
				steps.push({ name, outcome: KINDS[kind].label });
				continue;
			}
			nextHealth[name] = HEALTHY;
			nextUsage[name] = used + current.cost;
			steps.push({ name, outcome: `+${current.cost.toLocaleString()}${profile.unit}`, ok: true });
			break;
		}
		setBusy(true);
		setTrail(null);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			setHealth(nextHealth);
			setUsage(nextUsage);
			setTrail(steps);
			setBusy(false);
		}, 500);
	};

	// 다음 달: 사용량은 0부터, 한도·일시 오류로 꺼진 공급자는 다시 시도한다. 키·결제·권한 문제는 그대로
	const nextMonth = () => {
		setMonth((now) => (now % 12) + 1);
		setUsage(Object.fromEntries(Object.keys(PROFILES).map((name) => [name, 0])));
		setHealth((now) =>
			Object.fromEntries(
				Object.entries(now).filter(([, state]) => state.last && KINDS[state.last].fatal && state.last !== 'quota')
			)
		);
		setTrail(null);
	};
	const handled = trail?.find((item) => item.ok);

	return (
		<div className="cm-providers">
			<div className="cm-row">
				<div className="cd-seg" role="group" aria-label="기능">
					{FEATURES.map((item) => (
						<button
							key={item.key}
							type="button"
							aria-pressed={feature === item.key}
							onClick={() => {
								setFeature(item.key);
								setTrail(null);
							}}
						>
							{item.label}
						</button>
					))}
				</div>
				<label className="cm-check">
					<input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} /> 실패하면
					다음 공급자로
				</label>
			</div>
			<ol className="cm-providers-list">
				{order.map((name, i) => {
					const profile = PROFILES[name];
					const used = usage[name];
					const ceiling = profile.cap ?? profile.limit;
					const ratio = ceiling ? Math.min(1, used / ceiling) : null;
					const state = health[name] ?? HEALTHY;
					const off = isOff(state);
					const step = trail?.find((item) => item.name === name);
					const amount = `이번 달 ${used.toLocaleString()}${ceiling ? ` / ${ceiling.toLocaleString()}` : ''}${profile.unit}`;
					return (
						<li
							key={name}
							data-off={off || undefined}
							data-idle={(!fallback && i > 0) || undefined}
							data-hit={step ? (step.ok ? 'ok' : step.skip ? 'skip' : 'fail') : undefined}
						>
							<span className="cm-providers-rank">{i === 0 ? '기본' : `대체 ${i}`}</span>
							<div className="cm-providers-name">
								<b>
									{name} <em>{profile.trait}</em>
								</b>
								<small>
									{off
										? `꺼짐 · ${state.last ? KINDS[state.last].label : ''} ${
												state.fatal >= FATAL_LIMIT ? FATAL_LIMIT : TRANSIENT_LIMIT
											}번 이어져`
										: profile.noKey
											? `키가 없어 건너뜁니다 · ${profile.note}`
											: `${amount}${profile.cap ? ' (앱 상한)' : ''}${profile.note ? ` · ${profile.note}` : ''}${
													state.fatal || state.transient
														? ` · 이어진 실패 ${
																state.last && KINDS[state.last].fatal
																	? `${state.fatal}/${FATAL_LIMIT}`
																	: `${state.transient}/${TRANSIENT_LIMIT}`
															}`
														: ''
												}`}
								</small>
								{ratio !== null && (
									<i className="cm-providers-bar" data-high={ratio > 0.75 || undefined}>
										<i style={{ width: `${ratio * 100}%` }} />
									</i>
								)}
							</div>
							<div className="cm-providers-tools">
								<button type="button" aria-label={`${name} 위로`} disabled={i === 0} onClick={() => move(i, -1)}>
									<i className="fa-solid fa-chevron-up" />
								</button>
								<button
									type="button"
									aria-label={`${name} 아래로`}
									disabled={i === order.length - 1}
									onClick={() => move(i, 1)}
								>
									<i className="fa-solid fa-chevron-down" />
								</button>
								{/* 꺼진 공급자는 키를 바꾸거나 직접 다시 켠다. 자리는 늘 잡아 둬 칸 폭이 바뀌지 않는다 */}
								<button
									type="button"
									className="cm-providers-revive"
									aria-label={`${name} 다시 켜기`}
									disabled={!off}
									onClick={() => setHealth((now) => ({ ...now, [name]: HEALTHY }))}
								>
									다시 켜기
								</button>
							</div>
						</li>
					);
				})}
			</ol>
			<div className="cm-row">
				<button type="button" className="cd-primary" onClick={send} disabled={busy}>
					{busy ? '보내는 중…' : '요청 보내기'}
				</button>
				<button type="button" className="cd-ghost" onClick={nextMonth}>
					{(month % 12) + 1}월로 넘기기
				</button>
			</div>
			<p className="cm-result" role="status" data-kind={trail ? (handled ? 'ok' : 'conflict') : undefined}>
				{trail
					? `${trail.map((item) => `${item.name} ${item.outcome}`).join(' → ')}${
							handled
								? ` · ${handled.name}에서 처리했습니다`
								: fallback
									? ' · 모든 공급자가 실패해 관리자 알림에 남습니다'
									: ' · 대체를 꺼서 여기서 실패합니다'
						}`
					: '공급자마다 성향이 달라, 여러 번 보내 보면 대체·한도 초과·자동으로 꺼짐·키 없음·앱 상한을 모두 겪습니다'}
			</p>
		</div>
	);
};
