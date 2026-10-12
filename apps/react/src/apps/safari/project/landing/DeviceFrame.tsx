// 기기 틀: 그림·영상(또는 MockScreen 같은 자식)을 브라우저 창, 노트북, 휴대폰, 태블릿 틀에 넣는다
import React from 'react';
import './landing.css';
import './device.css';

export type DeviceKind = 'browser' | 'laptop' | 'phone' | 'tablet';

export interface DeviceFrameProps {
	kind?: DeviceKind;
	/** 화면에 넣을 그림·영상(.mp4) 주소. 없으면 children을 화면에 그린다 */
	src?: string;
	/** 그림 설명 (없으면 장식으로 보고 alt를 비운다) */
	alt?: string;
	/** 그림 대신 화면에 넣을 것 (예: <MockScreen />) */
	children?: React.ReactNode;
	/** 브라우저 주소 막대의 글 (예: 데모 주소). 없으면 빈 막대 */
	url?: string;
	/** 살짝 기울인다: true·'left'는 왼쪽으로, 'right'는 오른쪽으로 (3D 원근) */
	tilt?: boolean | 'left' | 'right';
	/** 기기 뒤에 강조색 빛이 번진다 */
	glow?: boolean;
	/** 바닥에 비친 반사 (기본 끔. -webkit-box-reflect를 아는 브라우저만) */
	reflection?: boolean;
	/** 그림자 (기본 켬) */
	shadow?: boolean;
	className?: string;
	style?: React.CSSProperties;
}

const isVideo = (src: string) => /\.mp4($|\?)/i.test(src);

/** 브라우저 주소 막대에 보일 글: https://와 끝의 /를 뗀다 */
const displayUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
	kind = 'browser',
	src,
	alt = '',
	children,
	url,
	tilt = false,
	glow = false,
	reflection = false,
	shadow = true,
	className,
	style,
}) => {
	const screen = src ? (
		isVideo(src) ? (
			<video
				className="lk-device-media"
				src={src}
				muted
				loop
				playsInline
				autoPlay
				aria-label={alt || undefined}
				aria-hidden={alt ? undefined : true}
			/>
		) : (
			<img className="lk-device-media" src={src} alt={alt} loading="lazy" />
		)
	) : (
		children
	);
	const tiltSide = tilt === true ? 'left' : tilt || undefined;
	return (
		<figure
			className={`lk-root lk-device${className ? ` ${className}` : ''}`}
			data-kind={kind}
			data-tilt={tiltSide}
			data-glow={glow ? '' : undefined}
			data-reflection={reflection ? '' : undefined}
			data-shadow={shadow ? '' : undefined}
			style={style}
		>
			{glow && <span className="lk-device-glow" aria-hidden="true" />}
			<div className="lk-device-body">
				{kind === 'browser' && (
					<div className="lk-device-chrome" aria-hidden="true">
						<span className="lk-device-lights">
							<i />
							<i />
							<i />
						</span>
						<span className="lk-device-url">
							<span className="lk-device-lock fa-solid fa-lock" />
							{url ? displayUrl(url) : ''}
						</span>
						<span className="lk-device-tools">
							<i />
							<i />
						</span>
					</div>
				)}
				{kind === 'phone' && <span className="lk-device-island" aria-hidden="true" />}
				{kind === 'laptop' && <span className="lk-device-notch" aria-hidden="true" />}
				<div className="lk-device-screen">{screen}</div>
				{(kind === 'phone' || kind === 'tablet') && <span className="lk-device-glare" aria-hidden="true" />}
			</div>
			{kind === 'laptop' && (
				<div className="lk-device-base" aria-hidden="true">
					<span />
				</div>
			)}
		</figure>
	);
};
