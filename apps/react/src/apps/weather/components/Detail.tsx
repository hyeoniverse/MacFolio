import { uvLevel, type Weather as WeatherData } from '../forecast';
import { type Place } from '../places';

const Tile = ({ icon, title, value, note }: { icon: string; title: string; value: string; note?: string }) => (
	<section className="weather-panel weather-tile" aria-label={title}>
		<h3>
			<i className={`fa-solid ${icon}`} aria-hidden="true" /> {title}
		</h3>
		<strong>{value}</strong>
		{note && <p>{note}</p>}
	</section>
);

/** 고른 장소의 날씨: 큰 기온, 시간별(위에 한두 문장), 10일, 상세 칸 */
const Detail = ({ place, weather }: { place: Place; weather: WeatherData }) => {
	const span = Math.max(1, weather.range.max - weather.range.min);
	const position = (value: number) => `${((value - weather.range.min) / span) * 100}%`;
	return (
		<>
			<header className="weather-hero">
				<p className="weather-hero-region">{place.region}</p>
				<h1>{place.name}</h1>
				<p className="weather-hero-temp" aria-label={`현재 기온 ${weather.temp}도`}>
					{weather.temp}°
				</p>
				<p className="weather-hero-label">{weather.label}</p>
				<p className="weather-hero-range">
					최고:{weather.high}° 최저:{weather.low}°
				</p>
			</header>

			<section className="weather-panel weather-hours" aria-label="시간별 일기예보">
				<p className="weather-summary">{weather.summary}</p>
				<ol>
					{weather.hours.map((hour, index) => (
						<li key={index}>
							<span className="weather-hour-label">{hour.label}</span>
							<i className={`fa-solid ${hour.icon}`} aria-hidden="true" />
							<span className="weather-rain">{hour.rain !== null ? `${hour.rain}%` : ''}</span>
							<strong>{hour.temp}°</strong>
						</li>
					))}
				</ol>
			</section>

			{/* 넓으면 두 단: 왼쪽 10일, 오른쪽 상세 칸 (macOS 날씨) */}
			<div className="weather-columns">
				<section className="weather-panel weather-days" aria-label="10일간의 일기예보">
					<h3>
						<i className="fa-regular fa-calendar" aria-hidden="true" /> 10일간의 일기예보
					</h3>
					<ol>
						{weather.days.map((day, index) => (
							<li key={index}>
								<span className="weather-day-label">{day.label}</span>
								<span className="weather-day-icon">
									<i className={`fa-solid ${day.icon}`} aria-hidden="true" />
									{day.rain !== null && <span className="weather-rain">{day.rain}%</span>}
								</span>
								<span className="weather-day-min">{day.min}°</span>
								<span className="weather-day-bar" aria-hidden="true">
									<span style={{ left: position(day.min), right: `calc(100% - ${position(day.max)})` }} />
									{index === 0 && <i className="weather-day-now" style={{ left: position(weather.temp) }} />}
								</span>
								<span className="weather-day-max">{day.max}°</span>
							</li>
						))}
					</ol>
				</section>

				<div className="weather-tiles">
					<Tile
						icon="fa-temperature-half"
						title="체감 온도"
						value={`${weather.feelsLike}°`}
						note={
							weather.feelsLike < weather.temp
								? '바람 때문에 더 춥게 느껴집니다.'
								: weather.feelsLike > weather.temp
									? '습도 때문에 더 덥게 느껴집니다.'
									: '실제 기온과 비슷합니다.'
						}
					/>
					<Tile icon="fa-droplet" title="습도" value={`${weather.humidity}%`} />
					<Tile
						icon="fa-wind"
						title="바람"
						value={`${weather.wind}m/s`}
						note={weather.gust !== null ? `${weather.windFrom} · 돌풍 최대 ${weather.gust}m/s` : weather.windFrom}
					/>
					<Tile
						icon="fa-sun"
						title="자외선 지수"
						value={weather.uv !== null ? String(Math.round(weather.uv)) : '—'}
						note={weather.uv !== null ? uvLevel(weather.uv) : undefined}
					/>
					<Tile icon="fa-sun" title="일출" value={weather.sunrise} note={`일몰: ${weather.sunset}`} />
					<Tile icon="fa-cloud-rain" title="강수량" value={`${weather.precipitation}mm`} note="지난 1시간" />
				</div>
			</div>
		</>
	);
};

export default Detail;
