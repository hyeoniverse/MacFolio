import React, { useEffect, useRef, useState } from 'react';

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
