import React from 'react';
import AppWindow from '@/desktop/window/Window';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import { NEW_THREAD, useConversations } from './useConversations';
import '@/apps/messages/Messages.css';

/**
 * 메시지: 방문자마다 공개 대화방이 생기고, 주인(김정현)이 각 방에 답장한다.
 * 누구나 모든 대화를 읽을 수 있고, 글은 이 브라우저에서 시작한 자기 대화에만 쓸 수 있다.
 */
const Messages: React.FC = () => {
	const conversations = useConversations();
	const { selectedId, selectedThread, myThreadId } = conversations;

	return (
		<AppWindow title="메시지" appName="messages">
			<div className="messages">
				<Sidebar
					threads={conversations.threads}
					selectedId={selectedId}
					myThreadId={myThreadId}
					onSelect={conversations.select}
					onCompose={conversations.openMyThread}
				/>
				{(selectedId === NEW_THREAD || selectedThread) && (
					<ChatView
						key={selectedId}
						thread={selectedId === NEW_THREAD ? null : selectedThread}
						messages={conversations.messages}
						isMine={selectedId === myThreadId}
						hasMyThread={!!myThreadId}
						onOpenMyThread={conversations.openMyThread}
						onStartThread={conversations.startThread}
						onSend={conversations.send}
						onRemove={conversations.remove}
					/>
				)}
			</div>
		</AppWindow>
	);
};

export default Messages;
