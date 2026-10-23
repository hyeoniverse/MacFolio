import { useState } from 'react';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { appIconUrl } from '@/shared/config/appIcon';
import Button from '@/shared/ui/button/Button';
import SearchField from '@/shared/ui/search-field/SearchField';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import { SIZE_LABEL, WIDGET_INFO, WIDGET_KINDS, type WidgetKind, type WidgetSize } from './catalog';
import { pixelSize } from './layout';
import Widget from './Widget';
import { closeWidgetEditor } from './widgetEditor';
import './WidgetGallery.css';

/** 사이드바의 위젯 아이콘: 그 위젯의 앱 아이콘, 앱이 없는 위젯은 선 아이콘 */
const KIND_ICONS: Record<WidgetKind, { app: AppName } | { glyph: string }> = {
	weather: { app: 'weather' },
	calendar: { glyph: 'fa-regular fa-calendar' },
	clock: { glyph: 'fa-regular fa-clock' },
	music: { app: 'music' },
	posts: { app: 'memo' },
	photos: { app: 'photos' },
	github: { app: 'github' },
	profile: { glyph: 'fa-regular fa-user' },
	quote: { glyph: 'fa-solid fa-quote-left' },
};

const KindIcon = ({ kind }: { kind: WidgetKind }) => {
	const icon = KIND_ICONS[kind];
	return 'app' in icon ? (
		<img className="widget-gallery-icon" src={appIconUrl(APP_MANIFEST[icon.app].icon)} alt="" draggable={false} />
	) : (
		<span className="widget-gallery-icon glyph" aria-hidden="true">
			<i className={icon.glyph}></i>
		</span>
	);
};

/** '모든 위젯' 아이콘: macOS 위젯 갤러리처럼 작은 위젯 둘과 세로로 긴 위젯 하나의 선 그림 (바탕 없이) */
const AllWidgetsGlyph = () => (
	<svg className="widget-gallery-icon all" viewBox="0 0 26 26" aria-hidden="true">
		<rect x="2.5" y="6" width="8" height="6" rx="1.6" />
		<rect x="2.5" y="14" width="8" height="6" rx="1.6" />
		<rect x="13" y="6" width="10.5" height="14" rx="1.8" />
	</svg>
);

/**
 * 위젯 갤러리 (macOS의 '위젯 편집…'): 화면 아래 유리 판. 왼쪽은 찾기와 위젯 종류, 오른쪽은 고른 종류(처음엔 모두)의
 * 크기마다 실제 위젯 미리보기. 누르면 바탕화면의 빈 칸에 더한다
 */
const WidgetGallery = ({
	onAdd,
	away = false,
}: {
	/** from: 누른 미리보기의 화면 자리 (거기서 바탕화면으로 날아간다) */
	onAdd: (kind: WidgetKind, size: WidgetSize, from: { x: number; y: number }) => void;
	/** 위젯을 시트 자리로 끄는 동안 잠시 내려 둔다 */
	away?: boolean;
}) => {
	// 편집이 끝나 빠질 때 아래로 내려가며 사라진다
	const exit = useExitMotion<HTMLDivElement>('widget-gallery-out');
	const [kind, setKind] = useState<WidgetKind | null>(null);
	const [query, setQuery] = useState('');
	const needle = query.trim().toLowerCase();
	const kinds = WIDGET_KINDS.filter(
		(item) =>
			!needle ||
			WIDGET_INFO[item].label.toLowerCase().includes(needle) ||
			WIDGET_INFO[item].description.toLowerCase().includes(needle)
	);
	const shown = kind && kinds.includes(kind) ? [kind] : kinds;

	return (
		<div ref={exit} className={`widget-gallery${away ? ' away' : ''}`} role="dialog" aria-label="위젯 갤러리">
			<nav className="widget-gallery-sidebar" aria-label="위젯 종류">
				<SearchField
					className="widget-gallery-search"
					label="위젯 검색"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				<ul>
					<li>
						<button type="button" aria-current={kind === null || undefined} onClick={() => setKind(null)}>
							<AllWidgetsGlyph />
							모든 위젯
						</button>
					</li>
					{kinds.map((item) => (
						<li key={item}>
							<button type="button" aria-current={kind === item || undefined} onClick={() => setKind(item)}>
								<KindIcon kind={item} />
								{WIDGET_INFO[item].label}
							</button>
						</li>
					))}
				</ul>
			</nav>

			<section className="widget-gallery-main" aria-label={kind ? WIDGET_INFO[kind].label : '모든 위젯'}>
				{kind ? (
					<header>
						<h2>{WIDGET_INFO[kind].label}</h2>
						<p>{WIDGET_INFO[kind].description}</p>
					</header>
				) : (
					<h2 className="widget-gallery-heading">제안</h2>
				)}
				{shown.length === 0 ? (
					<p className="widget-gallery-empty">‘{query.trim()}’에 맞는 위젯이 없습니다.</p>
				) : (
					<ul className="widget-gallery-list">
						{shown.flatMap((item) =>
							WIDGET_INFO[item].sizes.map((size) => (
								<li key={`${item}-${size}`} className={`widget-gallery-cell ${size}`}>
									<button
										type="button"
										className="widget-gallery-item"
										aria-label={`${WIDGET_INFO[item].label} 위젯 (${SIZE_LABEL[size]}) 더하기`}
										onClick={(event) => {
											const rect = event.currentTarget.getBoundingClientRect();
											onAdd(item, size, { x: rect.left, y: rect.top });
										}}
									>
										<span className="widget-gallery-preview" style={pixelSize(size)} inert>
											<Widget kind={item} size={size} open={() => {}} />
										</span>
										{/* 올리면 macOS처럼 왼쪽 위에 초록 + */}
										<span className="widget-gallery-plus" aria-hidden="true">
											<i className="fa-solid fa-plus"></i>
										</span>
									</button>
									<span className="widget-gallery-caption">
										{WIDGET_INFO[item].label} · {SIZE_LABEL[size]}
									</span>
								</li>
							))
						)}
					</ul>
				)}
			</section>

			<footer className="widget-gallery-footer">
				<p>위젯을 누르면 바탕화면의 빈 칸에 놓입니다. 놓은 위젯은 끌어서 옮기고, 오른쪽 클릭으로 크기를 바꿉니다.</p>
				<Button tone="primary" onClick={closeWidgetEditor}>
					완료
				</Button>
			</footer>
		</div>
	);
};

export default WidgetGallery;
