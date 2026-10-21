import { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { startTour } from '@/desktop/tour/tourStore';
import { stepsFor, tipSteps, type TourStep } from '@/desktop/tour/tourSteps';
import { GUIDES, type Guide } from './guides';
import './Tips.css';

/** 사용법 하나: 단계마다 아이콘·제목·설명(·단축키), 끝에 그 앱 열기 */
const GuideView = ({
	guide,
	phone,
	onBack,
	onOpen,
}: {
	guide: Guide;
	phone: boolean;
	onBack: () => void;
	onOpen: () => void;
}) => (
	<article className="tips-guide" aria-label={guide.title}>
		<button type="button" className="tips-back" onClick={onBack}>
			<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 팁
		</button>
		<header className="tips-guide-head">
			<span className="tips-guide-icon" aria-hidden="true">
				<i className={guide.icon} />
			</span>
			<h1>{guide.title}</h1>
			<p>{guide.summary}</p>
		</header>
		<ol className="tips-steps">
			{guide.steps.map((step, index) => (
				<li key={step.title} className="tips-step">
					<span className="tips-step-icon" aria-hidden="true">
						<i className={step.icon} />
					</span>
					<div className="tips-step-text">
						<h2>
							<span className="tips-step-number">{index + 1}</span>
							{step.title}
						</h2>
						<p>{step.body}</p>
						{step.keys && !phone && <kbd className="tips-keys">{step.keys}</kbd>}
					</div>
				</li>
			))}
		</ol>
		<button type="button" className="tips-start" onClick={onOpen}>
			{guide.appLabel}
		</button>
	</article>
);

/**
 * 팁 (macOS·iOS 팁 앱): 처음 온 사람을 위한 안내 모음.
 * - 맨 위의 'MacFolio 둘러보기'는 처음 방문 때 뜬 둘러보기를 처음부터 다시 연다
 * - 사용법: 블로그 읽는 법, 창과 Dock 다루기, 연락하는 법을 한 단계씩 (guides.ts)
 * - 화면에서 짚어 보기: 팁마다 '보여 주기'를 누르면 이 창을 닫고 그 자리를 화면에서 비춘다
 */
const Tips = () => {
	const phone = useIsMobile();
	const { closeApp, openApp, bringAppToFront } = useAppState();
	const [open, setOpen] = useState<Guide | null>(null);

	/** 창을 닫고(휴대폰은 홈 화면으로) 비출 곳이 보이게 한 뒤 연다 */
	const show = (steps: TourStep[], single = false) => {
		closeApp('tips');
		window.setTimeout(() => startTour(steps, single), phone ? 500 : 250);
	};

	const openGuideApp = (guide: Guide) => {
		openApp(guide.app);
		bringAppToFront(guide.app);
	};

	return (
		<AppWindow title="팁" appName="tips">
			<div className="tips">
				{open ? (
					<GuideView guide={open} phone={phone} onBack={() => setOpen(null)} onOpen={() => openGuideApp(open)} />
				) : (
					<>
						<header className="tips-hero">
							<img src="/imgs/tips.svg" alt="" />
							<h1>MacFolio 둘러보기</h1>
							<p>무엇을 눌러 보면 좋은지 화면에서 하나씩 짚어 드려요.</p>
							<button type="button" className="tips-start" onClick={() => show(stepsFor(phone))}>
								처음부터 둘러보기
							</button>
						</header>

						<h2 className="tips-section">사용법</h2>
						<ul className="tips-guides" aria-label="사용법">
							{GUIDES.map((guide) => (
								<li key={guide.id}>
									<button type="button" className="tips-guide-card" onClick={() => setOpen(guide)}>
										<span className="tips-guide-icon" aria-hidden="true">
											<i className={guide.icon} />
										</span>
										<span className="tips-guide-card-text">
											<strong>{guide.title}</strong>
											<span>{guide.summary}</span>
										</span>
										<span className="tips-guide-card-count">{guide.steps.length}가지 팁</span>
									</button>
								</li>
							))}
						</ul>

						<h2 className="tips-section">화면에서 짚어 보기</h2>
						<ul className="tips-list" aria-label="팁">
							{tipSteps(phone).map((step) => (
								<li key={step.id} className="tips-item">
									<span className="tips-item-icon" aria-hidden="true">
										<i className={step.icon ?? 'fa-regular fa-lightbulb'} />
									</span>
									<div className="tips-item-text">
										<h3>{step.title}</h3>
										<p>{step.body}</p>
									</div>
									<button
										type="button"
										className="tips-item-show"
										aria-label={`${step.title} 보여 주기`}
										onClick={() => show([step], true)}
									>
										보여 주기
									</button>
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</AppWindow>
	);
};

export default Tips;
