import React from 'react';
import AppWindow from '@/desktop/window/Window';
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

	return (
		<AppWindow title="메시지" appName="messages" chrome="unified">
			<div className={`messages ${conversations.isChatOpen ? 'chat-open' : ''}`}>
				<Sidebar
					threads={conversations.threads}
					selectedId={conversations.selectedId}
					onSelect={conversations.select}
					onCompose={conversations.compose}
				/>
				{(isComposing || selectedThread) && (
					<ChatView
						key={isComposing ? NEW_THREAD : selectedThread!.id}
						thread={isComposing ? null : selectedThread}
						messages={conversations.messages}
						identity={conversations.identity}
						focusRequest={conversations.focusRequest}
						onBack={conversations.back}
						onCancelNew={conversations.cancelNewThread}
						onCompose={conversations.compose}
						onSend={conversations.send}
						onRemove={conversations.remove}
					/>
				)}
			</div>
		</AppWindow>
	);
};

export default Messages;
