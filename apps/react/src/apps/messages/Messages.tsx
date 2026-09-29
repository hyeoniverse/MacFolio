import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import { NEW_THREAD, useConversations } from './useConversations';
import '@/apps/messages/Messages.css';

/**
 * 메시지: 감상·의견·피드백을 남기는 공간. 쓰기 버튼으로 남긴 피드백 하나가 목록의 항목 하나가 되고,
 * 누구나 어느 피드백에나 답글을 달 수 있다. 창이 좁으면 목록과 대화를 한 화면씩 보여준다.
 */
const Messages: React.FC = () => {
	const conversations = useConversations();
	const { selectedThread, isComposing } = conversations;
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

	return (
		<AppWindow title="메시지" appName="messages" chrome="unified">
			{/* 모바일 제목 막대의 뒤로 가기 (iOS처럼 화면마다 하나) */}
			<MobileNavigation
				{...(conversations.isChatOpen ? { backLabel: '메시지', onBack: back(conversations.back) } : {})}
			/>
			<div className={`messages ${conversations.isChatOpen ? 'chat-open' : ''}`} data-nav={nav}>
				<Sidebar
					threads={conversations.threads}
					selectedId={conversations.selectedId}
					onSelect={forward(conversations.select)}
					onCompose={forward(conversations.compose)}
				/>
				{(isComposing || selectedThread) && (
					<ChatView
						key={isComposing ? NEW_THREAD : selectedThread!.id}
						thread={isComposing ? null : selectedThread}
						messages={conversations.messages}
						identity={conversations.identity}
						focusRequest={conversations.focusRequest}
						onBack={back(conversations.back)}
						onCancelNew={back(conversations.cancelNewThread)}
						onCompose={forward(conversations.compose)}
						onSend={conversations.send}
						onRemove={conversations.remove}
					/>
				)}
			</div>
		</AppWindow>
	);
};

export default Messages;
