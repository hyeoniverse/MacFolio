import { useMemo } from 'react';
import { loadPlaces, loadUnit } from '@/apps/weather/places';
import { useForecasts } from '@/apps/weather/useForecasts';
import { useHomeScreenShown } from '@/desktop/useAppWindowShown';
import type { WidgetSize } from './catalog';

/** 날씨 앱의 첫 도시 (그 앱에서 고른 순서와 기온 단위를 따른다) */
const WeatherWidget = ({ size }: { size: WidgetSize }) => {
	const places = useMemo(() => loadPlaces().slice(0, 1), []);
	const unit = useMemo(() => loadUnit(), []);
	// 바탕화면·홈 화면이 보이는 동안만 다시 묻는다 (날씨 앱과 같은 도시면 응답을 나눠 쓴다)
	const { forecastOf } = useForecasts(places, unit, useHomeScreenShown());
	const place = places[0];
	const loaded = forecastOf(place);

	if (!loaded || loaded.status === 'error')
		return (
			<div className="widget-weather-body">
				<p className="widget-title">{place.name}</p>
				<p className="widget-note">{loaded ? '날씨를 불러오지 못했습니다' : '불러오는 중…'}</p>
			</div>
		);

	const { weather } = loaded;
	return (
		<div className="widget-weather-body" data-sky={weather.sky} data-day={weather.day || undefined}>
			<div className="widget-weather-now">
				<p className="widget-title">
					{place.name} <i className="fa-solid fa-location-arrow" aria-hidden="true"></i>
				</p>
				<p className="widget-weather-temp">{Math.round(weather.temp)}°</p>
				<i className={`fa-solid ${weather.icon} widget-weather-icon`} aria-hidden="true"></i>
				<p className="widget-weather-label">{weather.label}</p>
				<p className="widget-note">
					최고 {Math.round(weather.high)}° 최저 {Math.round(weather.low)}°
				</p>
			</div>
			{size === 'medium' && (
				<ol className="widget-weather-hours" aria-label="시간별 예보">
					{weather.hours.slice(0, 4).map((hour) => (
						<li key={hour.label}>
							<span>{hour.label}</span>
							<i className={`fa-solid ${hour.icon}`} aria-label={hour.condition}></i>
							<span>{Math.round(hour.temp)}°</span>
						</li>
					))}
				</ol>
			)}
		</div>
	);
};

export default WeatherWidget;
