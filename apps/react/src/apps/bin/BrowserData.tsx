import { useEffect, useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { requestFinderDoc } from '@/apps/finder/openDoc';
import { DEFAULT_SETTINGS } from '@/shared/settings/settings';
import { settingsStore } from '@/shared/settings/settingsStore';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import { clearBrowserData, readBrowserData, type BrowserDataItem } from './siteStorage';
import { formatSize } from './filesApi';
import { refreshBin } from './binState';

/** 지운다. 설정은 앱이 들고 있는 값도 처음 설정으로 돌린다 (돌리면 저장소에 다시 쓰므로 그 뒤에 지운다) */
function clear(item: BrowserDataItem) {
	if (item.id === 'settings') settingsStore.setState(DEFAULT_SETTINGS);
	clearBrowserData(item);
}

/** 방문자 이름 쿠키: 다른 줄과 같은 모양이되, 사이트가 비울 수 없어서 비우기 대신 어디서 지우는지 적는다 */
const CookieNote = () => (
	<li className="bin-data">
		<span className="bin-data-name">방문자 이름 쿠키</span>
		<span className="bin-data-meta">macfolio_visitor</span>
		<span className="bin-data-description">
			메시지나 댓글을 쓰면 서버가 주는 쿠키로, 이 브라우저의 이름(예: 🦊 날쌘 여우)을 정합니다. 사이트가 읽거나 지울 수
			없게 해 두어서, 지우려면 브라우저 설정에서 macfolio-api.hyeoniverse.com의 쿠키를 지우세요. 지우면 그 브라우저에서
			쓴 글을 더는 지울 수 없습니다.
		</span>
		<span className="bin-data-clear bin-data-elsewhere">브라우저 설정에서</span>
	</li>
);

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
			{/* macOS Finder의 휴지통처럼: 위쪽 줄에 비우기 단추(비었으면 꺼짐), 아래에 항목 수 */}
			<div className="bin-files-summary">
				<span>
					{stored.length > 0
						? `이 사이트가 이 브라우저에 남긴 것 ${stored.length}가지 · ${formatSize(stored.reduce((sum, entry) => sum + entry.bytes, 0))}`
						: '내 브라우저 데이터'}
				</span>
				{/* Finder 휴지통의 작은 회색 '비우기' 단추 (비었으면 꺼짐) */}
				<button
					type="button"
					className="bin-empty-button"
					aria-label="휴지통 비우기"
					onClick={() => setConfirm(true)}
					disabled={stored.length === 0}
				>
					비우기
				</button>
			</div>
			{stored.length > 0 ? (
				<ul className="bin-data-list" aria-label="내 브라우저 데이터">
					{stored.map(({ item, bytes, summary }) => (
						<li key={item.id} className="bin-data">
							<span className="bin-data-name">{item.name}</span>
							<span className="bin-data-meta">{[summary, formatSize(bytes)].filter(Boolean).join(' · ')}</span>
							<span className="bin-data-description">{item.description}</span>
							<button
								type="button"
								className="bin-empty-button bin-data-clear"
								title={item.afterClear}
								onClick={() => {
									clear(item);
									refresh();
								}}
							>
								비우기
							</button>
						</li>
					))}
					<CookieNote />
				</ul>
			) : (
				// 비었으면 Finder처럼 가운데를 비워 둔다 (화면 읽기 프로그램에는 비었다고 알린다)
				<div className="bin-empty-space">
					<span className="visually-hidden" role="status">
						휴지통이 비어 있습니다
					</span>
				</div>
			)}

			<p className="bin-files-note">
				{stored.length === 0 &&
					'방문자 이름 쿠키(macfolio_visitor)는 사이트가 지울 수 없어 여기에 없습니다. 지우려면 브라우저 설정에서 지우세요. '}
				방문 통계는 쿠키 없이 합계만 남깁니다. 서버에 무엇을 얼마나 보관하는지는{' '}
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

			<div className="bin-statusbar" aria-live="polite">
				{stored.length}개의 항목
			</div>

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
