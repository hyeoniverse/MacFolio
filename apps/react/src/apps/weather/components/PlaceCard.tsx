import { useRef, useState } from 'react';
import { localClock } from '../forecast';
import { type Place } from '../places';
import type { Loaded } from '../useForecasts';

/** 카드를 왼쪽으로 밀면 드러나는 지우기 버튼의 폭 */
const SWIPE_OPEN = 84;

/**
 * 장소 카드: 그곳의 하늘 색, 이름, 지금 시각·지역, 날씨, 기온, 최고·최저.
 * 넓은 창은 macOS처럼 오른쪽 클릭 메뉴의 '삭제'로, 좁은 창·휴대폰은 iOS처럼 왼쪽으로 밀거나(목록 편집이면 늘) 드러나는 빨간 휴지통으로 지운다
 */
const PlaceCard = ({
	place,
	loaded,
	active,
	editing,
	onSelect,
	onRemove,
	onMenu,
}: {
	place: Place;
	loaded: Loaded | undefined;
	active: boolean;
	editing: boolean;
	onSelect: () => void;
	onRemove?: () => void;
	/** 오른쪽 클릭 (넓은 창): 그 자리에 메뉴 */
	onMenu?: (at: { x: number; y: number }) => void;
}) => {
	const weather = loaded?.status === 'ready' ? loaded.weather : null;
	const [offset, setOffset] = useState(0);
	/** 손가락으로 미는 중: 카드가 손가락을 바로 따라오게 애니메이션을 끈다 (손을 떼면 제자리로 미끄러진다) */
	const [dragging, setDragging] = useState(false);
	const drag = useRef<{ x: number; y: number; from: number; moved: boolean } | null>(null);
	/** 방금 밀었는지: 손을 뗄 때 따라오는 누름은 고르기·닫기가 아니다 */
	const dragged = useRef(false);
	const shown = onRemove && editing ? -SWIPE_OPEN : offset;

	return (
		<li
			className={`weather-card sky-${weather?.sky ?? 'cloudy'} ${weather?.day === false ? 'night' : 'day'} ${shown ? 'swiped' : ''}`}
		>
			{onRemove && (
				<button
					type="button"
					className="weather-card-trash"
					aria-label={`${place.name} 삭제`}
					tabIndex={shown ? 0 : -1}
					onClick={onRemove}
				>
					<i className="fa-solid fa-trash-can" aria-hidden="true" />
				</button>
			)}
			<button
				type="button"
				className={`weather-card-face ${active ? 'active' : ''} ${dragging ? 'dragging' : ''}`}
				aria-current={active || undefined}
				style={shown ? { transform: `translateX(${shown}px)` } : undefined}
				onContextMenu={
					onMenu
						? (event) => {
								event.preventDefault();
								onMenu({ x: event.clientX, y: event.clientY });
							}
						: undefined
				}
				onPointerDown={(event) => {
					// 휴대폰에서는 밀고 난 뒤 누름이 따라오지 않는다. 새로 누르면 지난 밀기는 잊는다
					dragged.current = false;
					if (!onRemove || editing) return;
					drag.current = { x: event.clientX, y: event.clientY, from: offset, moved: false };
				}}
				onPointerMove={(event) => {
					const start = drag.current;
					if (!start) return;
					const dx = event.clientX - start.x;
					// 옆으로 미는 것만 (위아래 스크롤은 그대로)
					if (!start.moved && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(event.clientY - start.y))) return;
					if (!start.moved) {
						// 옆으로 밀기 시작하면 손가락을 이 카드가 붙잡는다 (손가락이 카드 밖으로 나가도 계속 민다)
						try {
							event.currentTarget.setPointerCapture(event.pointerId);
						} catch {
							// 이미 끝난 포인터면 그냥 둔다
						}
					}
					start.moved = true;
					setDragging(true);
					setOffset(Math.min(0, Math.max(-SWIPE_OPEN - 24, start.from + dx)));
				}}
				onPointerUp={() => {
					const start = drag.current;
					drag.current = null;
					dragged.current = Boolean(start?.moved);
					setDragging(false);
					if (start?.moved) setOffset((current) => (current < -SWIPE_OPEN / 2 ? -SWIPE_OPEN : 0));
				}}
				onPointerCancel={() => {
					// iOS Safari는 손가락이 조금만 위아래로 흔들려도 스크롤로 보고 취소를 보낸다.
					// 그때도 닫지 않고, 민 만큼으로 열지 닫을지 정한다
					const start = drag.current;
					drag.current = null;
					dragged.current = Boolean(start?.moved);
					setDragging(false);
					setOffset((current) => (current < -SWIPE_OPEN / 2 ? -SWIPE_OPEN : 0));
				}}
				onClick={(event) => {
					if (dragged.current) {
						dragged.current = false;
						return;
					}
					// 밀어 연 뒤의 누름은 고르기가 아니라 닫기
					if (offset !== 0) {
						event.preventDefault();
						setOffset(0);
						return;
					}
					onSelect();
				}}
			>
				<span className="weather-card-top">
					<strong>{place.name}</strong>
					<span className="weather-card-temp">{weather ? `${weather.temp}°` : '—'}</span>
				</span>
				<span className="weather-card-time">
					{weather ? `${localClock(weather.utcOffset)} • ${place.region}` : place.region}
				</span>
				<span className="weather-card-bottom">
					<span>{weather?.label ?? (loaded?.status === 'error' ? '불러오지 못함' : '불러오는 중')}</span>
					{weather && (
						<span>
							최고:{weather.high}° 최저:{weather.low}°
						</span>
					)}
				</span>
			</button>
		</li>
	);
};

export default PlaceCard;
