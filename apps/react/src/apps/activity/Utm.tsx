// '활동 상태 보기' 유입 경로 탭의 utm 묶음 (관리자, #211): 링크 생성기, 매체·조합·term·content 표, 조합 하나의 일별 추이
import { useEffect, useId, useState } from 'react';
import Button from '@/shared/ui/button/Button';
import LineChart from './LineChart';
import StatTable from './StatTable';
import { ActivityError, fetchSummary, type Summary } from './activityApi';
import { buildUtmUrl, UTM_FIELDS, UTM_MEDIUMS, UTM_SOURCES, utmLabel, type UtmFields } from './model';

/** 지난 날의 집계(DailyStat)는 다시 모으지 않았다: 새 표는 배포한 날부터 찬다 */
export const UTM_SINCE_NOTE = '이 기능을 배포한 날부터 셉니다. 그 전 날의 집계에는 없습니다.';

const FIELD_LABELS: Record<(typeof UTM_FIELDS)[number], string> = {
	source: '출처 (utm_source)',
	medium: '매체 (utm_medium)',
	campaign: '캠페인 (utm_campaign)',
	term: '검색어 (utm_term)',
	content: '내용 (utm_content)',
};

const EMPTY: UtmFields = { source: '', medium: '', campaign: '', term: '', content: '' };

/**
 * UTM 링크 만들기: 대상 주소(사이트 안 경로를 고르거나 직접)와 출처·매체·캠페인(·term·content)으로 주소를 만들어 복사한다.
 * 만든 링크는 저장하지 않는다 (서버 변경 없음)
 */
export const UtmBuilder = ({ paths }: { paths: string[] }) => {
	const id = useId();
	const [target, setTarget] = useState('/');
	const [fields, setFields] = useState<UtmFields>(EMPTY);
	const [copied, setCopied] = useState(false);
	const url = buildUtmUrl(target, fields, window.location.origin);
	const ready = url !== null && Boolean(fields.source || fields.medium || fields.campaign);

	const copy = async () => {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<details className="utm-builder">
			<summary>UTM 링크 만들기</summary>
			<div className="utm-builder-form">
				<label>
					대상 주소
					<input
						value={target}
						list={`${id}-paths`}
						placeholder="/ 또는 /memo/글-주소 또는 https://…"
						onChange={(event) => {
							setTarget(event.target.value);
							setCopied(false);
						}}
					/>
				</label>
				<datalist id={`${id}-paths`}>
					{paths.map((path) => (
						<option key={path} value={path} />
					))}
				</datalist>
				{UTM_FIELDS.map((name) => (
					<label key={name}>
						{FIELD_LABELS[name]}
						<input
							value={fields[name]}
							list={name === 'source' ? `${id}-sources` : name === 'medium' ? `${id}-mediums` : undefined}
							onChange={(event) => {
								setFields((current) => ({ ...current, [name]: event.target.value }));
								setCopied(false);
							}}
						/>
					</label>
				))}
				<datalist id={`${id}-sources`}>
					{UTM_SOURCES.map((value) => (
						<option key={value} value={value} />
					))}
				</datalist>
				<datalist id={`${id}-mediums`}>
					{UTM_MEDIUMS.map((value) => (
						<option key={value} value={value} />
					))}
				</datalist>
			</div>
			<div className="utm-builder-result">
				<output aria-label="완성된 주소">{url ?? '대상 주소가 올바르지 않습니다'}</output>
				<Button onClick={() => void copy()} disabled={!ready}>
					{copied ? '복사함' : '복사'}
				</Button>
			</div>
			<p className="activity-table-note">
				값은 소문자로, 공백은 -로 바꿉니다 (받는 쪽과 같은 규칙). 만든 링크는 저장하지 않습니다.
			</p>
		</details>
	);
};

/** 조합 하나의 일별 방문 (요약을 utm=으로 다시 묻는다). 조합·기간이 바뀌면 새로 그린다 (key) */
const UtmTrend = ({ from, to, utm }: { from: string; to: string; utm: string }) => {
	const [trend, setTrend] = useState<Summary['utmTrend'] | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let alive = true;
		fetchSummary(from, to, utm)
			.then((summary) => alive && setTrend(summary.utmTrend ?? { key: utm, days: [] }))
			.catch((caught: unknown) => alive && setError(caught instanceof ActivityError ? caught.message : String(caught)));
		return () => {
			alive = false;
		};
	}, [from, to, utm]);

	return (
		<section className="activity-table utm-trend" aria-label={`${utmLabel(utm)} 일별 방문`}>
			<h3>{utmLabel(utm)} · 일별 방문</h3>
			{error ? (
				<p className="activity-empty error">{error}</p>
			) : !trend ? (
				<p className="activity-empty">불러오는 중…</p>
			) : (
				<LineChart days={trend.days} label={`${utmLabel(utm)} 일별 방문`} />
			)}
		</section>
	);
};

/** 관리자 유입 경로의 utm 표: 조합(누르면 추이), 캠페인·출처·매체, 값이 있을 때만 term·content */
export const UtmTables = ({ summary }: { summary: Summary }) => {
	const { breakdown } = summary;
	const [selected, setSelected] = useState<string | null>(null);
	return (
		<>
			<StatTable
				title="출처 / 매체 / 캠페인"
				rows={breakdown.utm}
				metric="utm"
				note={`이름을 누르면 그 조합의 일별 방문이 아래에 펼쳐집니다. ${UTM_SINCE_NOTE}`}
				onSelect={setSelected}
				selected={selected}
			/>
			{selected && (
				<UtmTrend
					key={`${selected}:${summary.from}:${summary.to}`}
					from={summary.from}
					to={summary.to}
					utm={selected}
				/>
			)}
			<div className="activity-columns">
				<StatTable title="캠페인 (utm_campaign)" rows={breakdown.campaign} metric="campaign" />
				<StatTable title="출처 (utm_source)" rows={breakdown.source} metric="source" />
				<StatTable title="매체 (utm_medium)" rows={breakdown.medium} metric="medium" note={UTM_SINCE_NOTE} />
				{breakdown.term.length > 0 && <StatTable title="검색어 (utm_term)" rows={breakdown.term} metric="term" />}
				{breakdown.content.length > 0 && (
					<StatTable title="내용 (utm_content)" rows={breakdown.content} metric="content" />
				)}
			</div>
		</>
	);
};
