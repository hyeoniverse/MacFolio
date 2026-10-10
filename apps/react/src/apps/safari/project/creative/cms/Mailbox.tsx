import React, { useEffect, useRef, useState } from 'react';

const MAILS = [
	{
		icon: 'fa-reply',
		from: '답글 알림',
		title: '남긴 댓글에 답글이 달렸습니다',
		body: '댓글을 쓸 때 메일을 적어 둔 사람에게만 보냅니다.',
	},
	{
		icon: 'fa-user-plus',
		from: '작성자 초대',
		title: 'HYEONIVERSE 저자로 초대되었습니다',
		body: '이 메일 주소로 GitHub 로그인을 하면 역할이 붙습니다.',
	},
	{
		icon: 'fa-laptop',
		from: '새 기기 확인',
		title: '처음 보는 기기에서 로그인했습니다',
		body: '24시간 안에 링크를 눌러야 그 기기에서 들어올 수 있습니다.',
	},
	{
		icon: 'fa-clock',
		from: '예약 발행',
		title: '예약한 글 1편을 발행했습니다',
		body: 'Next.js가 아니라 DB(pg_net)가 Resend로 직접 보냅니다.',
	},
];

/** 메일함: 사이트가 Resend로 보내는 메일 네 가지가 화면에 들어오면 하나씩 도착하고, 누르면 내용을 펼친다 */
export const Mailbox: React.FC = () => {
	const box = useRef<HTMLDivElement>(null);
	const [arrived, setArrived] = useState(0);
	const [open, setOpen] = useState<number | null>(null);
	useEffect(() => {
		const node = box.current;
		if (!node || typeof IntersectionObserver === 'undefined') {
			setArrived(MAILS.length);
			return;
		}
		let timer = 0;
		const observer = new IntersectionObserver(([entry]) => {
			if (!entry.isIntersecting) return;
			observer.disconnect();
			const next = (n: number) => {
				setArrived(n);
				if (n < MAILS.length) timer = window.setTimeout(() => next(n + 1), 600);
			};
			next(1);
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			window.clearTimeout(timer);
		};
	}, []);

	return (
		<div className="cm-mail" ref={box}>
			<p className="cm-mail-head">
				<i className="fa-solid fa-inbox" /> 받은편지함 <span>{arrived}</span>
			</p>
			<ul>
				{MAILS.map((mail, i) => (
					<li key={mail.from} data-in={i < arrived || undefined} data-open={open === i || undefined}>
						<button type="button" onClick={() => setOpen(open === i ? null : i)} disabled={i >= arrived}>
							<i className={`fa-solid ${mail.icon}`} aria-hidden="true" />
							<span>
								<small>{mail.from}</small>
								<b>{mail.title}</b>
							</span>
						</button>
						<p>{mail.body}</p>
					</li>
				))}
			</ul>
		</div>
	);
};
