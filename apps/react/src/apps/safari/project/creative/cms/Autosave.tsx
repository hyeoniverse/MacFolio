import React, { useEffect, useRef, useState } from 'react';

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
