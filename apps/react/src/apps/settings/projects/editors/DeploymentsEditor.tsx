import { type Project } from '@macfolio/desktop-core/site';
import { ListTable } from '../ListTable';
import { TextField } from '../fields';
import { ImageField } from '../images';
import { optional } from '../model';
import { patchOf } from './patch';
import { RowThumb } from './RowThumb';

type Deployment = NonNullable<Project['deployments']>[number];

/** 배포 결과물: 줄에는 이름과 올린 곳, 고르면 아래에서 이름·주소·올린 곳·설명·그림을 고친다 */
export const DeploymentsEditor = ({
	items,
	onChange,
}: {
	items: Deployment[];
	onChange: (items: Deployment[]) => void;
}) => (
	<ListTable<Deployment>
		label="배포 결과물"
		hint="실제로 열어 볼 수 있는 곳을 적습니다. 웹 서비스, 스토어, 패키지, API 문서처럼 올린 곳마다 한 줄씩 적습니다."
		items={items}
		onChange={onChange}
		blank={() => ({ label: '' })}
		cells={(item) => [
			<span className="projects-point" key="text">
				<strong className={item.label.trim() ? '' : 'placeholder'}>{item.label.trim() || '이름 없음'}</strong>
				<span>{[item.platform, item.url].filter((part) => part?.trim()).join(' · ') || '주소가 없습니다.'}</span>
			</span>,
			<RowThumb key="thumb" src={item.image} />,
		]}
		detail={(item, index, update) => {
			const name = `배포 결과물 ${index + 1}`;
			return (
				<>
					<TextField
						label="이름"
						ariaLabel={`${name} 이름`}
						value={item.label}
						placeholder="예: 웹 서비스"
						onChange={(label) => update({ ...item, label })}
					/>
					<TextField
						label="주소"
						type="url"
						ariaLabel={`${name} 주소`}
						value={item.url}
						placeholder="https://"
						onChange={(url) => update(patchOf(item, { url: optional(url) }))}
					/>
					<TextField
						label="플랫폼"
						ariaLabel={`${name} 플랫폼`}
						value={item.platform}
						placeholder="예: Vercel, App Store, npm"
						hint="올린 곳에 맞는 아이콘을 고르는 데에도 씁니다."
						onChange={(platform) => update(patchOf(item, { platform: optional(platform) }))}
					/>
					<TextField
						label="설명"
						ariaLabel={`${name} 설명`}
						value={item.note}
						onChange={(note) => update(patchOf(item, { note: optional(note) }))}
					/>
					<ImageField
						label="그림"
						name={`${name} 그림`}
						shape="wide"
						value={item.image}
						hint="카드 위에 보이는 화면입니다."
						onChange={(image) => update(patchOf(item, { image }))}
					/>
				</>
			);
		}}
	/>
);
