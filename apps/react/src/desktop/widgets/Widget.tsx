import type { AppName } from '@/apps/manifest';
import { useMusic } from '@/apps/music/useMusic';
import MusicWidget from '@/desktop/mobile/MusicWidget';
import { requestOpen } from '@/shared/lib/openRequest';
import { WIDGET_INFO, type WidgetKind, type WidgetOptions, type WidgetSize } from './catalog';
import CalendarWidget from './CalendarWidget';
import ClockWidget from './ClockWidget';
import GithubWidget from './GithubWidget';
import PhotoWidget from './PhotoWidget';
import PostsWidget from './PostsWidget';
import ProfileWidget from './ProfileWidget';
import QuoteWidget from './QuoteWidget';
import WeatherWidget from './WeatherWidget';
import './Widgets.css';

/** 위젯을 누르면 여는 앱 (macOS·iOS처럼 위젯의 빈 곳을 누르면 그 앱이 열린다). 없으면 열지 않는다 */
const APP_OF: Record<WidgetKind, AppName | null> = {
	weather: 'weather',
	calendar: null,
	clock: null,
	music: 'music',
	posts: 'memo',
	photos: 'photos',
	github: 'github',
	profile: null,
	quote: null,
};

/** 작은 음악 위젯: 앨범 그림, 곡 이름, 재생 버튼 */
const MusicSmall = () => {
	const { isPlaying, track, togglePlayPause } = useMusic();
	return (
		<div className="widget-music-small">
			<img src={track.artwork} alt="" draggable={false} />
			<strong className="widget-title">{track.title}</strong>
			<span className="widget-note">{track.artist}</span>
			<button type="button" aria-label={isPlaying ? '일시 정지' : '재생'} onClick={togglePlayPause}>
				<i className={`fas fa-fw ${isPlaying ? 'fa-pause' : 'fa-play'}`} aria-hidden="true"></i>
			</button>
		</div>
	);
};

interface Props {
	kind: WidgetKind;
	size: WidgetSize;
	/** 위젯마다 고른 값 (사진 위젯의 앨범) */
	options?: WidgetOptions;
	/** 앱을 연다 (데스크톱은 창, 휴대폰은 화면 가득) */
	open: (app: AppName) => void;
	className?: string;
}

/**
 * 위젯 하나 (데스크톱 바탕화면과 휴대폰 홈 화면이 같이 쓴다). 크기와 종류에 맞는 내용을 그리고,
 * 단추·글 같은 조작이 아닌 곳을 누르면 그 위젯의 앱을 연다
 */
const Widget = ({ kind, size, options, open, className = '' }: Props) => {
	const app = APP_OF[kind];
	const openPost = (slug: string) => {
		requestOpen('memo', slug);
		open('memo');
	};
	let body;
	switch (kind) {
		case 'weather':
			body = <WeatherWidget size={size} />;
			break;
		case 'calendar':
			body = <CalendarWidget size={size} />;
			break;
		case 'clock':
			body = <ClockWidget />;
			break;
		case 'music':
			// 빈 곳을 누르면 여는 일은 바깥(이 위젯)이 한다
			body = size === 'medium' ? <MusicWidget className="widget-music" onOpen={() => {}} /> : <MusicSmall />;
			break;
		case 'posts':
			body = <PostsWidget size={size} mode={options?.posts} openPost={openPost} />;
			break;
		case 'photos':
			body = <PhotoWidget album={options?.album} />;
			break;
		case 'github':
			body = <GithubWidget size={size} />;
			break;
		case 'profile':
			body = <ProfileWidget />;
			break;
		case 'quote':
			body = <QuoteWidget size={size} />;
			break;
	}
	return (
		<div
			className={`widget widget-${kind} widget-${size} ${className}`}
			role="group"
			aria-label={`${WIDGET_INFO[kind].label} 위젯`}
			data-widget={kind}
			onClick={(event) => {
				if (app && !(event.target as Element).closest('button, a, [role="slider"], input')) open(app);
			}}
		>
			{body}
		</div>
	);
};

export default Widget;
