import { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { appIconUrl } from '@/shared/config/appIcon';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { startTour } from '@/desktop/tour/tourStore';
import { stepsFor, tipSteps, type TourStep } from '@/desktop/tour/tourSteps';
import { GUIDES, type GuideStep } from './guides';
import { MANUALS, type Manual, type ManualArticle } from './manuals';
import './Tips.css';

/** 보는 곳: 첫 화면, 팁 모음 하나, 앱 사용 설명서 하나, 화면에서 짚어 보기 */
type Route =
	| { kind: 'home' }
	| { kind: 'guide'; id: string }
	| { kind: 'manual'; app: AppName }
	| { kind: 'manuals' }
	| { kind: 'spot' };

/** 첫 화면에 보일 사용 설명서 수: 나머지는 '모두 보기'에서 */
const HOME_MANUALS = 8;

const sameRoute = (a: Route, b: Route) => JSON.stringify(a) === JSON.stringify(b);
const appLabel = (app: AppName) => APP_MANIFEST[app].label;
const appIcon = (app: AppName) => appIconUrl(APP_MANIFEST[app].icon);

/** 찾기: 팁·설명서의 제목과 설명에서 */
interface SearchHit {
	route: Route;
	place: string;
	title: string;
	body: string;
	icon: string;
}

function searchAll(query: string): SearchHit[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const matches = (step: GuideStep) => `${step.title} ${step.body}`.toLowerCase().includes(q);
	return [
		...GUIDES.flatMap((guide) =>
			guide.steps.filter(matches).map((step) => ({
				route: { kind: 'guide', id: guide.id } as Route,
				place: guide.title,
				...step,
			}))
		),
		...MANUALS.flatMap((manual) =>
			(manual.articles
				? manual.articles.map(({ title, paragraphs, icon }) => ({ title, body: paragraphs.join(' '), icon }))
				: manual.sections
			)
				.filter(matches)
				.map((step) => ({
					route: { kind: 'manual', app: manual.app } as Route,
					place: `${appLabel(manual.app)} 사용 설명서`,
					...step,
				}))
		),
	];
}

/**
 * 사용 설명서 한 편 (macOS 팁 앱의 'OO 사용 설명서'처럼): 왼쪽에 목차, 오른쪽에 큰 제목과 앱 아이콘, 절마다 설명.
 * 팁 모음(블로그 읽는 법 등)도 같은 모양으로 보여 준다
 */
const ManualPage = ({
	title,
	subtitle,
	intro,
	icon,
	sections,
	articles,
	art,
	openLabel,
	onOpen,
	phone,
}: {
	title: string;
	subtitle: string;
	intro: string;
	icon: { src: string } | { fa: string };
	sections: GuideStep[];
	/** 글 형식의 절: 있으면 sections 대신 큰 제목·문단·그림 칸으로 보여 준다 */
	articles?: ManualArticle[];
	/** 글 형식의 그림 칸 구석에 둘 앱 아이콘 */
	art?: string;
	openLabel: string;
	onOpen: () => void;
	phone: boolean;
}) => {
	const go = (index: number) =>
		document.getElementById(`tips-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	return (
		<div className="tips-manual">
			<nav className="tips-toc" aria-label="목차">
				<button type="button" className="active" onClick={() => go(-1)}>
					환영합니다
				</button>
				{(articles ?? sections).map((section, index) => (
					<button key={section.title} type="button" onClick={() => go(index)}>
						{section.title}
					</button>
				))}
			</nav>
			<article className="tips-manual-body" aria-label={title}>
				<header id="tips-section--1" className="tips-manual-head">
					<div>
						<h1>{title}</h1>
						<p className="tips-manual-sub">{subtitle}</p>
					</div>
					{'src' in icon ? (
						<img className="tips-manual-icon" src={icon.src} alt="" />
					) : (
						<span className="tips-manual-icon tips-manual-fa" aria-hidden="true">
							<i className={icon.fa} />
						</span>
					)}
				</header>
				<p className="tips-manual-intro">{intro}</p>
				{articles?.map((each, index) => (
					<section key={each.title} id={`tips-section-${index}`} className="tips-article">
						<span className="tips-article-art" aria-hidden="true">
							<i className={each.icon} />
							{art && <img src={art} alt="" />}
						</span>
						<div className="tips-article-text">
							<h2>{each.title}</h2>
							{each.paragraphs.map((paragraph) => (
								<p key={paragraph}>{paragraph}</p>
							))}
							{each.keys && !phone && <kbd className="tips-keys">{each.keys}</kbd>}
						</div>
					</section>
				))}
				{!articles &&
					sections.map((section, index) => (
						<section key={section.title} id={`tips-section-${index}`} className="tips-manual-section">
							<span className="tips-manual-section-icon" aria-hidden="true">
								<i className={section.icon} />
							</span>
							<div>
								<h2>{section.title}</h2>
								<p>{section.body}</p>
								{section.keys && !phone && <kbd className="tips-keys">{section.keys}</kbd>}
							</div>
						</section>
					))}
				<button type="button" className="tips-link" onClick={onOpen}>
					{openLabel} ›
				</button>
			</article>
		</div>
	);
};

/** 사용 설명서 카드 모음: 앱 아이콘 칸, 그 아래 이름과 한 줄 */
const ManualCards = ({ manuals, onOpen }: { manuals: Manual[]; onOpen: (app: AppName) => void }) => (
	<ul className="tips-cards" aria-label="사용 설명서">
		{manuals.map((each) => (
			<li key={each.app}>
				<button type="button" className="tips-card tips-app-card" onClick={() => onOpen(each.app)}>
					<span className="tips-card-art" aria-hidden="true">
						<img src={appIcon(each.app)} alt="" />
					</span>
					<strong>{appLabel(each.app)}</strong>
					<span>{each.summary}</span>
				</button>
			</li>
		))}
	</ul>
);

/**
 * 팁 (macOS 팁 앱): 처음 온 사람을 위한 안내.
 * - 첫 화면: '도움이 필요하세요?'와 찾기, 둘러보기 카드, 팁 모음(블로그 읽는 법·창과 Dock·연락하는 법·화면에서 짚어 보기),
 *   사용 설명서(앱마다)
 * - 위쪽 막대의 뒤로·앞으로·홈으로 오간다
 * - 둘러보기·보여 주기는 이 창을 닫고 화면의 그 자리를 비춘다 (desktop/tour)
 */
const Tips = () => {
	const phone = useIsMobile();
	const { closeApp, openApp, bringAppToFront } = useAppState();
	const [history, setHistory] = useState<{ routes: Route[]; at: number }>({ routes: [{ kind: 'home' }], at: 0 });
	const [query, setQuery] = useState('');
	const route = history.routes[history.at];

	const go = (next: Route) => {
		if (sameRoute(next, route)) return;
		setHistory(({ routes, at }) => ({ routes: [...routes.slice(0, at + 1), next], at: at + 1 }));
		setQuery('');
	};
	const step = (delta: number) =>
		setHistory((current) => ({ ...current, at: Math.min(current.routes.length - 1, Math.max(0, current.at + delta)) }));

	/** 창을 닫고(휴대폰은 홈 화면으로) 비출 곳이 보이게 한 뒤 연다 */
	const show = (steps: TourStep[], single = false) => {
		closeApp('tips');
		window.setTimeout(() => startTour(steps, single), phone ? 500 : 250);
	};
	const launch = (app: AppName) => {
		openApp(app);
		bringAppToFront(app);
	};

	const hits = searchAll(query);
	const guide = route.kind === 'guide' ? GUIDES.find((each) => each.id === route.id) : undefined;
	const manual = route.kind === 'manual' ? MANUALS.find((each) => each.app === route.app) : undefined;
	const title =
		route.kind === 'home'
			? '팁'
			: guide
				? guide.title
				: manual
					? `${appLabel(manual.app)} 사용 설명서`
					: route.kind === 'manuals'
						? '사용 설명서'
						: '화면에서 짚어 보기';

	return (
		<AppWindow title={title} appName="tips" chrome="unified">
			<div className="tips">
				<header className="tips-bar">
					<span className="tips-bar-pill" role="group" aria-label="이동">
						<button type="button" aria-label="뒤로" disabled={history.at === 0} onClick={() => step(-1)}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" />
						</button>
						<button
							type="button"
							aria-label="앞으로"
							disabled={history.at === history.routes.length - 1}
							onClick={() => step(1)}
						>
							<i className="fa-solid fa-chevron-right" aria-hidden="true" />
						</button>
					</span>
					<button
						type="button"
						className="tips-bar-round"
						aria-label="홈"
						disabled={route.kind === 'home'}
						onClick={() => go({ kind: 'home' })}
					>
						<i className="fa-solid fa-house" aria-hidden="true" />
					</button>
					{route.kind !== 'home' && <span className="tips-bar-title">{title}</span>}
				</header>

				{/* 보는 곳이 바뀌면 맨 위부터 (스크롤을 새로) */}
				<div key={JSON.stringify(route)} className="tips-scroll">
					{route.kind === 'home' && (
						<div className="tips-home">
							<h1 className="tips-hero-title">도움이 필요하세요? 여기서 확인할 수 있습니다.</h1>
							<label className="tips-search">
								<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
								<input
									type="search"
									aria-label="팁 찾기"
									placeholder="‘글 찾는 방법’ 또는 ‘다크 모드’"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
								/>
							</label>

							{query.trim() ? (
								<section className="tips-results" aria-label="찾은 팁">
									{hits.length === 0 ? (
										<p className="tips-empty">찾는 팁이 없어요. 다른 낱말로 찾아 보세요.</p>
									) : (
										hits.map((hit) => (
											<button
												key={`${hit.place}-${hit.title}`}
												type="button"
												className="tips-result"
												onClick={() => go(hit.route)}
											>
												<i className={hit.icon} aria-hidden="true" />
												<span>
													<strong>{hit.title}</strong>
													<small>{hit.place}</small>
												</span>
											</button>
										))
									)}
								</section>
							) : (
								<>
									<div className="tips-featured">
										<button type="button" className="tips-feature-card" onClick={() => show(stepsFor(phone))}>
											<span className="tips-feature-badge" aria-hidden="true">
												<img src="/imgs/tips.svg" alt="" />
											</span>
											<strong>MacFolio 둘러보기</strong>
											<span>처음 왔다면 1분 둘러보기부터 시작하세요.</span>
										</button>
										<ul className="tips-feature-list">
											<li>
												<button type="button" onClick={() => show(stepsFor(phone))}>
													<i className="fa-solid fa-wand-magic-sparkles tips-feature-icon" aria-hidden="true" />
													<span>
														<strong>처음부터 둘러보기</strong>
														<small>무엇을 눌러 보면 좋은지 화면에서 하나씩 짚어 드려요.</small>
													</span>
												</button>
											</li>
											<li>
												<button type="button" onClick={() => go({ kind: 'guide', id: 'blog' })}>
													<i className="fa-solid fa-magnifying-glass tips-feature-icon" aria-hidden="true" />
													<span>
														<strong>블로그에서 무엇이든 찾기</strong>
														<small>폴더, 태그, 검색으로 읽고 싶은 글을 빠르게 찾아보세요.</small>
													</span>
												</button>
											</li>
											<li>
												<button type="button" onClick={() => go({ kind: 'manual', app: 'settings' })}>
													<i className="fa-solid fa-circle-user tips-feature-icon" aria-hidden="true" />
													<span>
														<strong>나만의 화면 만들기</strong>
														<small>다크 모드로 바꾸고, 배경화면을 골라 보세요.</small>
													</span>
												</button>
											</li>
										</ul>
									</div>

									<h2 className="tips-heading">팁</h2>
									<ul className="tips-cards" aria-label="팁">
										{GUIDES.map((each) => (
											<li key={each.id}>
												<button type="button" className="tips-card" onClick={() => go({ kind: 'guide', id: each.id })}>
													<span className="tips-card-art" aria-hidden="true">
														<i className={each.icon} />
													</span>
													<strong>{each.title}</strong>
													<span>{each.summary}</span>
													<small>{each.steps.length}개의 팁</small>
												</button>
											</li>
										))}
										<li>
											<button type="button" className="tips-card" onClick={() => go({ kind: 'spot' })}>
												<span className="tips-card-art" aria-hidden="true">
													<i className="fa-solid fa-hand-pointer" />
												</span>
												<strong>화면에서 짚어 보기</strong>
												<span>그 자리를 화면에서 비춰 드려요</span>
												<small>{tipSteps(phone).length}개의 팁</small>
											</button>
										</li>
									</ul>

									<div className="tips-heading-row">
										<h2 className="tips-heading tips-heading-large">사용 설명서</h2>
										<button type="button" className="tips-see-all" onClick={() => go({ kind: 'manuals' })}>
											모두 보기
										</button>
									</div>
									<h3 className="tips-subheading">사용자의 앱</h3>
									<ManualCards manuals={MANUALS.slice(0, HOME_MANUALS)} onOpen={(app) => go({ kind: 'manual', app })} />
								</>
							)}
						</div>
					)}

					{guide && (
						<ManualPage
							title={guide.title}
							subtitle={guide.summary}
							intro={`${guide.steps.length}가지 팁으로 알려 드릴게요. 왼쪽 목차에서 골라 바로 가도 돼요.`}
							icon={{ src: appIcon(guide.app) }}
							sections={guide.steps}
							openLabel={guide.appLabel}
							onOpen={() => launch(guide.app)}
							phone={phone}
						/>
					)}

					{manual && (
						<ManualPage
							title={`${appLabel(manual.app)} 사용 설명서`}
							subtitle="MacFolio용"
							intro={manual.intro}
							icon={{ src: appIcon(manual.app) }}
							sections={manual.sections}
							articles={manual.articles}
							art={appIcon(manual.app)}
							openLabel={`${appLabel(manual.app)} 열기`}
							onOpen={() => launch(manual.app)}
							phone={phone}
						/>
					)}

					{route.kind === 'manuals' && (
						<div className="tips-home">
							<h1 className="tips-page-title">사용 설명서</h1>
							<p className="tips-manual-sub">이 사이트의 모든 앱 {MANUALS.length}개를 하나씩 알려 드려요.</p>
							<ManualCards manuals={MANUALS} onOpen={(app) => go({ kind: 'manual', app })} />
						</div>
					)}

					{route.kind === 'spot' && (
						<div className="tips-spot">
							<h1>화면에서 짚어 보기</h1>
							<p className="tips-manual-sub">보여 주기를 누르면 이 창을 닫고 그 자리를 비춰 드려요.</p>
							<ul className="tips-spot-list" aria-label="화면에서 짚어 보기">
								{tipSteps(phone).map((each) => (
									<li key={each.id}>
										<i className={each.icon ?? 'fa-regular fa-lightbulb'} aria-hidden="true" />
										<span>
											<strong>{each.title}</strong>
											<small>{each.body}</small>
										</span>
										<button
											type="button"
											className="tips-show"
											aria-label={`${each.title} 보여 주기`}
											onClick={() => show([each], true)}
										>
											보여 주기
										</button>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</div>
		</AppWindow>
	);
};

export default Tips;
