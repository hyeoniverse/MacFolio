import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { startTour } from '@/desktop/tour/tourStore';
import { stepsFor, tipSteps, type TourStep } from '@/desktop/tour/tourSteps';
import './Tips.css';

/**
 * 팁 (macOS·iOS 팁 앱): 처음 온 사람을 위한 안내 모음.
 * - 맨 위의 'MacFolio 둘러보기'는 처음 방문 때 뜬 둘러보기를 처음부터 다시 연다
 * - 팁마다 '보여 주기'를 누르면 이 창을 닫고 그 자리를 화면에서 비춘다
 */
const Tips = () => {
	const phone = useIsMobile();
	const { closeApp } = useAppState();

	/** 창을 닫고(휴대폰은 홈 화면으로) 비출 곳이 보이게 한 뒤 연다 */
	const show = (steps: TourStep[], single = false) => {
		closeApp('tips');
		window.setTimeout(() => startTour(steps, single), phone ? 500 : 250);
	};

	return (
		<AppWindow title="팁" appName="tips">
			<div className="tips">
				<header className="tips-hero">
					<img src="/imgs/tips.svg" alt="" />
					<h1>MacFolio 둘러보기</h1>
					<p>무엇을 눌러 보면 좋은지 화면에서 하나씩 짚어 드려요.</p>
					<button type="button" className="tips-start" onClick={() => show(stepsFor(phone))}>
						처음부터 둘러보기
					</button>
				</header>
				<ul className="tips-list" aria-label="팁">
					{tipSteps(phone).map((step) => (
						<li key={step.id} className="tips-item">
							<span className="tips-item-icon" aria-hidden="true">
								<i className={step.icon ?? 'fa-regular fa-lightbulb'} />
							</span>
							<div className="tips-item-text">
								<h2>{step.title}</h2>
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
			</div>
		</AppWindow>
	);
};

export default Tips;
