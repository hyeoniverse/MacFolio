// keynote 템플릿의 화면 모음: 발표자 화면처럼 큰 무대에 한 장을 띄우고, 아래의 슬라이드 목록에서 고른다.
// 모든 장의 그림과 설명은 목록에 늘 있다 (고른 장만 무대에 크게)
import React, { useState } from 'react';
import { Media, type LandingShot } from '@/apps/safari/project/landing';

const pad = (n: number) => String(n).padStart(2, '0');

export const Screens: React.FC<{ shots: LandingShot[] }> = ({ shots }) => {
	const [current, setCurrent] = useState(0);
	const shot = shots[Math.min(current, shots.length - 1)];
	return (
		<div className="kn-screens">
			<figure className="kn-screens-stage" data-reveal="">
				<div className="kn-frame">
					<Media key={shot.src} media={shot} className="kn-frame-media" />
				</div>
				<figcaption>
					<span className="kn-index">
						{pad(current + 1)} / {pad(shots.length)}
					</span>
					<span>{shot.caption}</span>
				</figcaption>
			</figure>
			{shots.length > 1 && (
				<ul className="kn-thumbs" aria-label="화면 고르기" data-count={Math.min(shots.length, 6)}>
					{shots.map((item, index) => (
						<li key={item.src}>
							<button type="button" aria-pressed={index === current} onClick={() => setCurrent(index)}>
								<span className="kn-thumb">
									<Media media={item} decorative />
								</span>
								<span className="kn-thumb-caption">
									<span className="kn-index">{pad(index + 1)}</span>
									{item.caption}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
