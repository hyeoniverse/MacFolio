import React, { useState } from 'react';
import { KITCHEN_EMOJIS, KITCHEN_PAIRS } from './kitchenData';

/** 조합 그림 주소 (그 사이트 lib/emojiKitchen과 같다): gstatic은 코드포인트 덩어리마다 u를 붙인다 */
const kitchenUrl = ([date, left, right]: [string, string, string]) => {
	const u = (code: string) => `u${code.split('-').join('-u')}`;
	return `https://www.gstatic.com/android/keyboard/emojikitchen/${date}/${u(left)}/${u(left)}_${u(right)}.png`;
};

/**
 * 이모지 키친: 이모지 두 개를 고르면 Google Gboard가 섞어 그린 그림이 나온다. 그 사이트는 조합 14만 7천 개를 가벼운
 * 목록(meta.json + pairs.bin)으로 줄여 두고, 고른 조합을 커스텀 이모지로 가져와 글과 댓글에 쓴다
 */
export const Kitchen: React.FC = () => {
	const [left, setLeft] = useState(KITCHEN_EMOJIS[0]);
	const [right, setRight] = useState(KITCHEN_EMOJIS[3]);
	const [broken, setBroken] = useState<string | null>(null);
	const pair = KITCHEN_PAIRS[`${left}+${right}`] ?? KITCHEN_PAIRS[`${right}+${left}`];
	const src = pair ? kitchenUrl(pair) : null;
	const row = (value: string, set: (emoji: string) => void, label: string) => (
		<div className="cm-kitchen-row" role="group" aria-label={label}>
			{KITCHEN_EMOJIS.map((emoji) => (
				<button key={emoji} type="button" aria-pressed={value === emoji} onClick={() => set(emoji)}>
					{emoji}
				</button>
			))}
		</div>
	);

	return (
		<div className="cm-kitchen">
			{row(left, setLeft, '첫 이모지')}
			<div className="cm-kitchen-mix">
				<span>{left}</span>
				<i className="fa-solid fa-plus" aria-hidden="true" />
				<span>{right}</span>
				<i className="fa-solid fa-equals" aria-hidden="true" />
				<figure>
					{src && broken !== src ? (
						<img key={src} src={src} alt={`${left}와 ${right}를 섞은 이모지`} onError={() => setBroken(src)} />
					) : (
						<em>{src ? '그림을 불러오지 못했습니다' : '이 둘은 조합이 없습니다'}</em>
					)}
				</figure>
			</div>
			{row(right, setRight, '둘째 이모지')}
		</div>
	);
};
