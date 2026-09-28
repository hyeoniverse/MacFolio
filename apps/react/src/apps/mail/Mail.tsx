import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import '@/apps/mail/Mail.css'; // Mail 관련 스타일 추가

const Mail: React.FC = () => {
	// 메일 목록 데이터 (더미 데이터)
	const mails = [
		{
			id: 1,
			subject: 'Welcome!',
			from: 'codingkirby0@gmail.com',
			content: 'Thank you for joining my site.\nI am looking for a job! Please contact me.',
		},
	];

	// 상태 관리 (선택된 메일)
	const [selectedMail, setSelectedMail] = useState<number | null>(null);

	// 선택한 메일을 상세 보기에서 보여줌
	const mailDetails = selectedMail !== null ? mails.find((mail) => mail.id === selectedMail) : null;

	return (
		<AppWindow title="Mail" appName="mail" appStyle={{ overflow: 'hidden' }}>
			<div className="mail-app">
				<div className="mail-list">
					<h3>Inbox</h3>
					<ul>
						{mails.map((mail) => (
							<li
								key={mail.id}
								onClick={() => setSelectedMail(mail.id)}
								className={selectedMail === mail.id ? 'active' : ''}
							>
								<span className="mail-subject">{mail.subject}</span>
								<span className="mail-from">{mail.from}</span>
							</li>
						))}
					</ul>

					<a className="mail-compose" href="mailto: codingkirby0@gmail.com">
						<i className="fa-solid fa-paper-plane"></i>
					</a>
				</div>

				<div className="mail-details">
					{mailDetails ? (
						<div>
							<h4>{mailDetails.subject}</h4>
							<p>From: {mailDetails.from}</p>
							<p>{mailDetails.content}</p>
						</div>
					) : (
						<p>Select a mail to read</p>
					)}
				</div>
			</div>
		</AppWindow>
	);
};

export default Mail;
