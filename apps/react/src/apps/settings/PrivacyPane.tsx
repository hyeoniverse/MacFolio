import { useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { requestFinderDoc } from '@/apps/finder/openDoc';
import { analyticsEnabled } from '@/shared/analytics/analytics';
import { useAdmin } from '@/shared/auth/adminStore';
import { env } from '@/shared/config/env';
import { saveSecurity, useSecurity, type HumanCheck } from '@/shared/security/security';

/** 사람 확인을 켜고 끄는 곳 (macOS 설정처럼 색 아이콘과 설명) */
const CHECKS: { id: HumanCheck; label: string; note: string; icon: string; color: string }[] = [
	{ id: 'contact', label: '메일', note: '메일 앱에서 연락 메일을 보낼 때', icon: 'fa-envelope', color: 'blue' },
	{ id: 'comment', label: '댓글', note: '블로그 글에 댓글을 쓸 때', icon: 'fa-comment', color: 'orange' },
	{ id: 'message', label: '메시지', note: '메시지 앱에 피드백·답글을 남길 때', icon: 'fa-message', color: 'green' },
];

/**
 * 시스템 설정의 '개인정보 보호 및 보안' (macOS의 같은 화면): 무엇을 모으는지(개인정보 처리 방침), 글을 쓸 때 사람 확인을 할지.
 * 사람 확인(Cloudflare Turnstile)은 사이트 전체 설정이라 관리자만 켜고 끈다. 방문자에게는 지금 어디에 켜져 있는지 보인다
 */
const PrivacyPane = () => {
	const { openApp } = useAppState();
	const admin = useAdmin().status === 'signed-in';
	const { settings, failed } = useSecurity();
	const [saving, setSaving] = useState<HumanCheck | null>(null);
	const [error, setError] = useState<string | null>(null);
	const tracking = analyticsEnabled();

	const toggle = async (check: HumanCheck, on: boolean) => {
		setSaving(check);
		setError(await saveSecurity({ [check]: on }));
		setSaving(null);
	};

	return (
		<div className="privacy-pane">
			<section className="privacy-card" aria-label="개인정보 보호">
				<span className="privacy-icon blue" aria-hidden="true">
					<i className="fa-solid fa-hand" />
				</span>
				<div>
					<strong>개인정보 보호</strong>
					<p>
						이 사이트가 무엇을 모으고 얼마나 두는지, 글을 쓸 때 사람인지 확인할지 정합니다. 방문 분석은 쿠키 없이 하루
						단위로만 셉니다.{' '}
						<button
							type="button"
							className="privacy-more"
							onClick={() => {
								requestFinderDoc('docs/privacy.md');
								openApp('finder');
							}}
						>
							더 알아보기…
						</button>
					</p>
				</div>
			</section>

			<section className="privacy-group" aria-label="사람 확인">
				<h3>사람 확인 (Cloudflare Turnstile)</h3>
				{!env.apiUrl ? (
					<p>연결된 서버가 없습니다.</p>
				) : failed ? (
					<p className="privacy-error">설정을 불러오지 못했습니다.</p>
				) : (
					<>
						<ul>
							{CHECKS.map(({ id, label, note, icon, color }) => {
								const on = settings?.[id] ?? false;
								return (
									<li key={id} className="privacy-row">
										<span className={`privacy-icon ${color}`} aria-hidden="true">
											<i className={`fa-solid ${icon}`} />
										</span>
										<label className="privacy-row-text" htmlFor={`privacy-${id}`}>
											<strong>{label}</strong>
											<span>{note}</span>
										</label>
										<input
											id={`privacy-${id}`}
											className="privacy-switch"
											type="checkbox"
											role="switch"
											aria-label={`${label} 사람 확인`}
											checked={on}
											disabled={!admin || !settings || saving !== null}
											onChange={(event) => void toggle(id, event.target.checked)}
										/>
									</li>
								);
							})}
						</ul>
						{error && (
							<p className="privacy-error" role="alert">
								{error}
							</p>
						)}
						<p>
							{admin
								? '켜면 그곳에 글을 쓸 때 Cloudflare가 사람인지 확인합니다. 대부분은 아무것도 누르지 않아도 끝납니다. 관리자가 쓰는 글은 확인하지 않습니다.'
								: '사이트 전체 설정이라 관리자만 바꿀 수 있습니다.'}
							{settings && !settings.available && ' 서버에 Turnstile 키가 없어 지금은 켜 두어도 확인하지 않습니다.'}
						</p>
					</>
				)}
			</section>

			<section className="privacy-group" aria-label="이 브라우저">
				<h3>이 브라우저</h3>
				<ul>
					<li className="privacy-row">
						<span className="privacy-icon gray" aria-hidden="true">
							<i className="fa-solid fa-chart-simple" />
						</span>
						<span className="privacy-row-text">
							<strong>방문 분석</strong>
							<span>
								{tracking
									? '쿠키 없이 하루 단위로 셉니다'
									: '이 브라우저는 세지 않습니다 (Global Privacy Control, 로컬 주소 또는 서버 없음)'}
							</span>
						</span>
						<span className="privacy-row-value">{tracking ? '켜짐' : '꺼짐'}</span>
					</li>
				</ul>
			</section>
		</div>
	);
};

export default PrivacyPane;
