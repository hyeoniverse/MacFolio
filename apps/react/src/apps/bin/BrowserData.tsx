import { useEffect, useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { requestFinderDoc } from '@/apps/finder/openDoc';
import { DEFAULT_SETTINGS } from '@/shared/settings/settings';
import { settingsStore } from '@/shared/settings/settingsStore';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import { clearBrowserData, readBrowserData, type BrowserDataItem } from './siteStorage';
import { formatSize } from './filesApi';
import { refreshBin } from './binState';
import { env } from '@/shared/config/env';

/** 지운다. 설정은 앱이 들고 있는 값도 처음 설정으로 돌린다 (돌리면 저장소에 다시 쓰므로 그 뒤에 지운다) */
function clear(item: BrowserDataItem) {
	if (item.id === 'settings') settingsStore.setState(DEFAULT_SETTINGS);
	clearBrowserData(item);
}

/**
 * 내 브라우저 데이터: 이 사이트가 이 브라우저에 남긴 것을 보여 주고 지운다 (휴지통 비우기).
 * 서버에 남는 것은 개인정보 문서(docs/privacy.md)로 잇는다
 */
const BrowserData = () => {
	const { openApp } = useAppState();
	const [stored, setStored] = useState(readBrowserData);
	const [confirm, setConfirm] = useState(false);
	const refresh = () => {
		setStored(readBrowserData());
		// Dock의 휴지통 그림도 바로
		refreshBin();
	};

	// 휴지통을 연 채 시스템 설정을 바꾸면 바로 보이게
	useEffect(() => settingsStore.subscribe(() => setStored(readBrowserData())), []);

	const emptyAll = () => {
		setConfirm(false);
		stored.forEach(({ item }) => clear(item));
		refresh();
	};

	return (
		<div className="bin-browser" onPointerEnter={refresh}>
			{stored.length > 0 ? (
				<div className="bin-files-summary">
					<span>
						{`이 사이트가 이 브라우저에 남긴 것 ${stored.length}가지 · ${formatSize(stored.reduce((sum, entry) => sum + entry.bytes, 0))}`}
					</span>
					<Button tone="danger" onClick={() => setConfirm(true)}>
						휴지통 비우기
					</Button>
				</div>
			) : (
				// macOS Finder의 빈 휴지통처럼: 빈 휴지통 그림과 '휴지통이 비어 있음'
				<div className="bin-empty-state" role="status">
					<img src={`${env.imageUrl}/bin-empty.png`} alt="" draggable={false} />
					<strong>휴지통이 비어 있음</strong>
					<span>이 사이트가 이 브라우저에 남긴 것이 없습니다.</span>
				</div>
			)}

			<ul className="bin-data-list" aria-label="내 브라우저 데이터">
				{stored.map(({ item, bytes, summary }) => (
					<li key={item.id} className="bin-data">
						<span className="bin-data-name">{item.name}</span>
						<span className="bin-data-meta">{[summary, formatSize(bytes)].filter(Boolean).join(' · ')}</span>
						<span className="bin-data-description">{item.description}</span>
						<Button
							className="bin-data-clear"
							title={item.afterClear}
							onClick={() => {
								clear(item);
								refresh();
							}}
						>
							비우기
						</Button>
					</li>
				))}
				<li className="bin-data note">
					<span className="bin-data-name">방문자 이름 쿠키</span>
					<span className="bin-data-description">
						메시지나 댓글을 쓰면 서버가 이 브라우저에 쿠키(macfolio_visitor)를 주고, 그것으로 이름(예: 🦊 날쌘 여우)을
						정합니다. 사이트의 자바스크립트가 읽거나 지울 수 없게 해 두어서 여기서는 비울 수 없습니다. 지우려면 브라우저
						설정에서 macfolio-api.hyeoniverse.com의 쿠키를 지우세요. 지우면 그 브라우저에서 쓴 글을 더는 지울 수
						없습니다.
					</span>
				</li>
			</ul>

			<p className="bin-files-note">
				방문 통계는 쿠키 없이 합계만 남깁니다. 서버에 무엇을 얼마나 두는지는{' '}
				<button
					type="button"
					className="bin-link"
					onClick={() => {
						requestFinderDoc('docs/privacy.md');
						openApp('finder');
					}}
				>
					개인정보 문서
				</button>
				에 있습니다.
			</p>

			{confirm && (
				<AlertDialog
					title="이 브라우저에 남은 사이트 데이터를 모두 지우겠습니까?"
					message="설정과 메모 보기 설정이 처음으로 돌아갑니다. 방문자 이름 쿠키는 지워지지 않습니다."
					confirmLabel="휴지통 비우기"
					onConfirm={emptyAll}
					onCancel={() => setConfirm(false)}
				/>
			)}
		</div>
	);
};

export default BrowserData;
