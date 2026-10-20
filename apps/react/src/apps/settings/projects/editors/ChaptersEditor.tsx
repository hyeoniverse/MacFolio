import { type ProjectChapter } from '@macfolio/desktop-core/site';
import { ListTable } from '../ListTable';
import { TextField } from '../fields';
import { ImageField } from '../images';
import { optional } from '../model';
import { patchOf } from './patch';
import { RowThumb } from './RowThumb';
import { PairsEditor } from './ListEditors';
import { PointsEditor } from './PointsEditor';

/**
 * 장: 주요 기능과 구현 방법 말고 더 들려줄 이야기 (모든 모양이 '더 들려줄 이야기' 구역이나 대화로 그린다).
 * 줄에는 장 제목과 머리말, 고르면 아래에서 제목·머리말·숫자·항목·장 그림을 고친다.
 * 장 모양(look)·테마(palette)·데이터 구조(schema)·전후 비교(compare)는 코드로 짜는 연출이라 JSON에서만 고친다
 */
export const ChaptersEditor = ({
	chapters,
	onChange,
}: {
	chapters: ProjectChapter[];
	onChange: (chapters: ProjectChapter[]) => void;
}) => (
	<ListTable<ProjectChapter>
		label="장"
		hint="주요 기능·구현 방법 뒤에 이어지는 이야기입니다. 모양마다 그 페이지에 맞는 꼴로 그립니다."
		items={chapters}
		onChange={onChange}
		blank={() => ({ title: '', points: [] })}
		cells={(chapter) => [
			<span className="projects-point" key="text">
				<strong className={chapter.title.trim() ? '' : 'placeholder'}>{chapter.title.trim() || '제목 없음'}</strong>
				<span>{chapter.lead?.trim() || `항목 ${chapter.points.length}개`}</span>
			</span>,
			<RowThumb key="thumb" src={chapter.image?.src} />,
		]}
		detail={(chapter, index, update) => {
			const name = `장 ${index + 1}`;
			return (
				<>
					<TextField
						label="장 제목"
						ariaLabel={`${name} 제목`}
						value={chapter.title}
						onChange={(title) => update(patchOf(chapter, { title }))}
					/>
					<TextField
						label="머리말"
						multiline
						ariaLabel={`${name} 머리말`}
						value={chapter.lead}
						hint="장 첫머리에 크게 보이는 한두 문장입니다."
						onChange={(lead) => update(patchOf(chapter, { lead: optional(lead) }))}
					/>
					<PairsEditor
						label={`${name} 숫자`}
						title="장 숫자"
						nested
						keys={['value', 'label']}
						names={['값', '이름표']}
						placeholders={['예: 3배', '예: 빨라진 저장']}
						rows={chapter.facts ?? []}
						onChange={(facts) => update(patchOf(chapter, { facts: facts.length ? facts : undefined }))}
					/>
					<PointsEditor
						label={`${name} 항목`}
						title="장 안 항목"
						nested
						points={chapter.points}
						onChange={(points) => update(patchOf(chapter, { points }))}
					/>
					<ImageField
						label="장 그림"
						name={`${name} 그림`}
						shape="wide"
						value={chapter.image?.src}
						hint="장 끝이나 옆에 크게 보입니다."
						onChange={(src) =>
							update(
								patchOf(chapter, {
									image: src ? { ...chapter.image, src, alt: chapter.image?.alt ?? '' } : undefined,
								})
							)
						}
					/>
					{chapter.image && (
						<TextField
							label="그림 설명"
							ariaLabel={`${name} 그림 설명`}
							value={chapter.image.alt}
							hint="비워 두면 장 제목을 씁니다."
							onChange={(alt) => chapter.image && update({ ...chapter, image: { ...chapter.image, alt } })}
						/>
					)}
				</>
			);
		}}
	/>
);
