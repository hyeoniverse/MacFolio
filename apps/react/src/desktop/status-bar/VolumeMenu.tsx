import { useExitMotionRef } from '@/shared/ui/motion/useExitMotion';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMusic } from '@/apps/music/useMusic';
import { placeBelow, type Point } from '@/shared/ui/popover/placement';
import { useDismiss } from '@/shared/ui/popover/useDismiss';
import '@/desktop/status-bar/VolumeMenu.css';

const iconOf = (volume: number) =>
	volume === 0 ? 'fa-volume-off' : volume <= 0.5 ? 'fa-volume-low' : 'fa-volume-high';

/**
 * 메뉴 막대의 음량 (Apple 메뉴·서버 상태처럼 단추와 떠 있는 창을 함께 가진 메뉴 막대 항목).
 * 메뉴 막대는 넘치는 것을 잘라 내므로(overflow: hidden) 창은 body에 그리고,
 * 자리는 다른 떠 있는 창과 같은 공통 함수(placeBelow)로 단추 바로 아래 가운데에 둔다.
 */
const VolumeMenu = () => {
	const { volume, setVolume } = useMusic();
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<Point | null>(null);
	const button = useRef<HTMLButtonElement>(null);
	// 닫히면 살짝 작아지며 사라진다
	const [panel, panelExit] = useExitMotionRef<HTMLDivElement>('pop-out');
	useDismiss(open, () => setOpen(false), [panel, button]);

	// 그려진 크기를 재서 자리를 정한다 (그리기 전에 옮겨 깜빡이지 않는다)
	useLayoutEffect(() => {
		if (!open || !button.current || !panel.current) return;
		setPosition(
			placeBelow(
				button.current.getBoundingClientRect(),
				{ width: panel.current.offsetWidth, height: panel.current.offsetHeight },
				{ align: 'center' }
			)
		);
	}, [panel, open]);

	const icon = iconOf(volume);
	return (
		<span className="volume-menu">
			<button
				ref={button}
				type="button"
				className={`statusbar-icon-button ${open ? 'open' : ''}`}
				aria-label={`음량 ${Math.round(volume * 100)}%`}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				<i className={`fas ${icon}`} aria-hidden="true" />
			</button>
			{open &&
				createPortal(
					<div
						ref={panelExit}
						className="volume-container"
						role="dialog"
						aria-label="음량"
						style={position ?? { visibility: 'hidden' }}
					>
						<div className="volume-level" style={{ height: `${volume * 100}%` }} />
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={volume}
							onChange={(event) => setVolume(Number(event.target.value))}
							className="volume-slider"
							aria-label="음량"
						/>
						<i className={`fas ${icon} volume-icon`} aria-hidden="true" />
					</div>,
					document.body
				)}
		</span>
	);
};

export default VolumeMenu;
