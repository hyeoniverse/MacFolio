import type { ResourceStatus } from './data';

const METRIC_LABEL = { cpu: 'CPU', network: '네트워크', memory: '메모리' } as const;
const LEVEL = {
	danger: { label: '회수 위험', note: '지금 사용률이 Oracle의 유휴 회수 기준에 모두 걸려 있습니다.' },
	warning: { label: '주의', note: '사용률이 회수 기준에 가깝습니다.' },
	safe: { label: '안전', note: '사용률이 회수 기준보다 충분히 높습니다.' },
	unknown: { label: '모름', note: '아직 잰 값이 없습니다. 1분마다 잽니다.' },
} as const;

const HEIGHT = 80;
const WIDTH = 600;

/** 한 시간 평균 선 그래프 (최근 7일). max가 없으면 값 중 가장 큰 것 */
const UsageChart = ({
	label,
	unit,
	points,
	max,
	threshold,
}: {
	label: string;
	unit: string;
	points: { at: string; value: number }[];
	max?: number;
	threshold?: number;
}) => {
	// 기준선이 있으면 그 위로 여유를 두어 기준선이 그래프 안에 보이게. 없어도 10% 아래로는 줄이지 않는다 (작은 흔들림이 크게 보이지 않게)
	const top = max ?? Math.max((threshold ?? 8) * 1.25, ...points.map((point) => point.value));
	const x = (index: number) => (points.length <= 1 ? WIDTH / 2 : (index / (points.length - 1)) * WIDTH);
	const y = (value: number) => HEIGHT - (Math.min(value, top) / top) * (HEIGHT - 6) - 2;
	const path = points
		.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`)
		.join(' ');
	const last = points.at(-1);
	return (
		<figure className="activity-chart server-chart">
			<figcaption className="server-chart-title">
				<span>{label}</span>
				<strong>{last ? `${Math.round(last.value * 10) / 10}${unit}` : '—'}</strong>
			</figcaption>
			<svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${label} 최근 7일`}>
				{threshold !== undefined && (
					<line className="threshold" x1="0" x2={WIDTH} y1={y(threshold)} y2={y(threshold)} />
				)}
				{points.length > 0 && <path className="visits" d={path} />}
			</svg>
		</figure>
	);
};

const money = (amount: number, currency: string | null) =>
	currency ? amount.toLocaleString('ko-KR', { style: 'currency', currency }) : amount.toLocaleString('ko-KR');

/** 종량제: 이번 달 요금과 예산 한도 (OCI API 키가 있을 때) */
const Billing = ({ billing }: { billing: NonNullable<ResourceStatus['billing']> }) => {
	if (!billing.configured)
		return (
			<section className="server-billing" aria-label="요금">
				<h3>요금</h3>
				<p className="activity-note">
					요금과 예산 한도를 보려면 서버의 api.env에 OCI API 키(<code>OCI_TENANCY_OCID</code>,{' '}
					<code>OCI_USER_OCID</code>, <code>OCI_FINGERPRINT</code>, <code>OCI_PRIVATE_KEY</code>,{' '}
					<code>OCI_REGION</code>)를 넣습니다. 콘솔 → 내 프로필 → API 키에서 만듭니다.
				</p>
			</section>
		);
	const { data, error } = billing;
	return (
		<section className="server-billing" aria-label="요금">
			<h3>요금</h3>
			{error && <p className="activity-empty error">{error}</p>}
			{data && (
				<>
					<p className="server-billing-total">
						이번 달 <strong>{money(data.monthToDate, data.currency)}</strong>
						<span className="activity-note"> · {new Date(data.updatedAt).toLocaleString('ko-KR')}에 읽음</span>
					</p>
					{data.budgets.length === 0 ? (
						<p className="activity-note">
							예산이 없습니다. 콘솔 → Billing & Cost Management → Budgets에서 한도를 만들면 여기와 메일로 알립니다.
						</p>
					) : (
						<ul className="server-budgets">
							{data.budgets.map((budget) => {
								const spent = budget.actualSpend ?? 0;
								const percent = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
								const level = percent >= 100 ? 'over' : percent >= 80 ? 'near' : 'ok';
								return (
									<li key={budget.displayName} className={`server-budget ${level}`}>
										<span className="server-budget-name">{budget.displayName}</span>
										<span className="server-budget-amount">
											{money(spent, data.currency)} / {money(budget.amount, data.currency)} ({percent}%)
										</span>
										<span
											className="server-budget-bar"
											role="meter"
											aria-label={`${budget.displayName} 예산 사용`}
											aria-valuenow={percent}
											aria-valuemin={0}
											aria-valuemax={100}
										>
											<span style={{ width: `${Math.min(percent, 100)}%` }} />
										</span>
										{budget.forecastedSpend !== null && (
											<span className="activity-note">
												이번 기간 예상 {money(budget.forecastedSpend, data.currency)}
											</span>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</>
			)}
		</section>
	);
};

/**
 * 서버 탭 (관리자): API 서버(VM)의 CPU·메모리·네트워크 사용률. Always Free면 Oracle의 유휴 회수 위험과 알림 메일 상태도.
 * 서버의 RESOURCE_MONITOR가 off면 켜는 방법을 알려 준다
 */
const Server = ({ status }: { status: ResourceStatus | null }) => {
	if (!status) return <p className="activity-empty">불러오는 중…</p>;
	if (status.mode === 'off')
		return (
			<div className="activity-locked">
				<i className="fa-solid fa-server" aria-hidden="true" />
				<h2>서버 자원 감시가 꺼져 있습니다</h2>
				<p>
					서버의 api.env에 <code>RESOURCE_MONITOR=free</code>(Oracle Always Free) 또는 <code>payg</code>(종량제)를
					넣으면 1분마다 CPU·메모리·네트워크를 재어 여기에 보입니다. Always Free면 유휴 회수 위험을 계산해 위험할 때
					메일로 알립니다.
				</p>
			</div>
		);

	const series = status.series ?? [];
	const percentOfBandwidth = (mbps: number) => Math.round((mbps / (status.networkMbps ?? 50)) * 10000) / 100;
	const risk = status.risk;
	return (
		<>
			<section className="server-summary" aria-label="서버 상태">
				<div className="activity-stat">
					<span className="label">요금제</span>
					<strong>{status.mode === 'free' ? 'Always Free' : '종량제'}</strong>
					<span className="change">{status.shape}</span>
				</div>
				{risk && (
					<div className={`activity-stat server-risk ${risk.level}`}>
						<span className="label">유휴 회수 위험</span>
						<strong>{LEVEL[risk.level].label}</strong>
						<span className="change">
							{LEVEL[risk.level].note}
							{risk.days > 0 && risk.days < 7 && ` (${risk.days}일치로 미리 본 값)`}
						</span>
					</div>
				)}
				{status.alert && (
					<div className="activity-stat">
						<span className="label">알림 메일</span>
						<strong>{status.alert.mailReady ? '켜짐' : '꺼짐'}</strong>
						<span className="change">
							{status.mode !== 'free'
								? status.alert.mailReady
									? '예산의 80%·100%를 넘으면 보냅니다'
									: 'RESEND_API_KEY·CONTACT_FROM·받는 주소가 필요합니다'
								: status.alert.mailReady
									? status.alert.lastSentAt
										? `마지막 알림 ${new Date(status.alert.lastSentAt).toLocaleString('ko-KR')}`
										: '위험해지면 보냅니다 (3일에 한 번까지)'
									: 'RESEND_API_KEY·CONTACT_FROM·받는 주소가 필요합니다'}
						</span>
					</div>
				)}
			</section>

			{status.billing && <Billing billing={status.billing} />}

			{risk && risk.conditions.length > 0 && (
				<table className="server-conditions" aria-label="유휴 회수 기준">
					<thead>
						<tr>
							<th>기준 (최근 7일)</th>
							<th>지금</th>
							<th>회수 기준</th>
							<th>걸림</th>
						</tr>
					</thead>
					<tbody>
						{risk.conditions.map((condition) => (
							<tr key={condition.metric} className={condition.below ? 'below' : ''}>
								<td>
									{METRIC_LABEL[condition.metric]} ({condition.measure})
								</td>
								<td>{condition.value}%</td>
								<td>{condition.threshold}% 미만</td>
								<td>{condition.below ? '걸림' : '아님'}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			<div className="server-charts">
				<UsageChart
					label="CPU"
					unit="%"
					max={100}
					threshold={status.mode === 'free' ? 20 : undefined}
					points={series.map((row) => ({ at: row.at, value: row.cpu }))}
				/>
				<UsageChart
					label="메모리"
					unit="%"
					max={100}
					points={series.map((row) => ({ at: row.at, value: row.memory }))}
				/>
				<UsageChart
					label={`네트워크 (대역폭 ${status.networkMbps} Mbps 대비)`}
					unit="%"
					threshold={status.mode === 'free' ? 20 : undefined}
					points={series.map((row) => ({ at: row.at, value: percentOfBandwidth(row.network) }))}
				/>
			</div>
			<p className="activity-note">
				최근 7일, 한 시간 평균. CPU·메모리는 서버(VM) 전체, 네트워크는 API 컨테이너가 주고받은 양입니다.
				{status.latest && ` 마지막으로 잰 때 ${new Date(status.latest.at).toLocaleString('ko-KR')}.`}
			</p>
		</>
	);
};

export default Server;
