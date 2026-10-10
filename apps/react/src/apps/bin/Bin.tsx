import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useCanEditMemo } from '@/apps/memo/useCanEditMemo';
import BrowserData from './BrowserData';
import ServerFiles from './ServerFiles';
import { useServerFiles } from './useServerFiles';
import './Bin.css';

/**
 * 휴지통: 비울 수 있는 것을 모아 둔다.
 * - 내 브라우저 데이터 (누구나): 이 사이트가 이 브라우저에 남긴 설정·검색어 등. 보고 비운다
 * - 서버 파일 (관리자): 글에서 빼도 서버에 남는 이미지·첨부 중 쓰는 곳이 없는 것
 */
const Bin: React.FC = () => {
	const admin = useCanEditMemo();
	const [section, setSection] = useState<'browser' | 'files'>('browser');
	const inFiles = section === 'files' && admin;
	const serverFiles = useServerFiles(admin);
	const removableCount = serverFiles.rows.filter((row) => row.usage.removable).length;

	return (
		<AppWindow title="휴지통" appName="bin" chrome="unified">
			<div className="bin">
				<div className="bin-body">
					<nav className="bin-sidebar" aria-label="휴지통">
						<div className="bin-lights-space" />
						<h2>휴지통</h2>
						<button
							type="button"
							className={`bin-location${inFiles ? '' : ' active'}`}
							aria-current={inFiles ? undefined : 'page'}
							onClick={() => setSection('browser')}
						>
							<i className="fa-solid fa-laptop" aria-hidden="true" />
							<span>내 브라우저 데이터</span>
						</button>
						{admin && (
							<button
								type="button"
								className={`bin-location${inFiles ? ' active' : ''}`}
								aria-current={inFiles ? 'page' : undefined}
								onClick={() => setSection('files')}
							>
								<i className="fa-solid fa-server" aria-hidden="true" />
								<span>서버 파일</span>
								{removableCount > 0 && <span className="bin-location-count">{removableCount}</span>}
							</button>
						)}
					</nav>

					<div className="bin-main">
						<div className="bin-toolbar">
							<h1 className="bin-title">{inFiles ? '서버 파일' : '내 브라우저 데이터'}</h1>
							{inFiles && <span className="bin-count">{serverFiles.rows.length}개의 항목</span>}
						</div>
						{inFiles ? <ServerFiles files={serverFiles} /> : <BrowserData />}
					</div>
				</div>
			</div>
		</AppWindow>
	);
};

export default Bin;
