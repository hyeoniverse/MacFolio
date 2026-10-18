import React, { useEffect, useMemo, useRef } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { fileUrl } from '@/apps/finder/documents';
import { isFileItem, mediaKind, type FileItem, type FinderItem } from '@/apps/finder/files';
import { useLocations } from '@/apps/finder/useLocations';
import FinderIcon from '@/apps/finder/FinderIcon';
import { openInPlayer, resetPlayer, usePlayer } from './playerStore';
import './QuickTime.css';

/** 트리 안의 동영상·소리 파일 (파일 고르기 칸) */
const mediaFiles = (items: FinderItem[]): FileItem[] =>
	items.flatMap((item) =>
		item.kind === 'folder' && !item.aliasOf
			? mediaFiles(item.children)
			: isFileItem(item) && mediaKind(item.name)
				? [item]
				: []
	);

/**
 * QuickTime Player (macOS처럼): Finder·바탕화면에서 연 동영상·소리 파일을 재생한다. 검은 바탕에 브라우저 기본 재생 막대(재생·멈춤·시간·소리·전체 화면).
 * 파일 없이 열면 올린 동영상·소리 파일을 골라 연다. 창을 닫으면 비운다 (다음에 열면 고르기부터)
 */
const QuickTime: React.FC = () => {
	const file = usePlayer();
	const { apps } = useAppState();
	const locations = useLocations();
	const choices = useMemo(() => {
		const seen = new Set<string>();
		return mediaFiles(locations).filter((item) => !seen.has(item.key) && seen.add(item.key));
	}, [locations]);

	// 빨간 버튼으로 닫으면 비운다 (미리보기와 같다)
	const running = apps.quicktime.isRunning;
	const wasRunning = useRef(running);
	useEffect(() => {
		if (wasRunning.current && !running) resetPlayer();
		wasRunning.current = running;
	}, [running]);

	return (
		<AppWindow title={file?.name ?? 'QuickTime Player'} appName="quicktime">
			<div className={`quicktime${file ? ' playing' : ''}`}>
				{file?.media === 'video' ? (
					<video
						key={file.key}
						className="quicktime-video"
						src={fileUrl(file.key)}
						controls
						autoPlay
						playsInline
						aria-label={file.name}
					/>
				) : file?.media === 'audio' ? (
					<div className="quicktime-audio">
						<i className="fa-solid fa-music" aria-hidden="true" />
						<p>{file.name}</p>
						<audio key={file.key} src={fileUrl(file.key)} controls autoPlay aria-label={file.name} />
					</div>
				) : (
					<div className="quicktime-pick">
						<p className="quicktime-pick-title">재생할 파일을 고르세요</p>
						{choices.length === 0 ? (
							<p className="quicktime-pick-empty">
								올린 동영상·소리 파일이 없습니다. Finder에 mp4·mov·mp3 등을 끌어다 놓으세요.
							</p>
						) : (
							<ul className="quicktime-pick-list" aria-label="동영상·소리 파일">
								{choices.map((item) => (
									<li key={item.id}>
										<button
											type="button"
											onClick={() => openInPlayer({ key: item.key, name: item.name, media: mediaKind(item.name)! })}
										>
											<span className="quicktime-pick-icon">
												<FinderIcon item={item} />
											</span>
											{item.name}
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</div>
		</AppWindow>
	);
};

export default QuickTime;
