import React, { useEffect, useRef, useState } from 'react';
import { fileUrl } from '@/apps/finder/documents';

/**
 * 그림 보기 (미리보기 앱, 휴대폰 파일 앱). 맞춤이면 칸 안에 들어오게(키우지는 않는다), 배율이면 실제 크기 기준으로.
 * rotation(0·90·180·270)만큼 돌린다. 돌리면 가로세로가 바뀌므로 맞춤도 돌린 크기로 계산한다
 */
const ImageView: React.FC<{
	fileKey: string;
	name: string;
	zoom: number | null;
	rotation?: number;
	onScale?: (scale: number) => void;
	/** 바깥 여백 (px) */
	padding?: number;
}> = ({ fileKey, name, zoom, rotation = 0, onScale, padding = 24 }) => {
	const box = useRef<HTMLElement>(null);
	const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
	const [area, setArea] = useState({ width: 0, height: 0 });
	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const observer = new ResizeObserver(() => setArea({ width: el.clientWidth, height: el.clientHeight }));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	const sideways = rotation % 180 !== 0;
	const shown = natural && (sideways ? { width: natural.height, height: natural.width } : natural);
	const fit =
		shown && area.width > 0
			? Math.min(1, (area.width - padding * 2) / shown.width, (area.height - padding * 2) / shown.height)
			: 1;
	const scale = zoom ?? fit;
	useEffect(() => onScale?.(scale), [scale, onScale]);
	return (
		<section ref={box} className="preview-image" aria-label={name} tabIndex={0} style={{ padding }}>
			{/* 돌린 그림이 차지하는 칸. 그림은 그 가운데에서 돈다 */}
			<div
				className="preview-image-frame"
				style={shown ? { width: shown.width * scale, height: shown.height * scale } : undefined}
			>
				<img
					src={fileUrl(fileKey)}
					alt={name}
					draggable={false}
					style={
						natural
							? {
									width: natural.width * scale,
									height: natural.height * scale,
									transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
								}
							: undefined
					}
					onLoad={(event) =>
						setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
					}
				/>
			</div>
		</section>
	);
};

export default ImageView;
