import React, { useState } from 'react';
import { useAppState } from '@/desktop/useAppState';
import AppWindow from '@/desktop/window/Window';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import { NEW_THREAD, useConversations } from './useConversations';
import { useElementWidth } from '@/shared/hooks/useElementWidth';
import { useOpenRequest } from '@/shared/lib/openRequest';
import { REPORT_ISSUE_REQUEST } from './conversations';
import { NEW_ISSUE_URL } from '@/apps/finder/repoDocs';
import { openExternal } from '@/shared/analytics/analytics';
import '@/apps/messages/Messages.css';

/**
 * 메시지: 감상·의견·피드백을 남기는 공간. 쓰기 버튼으로 남긴 피드백 하나가 목록의 항목 하나가 되고,
 * 누구나 어느 피드백에나 답글을 달 수 있다. 창이 좁으면 목록과 대화를 한 화면씩 보여준다.
 */
/** 앱 폭이 이 이하이면 목록과 대화를 한 화면씩 보여 준다 (Messages.css의 @container (max-width: 640px)와 같은 값) */
const COMPACT_MAX_WIDTH = 640;

const Messages: React.FC = () => {
	const conversations = useConversations();
	const { quitApp } = useAppState();
	const { selectedThread, isComposing } = conversations;
	/** 목록과 대화를 한 화면씩 보는지. 휴대폰 셸이라도 iPad mini 세로(744px)처럼 넓으면 둘을 나란히 보여 준다 */
	const { attach, width } = useElementWidth<HTMLDivElement>();
	const compact = width <= COMPACT_MAX_WIDTH;
	// 좁은 창에서 넘어간 방향 (처음에는 애니메이션 없음)
	const [nav, setNav] = useState<'forward' | 'back' | undefined>();
	const forward =
		<Args extends unknown[]>(action: (...args: Args) => void) =>
		(...args: Args) => {
			setNav('forward');
			action(...args);
		};
	const back =
		<Args extends unknown[]>(action: (...args: Args) => void) =>
		(...args: Args) => {
			setNav('back');
			action(...args);
		};

	// 도움말 › 문제 알리기: 새 피드백 화면을 열고 입력 칸에 커서를 둔다 (앱이 처음 열리는 중이면 마운트된 뒤에 받는다)
	useOpenRequest('messages', (id) => {
		if (id !== REPORT_ISSUE_REQUEST) return;
		setNav('forward');
		conversations.compose('issue');
	});

	return (
		<AppWindow title="메시지" appName="messages" chrome="unified">
			{/* 모바일 제목 막대의 뒤로 가기 (iOS처럼 화면마다 하나). 목록이 옆에 보이면 돌아갈 곳이 없으므로 홈.
			    키보드가 올라오면 머리는 화면 위에 두고 대화와 입력 칸만 키보드 위로 줄인다 */}
			<MobileNavigation
				fitKeyboard
				// 대화 화면은 머리가 직접 반투명 재질을 그리므로 스크롤 가장자리 흐림을 끈다 (두 겹으로 흐려지지 않게)
				scrollEdge={!(compact && conversations.isChatOpen)}
				{...(compact && conversations.isChatOpen ? { backLabel: '메시지', onBack: back(conversations.back) } : {})}
			/>
			{conversations.status !== 'error' && (
				<div ref={attach} className={`messages ${conversations.isChatOpen ? 'chat-open' : ''}`} data-nav={nav}>
					<Sidebar
						threads={conversations.threads}
						selectedId={conversations.selectedId}
						onSelect={forward(conversations.select)}
						onCompose={forward(() => conversations.compose())}
						loading={conversations.status === 'loading'}
					/>
					{(isComposing || selectedThread) && (
						<ChatView
							key={isComposing ? NEW_THREAD : selectedThread!.id}
							thread={isComposing ? null : selectedThread}
							messages={conversations.messages}
							myName={conversations.myName}
							focusRequest={conversations.focusRequest}
							composeKind={conversations.composeKind}
							onBack={back(conversations.back)}
							onCancelNew={back(conversations.cancelNewThread)}
							onCompose={forward(() => conversations.compose())}
							onSend={conversations.send}
							onRemove={conversations.remove}
						/>
					)}
				</div>
			)}
			{/* 서버에 닿지 못하면 불러오지도 남기지도 못하므로 앱을 열지 않는다. 확인하면 앱을 끈다 (휴대폰은 홈으로).
			    문제 알리기로 열었으면 막다른 길이 되지 않게 GitHub 이슈(새 탭)를 대신 권한다 */}
			{conversations.status === 'error' && conversations.composeKind === 'issue' && (
				<AlertDialog
					title="메시지를 열 수 없습니다"
					message="지금 서버에 연결할 수 없습니다. 문제는 GitHub 이슈로 남겨 주세요."
					confirmLabel="이슈 남기기"
					cancelLabel="닫기"
					onConfirm={() => {
						openExternal(NEW_ISSUE_URL);
						quitApp('messages');
					}}
					onCancel={() => quitApp('messages')}
				/>
			)}
			{conversations.status === 'error' && conversations.composeKind !== 'issue' && (
				<AlertDialog
					title="메시지를 열 수 없습니다"
					message="지금 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요."
					confirmLabel="확인"
					cancelLabel={null}
					onConfirm={() => quitApp('messages')}
					onCancel={() => quitApp('messages')}
				/>
			)}
		</AppWindow>
	);
};

export default Messages;
