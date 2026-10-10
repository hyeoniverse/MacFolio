import React, { useState } from 'react';

type Role = 'owner' | 'admin' | 'author' | 'visitor';
const ROLES: { key: Role; label: string }[] = [
	{ key: 'owner', label: '소유자' },
	{ key: 'admin', label: '관리자' },
	{ key: 'author', label: '저자' },
	{ key: 'visitor', label: '방문자' },
];
/** 동작마다 할 수 있는 역할 (그 사이트의 RLS 정책과 같다) */
const ACTIONS: { label: string; roles: Role[] }[] = [
	{ label: '공개 글 읽기 · 댓글 · 좋아요', roles: ['owner', 'admin', 'author', 'visitor'] },
	{ label: '자기 글 작성 · 수정 · 삭제', roles: ['owner', 'admin', 'author'] },
	{ label: '모든 글 · 작업물 편집', roles: ['owner', 'admin'] },
	{ label: '댓글 · 신고 중재 · 대시보드', roles: ['owner', 'admin'] },
	{ label: '사이트 설정', roles: ['owner'] },
	{ label: '저자 초대 · 권한 관리', roles: ['owner'] },
];

/**
 * 누가 무엇을 할 수 있나: 역할을 고르면 그 역할 칸이 강조되고, 동작을 누르면 DB의 RLS 정책이 JWT의 app_metadata에서
 * 역할을 읽어 허용하거나 막는다. API 코드가 확인을 빠뜨려도 DB가 마지막에 막는다
 */
export const Roles: React.FC = () => {
	const [role, setRole] = useState<Role>('author');
	const [picked, setPicked] = useState<number | null>(null);
	const action = picked === null ? null : ACTIONS[picked];
	const allowed = action ? action.roles.includes(role) : false;
	const name = ROLES.find((item) => item.key === role)?.label;

	return (
		<div className="cm-roles">
			<div className="cd-seg" role="group" aria-label="누구로 해 볼까">
				{ROLES.map((item) => (
					<button
						key={item.key}
						type="button"
						aria-pressed={role === item.key}
						onClick={() => {
							setRole(item.key);
							setPicked(null);
						}}
					>
						{item.label}
					</button>
				))}
			</div>
			<table className="cm-roles-table">
				<thead>
					<tr>
						<th scope="col">동작</th>
						{ROLES.map((item) => (
							<th key={item.key} scope="col" data-on={role === item.key || undefined}>
								{item.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{ACTIONS.map((row, i) => (
						<tr key={row.label} data-picked={picked === i || undefined} data-ok={row.roles.includes(role) || undefined}>
							<th scope="row">
								<button type="button" onClick={() => setPicked(i)}>
									{row.label}
								</button>
							</th>
							{ROLES.map((item) => (
								<td key={item.key} data-on={role === item.key || undefined}>
									{row.roles.includes(item.key) ? (
										<i className="cm-dot" aria-label="할 수 있음" />
									) : (
										<span aria-label="할 수 없음">—</span>
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			<p className="cm-result" data-kind={action ? (allowed ? 'ok' : 'conflict') : undefined} role="status">
				{action
					? allowed
						? `${name}: ${action.label} → 허용 · RLS가 auth.jwt()의 app_metadata.role을 보고 통과시킵니다`
						: `${name}: ${action.label} → 거부 · API가 확인을 빠뜨려도 DB의 RLS 정책이 막습니다`
					: '역할을 고르고, 해 볼 동작을 눌러 보세요. 역할은 사용자가 바꿀 수 없는 app_metadata에 있습니다'}
			</p>
		</div>
	);
};
