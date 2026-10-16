// friendly의 브라우저 창 틀: 점 셋과 주소 칸(장식) 아래에 화면을 담는다. 첫 화면, 기능 탐색기, 화면 모음이 함께 쓴다
import React from 'react';
import { Media, type LandingMedia } from '@/apps/safari/project/landing';

export const Frame: React.FC<{ address?: string; className?: string; children: React.ReactNode }> = ({
	address,
	className,
	children,
}) => (
	<figure className={['fr-window', className].filter(Boolean).join(' ')}>
		<span className="fr-window-bar" aria-hidden="true">
			<i />
			<i />
			<i />
			{address && <span className="fr-window-address">{address}</span>}
		</span>
		<div className="fr-window-body">{children}</div>
	</figure>
);

export const Window: React.FC<{ media: LandingMedia; eager?: boolean; className?: string; address?: string }> = ({
	media,
	eager,
	className,
	address,
}) => (
	<Frame address={address} className={className}>
		<Media media={media} eager={eager} />
	</Frame>
);
