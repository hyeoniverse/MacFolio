import { type Project } from '@macfolio/desktop-core/site';
import { ListTable } from '../ListTable';
import { SwitchRow, TextField } from '../fields';
import { ImageField } from '../images';
import { optional } from '../model';
import { patchOf } from './patch';
import { RowThumb } from './RowThumb';

type Member = NonNullable<Project['team']>[number];

/** 팀원: 줄에는 이름과 역할, 고르면 아래에서 이름·역할·GitHub 주소·사진·나를 고친다 */
export const TeamEditor = ({ members, onChange }: { members: Member[]; onChange: (members: Member[]) => void }) => (
	<ListTable<Member>
		label="팀원"
		hint="함께 만든 사람을 적습니다. 사진이 없으면 이름 첫 글자로 그리고, 나로 표시한 사람은 강조해서 보입니다."
		items={members}
		onChange={onChange}
		blank={() => ({ name: '', role: '' })}
		cells={(member) => [
			<span className="projects-point" key="text">
				<strong className={member.name.trim() ? '' : 'placeholder'}>
					{member.name.trim() || '이름 없음'}
					{member.me ? ' (나)' : ''}
				</strong>
				<span>{member.role.trim() || '역할이 적혀 있지 않습니다.'}</span>
			</span>,
			<RowThumb key="thumb" src={member.avatar} />,
		]}
		detail={(member, index, update) => {
			const name = `팀원 ${index + 1}`;
			return (
				<>
					<TextField
						label="이름"
						ariaLabel={`${name} 이름`}
						value={member.name}
						onChange={(value) => update({ ...member, name: value })}
					/>
					<TextField
						label="역할"
						ariaLabel={`${name} 역할`}
						value={member.role}
						placeholder="예: 백엔드, 인증과 결제"
						onChange={(role) => update({ ...member, role })}
					/>
					<TextField
						label="GitHub 주소"
						type="url"
						ariaLabel={`${name} GitHub 주소`}
						value={member.url}
						placeholder="https://github.com/…"
						onChange={(url) => update(patchOf(member, { url: optional(url) }))}
					/>
					<ImageField
						label="사진"
						name={`${name} 사진`}
						value={member.avatar}
						hint="비워 두면 이름 첫 글자로 그립니다."
						onChange={(avatar) => update(patchOf(member, { avatar }))}
					/>
					<SwitchRow
						label="나"
						checked={Boolean(member.me)}
						hint="이 프로젝트에서 내가 맡은 자리입니다. 강조해서 보입니다."
						onChange={(me) => update(patchOf(member, { me: me || undefined }))}
					/>
				</>
			);
		}}
	/>
);
