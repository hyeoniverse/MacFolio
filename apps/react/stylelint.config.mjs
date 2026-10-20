// 이름(토큰)이 있는 값을 숫자로 다시 쓰지 않게 막는다 (styles/tokens/의 --text-*·--radius-*·--z-*·--space-*).
// 1층 원시값(--palette-*)은 2·3층 토큰만 가리키고, 앱·부품 CSS는 직접 쓰지 않는다.
// 이름이 없는 값(18px 간격처럼 일부러 남긴 값, 앱 고유의 값)은 막지 않는다.
const px = (values) => new RegExp(`^(${values.join('|')})px$`);

export default {
	ignoreFiles: [
		'src/styles/theme.css',
		'src/styles/tokens/**', // 토큰을 정의하는 곳
		'src/apps/safari/project/**', // 프로젝트 소개 페이지: 브랜드 디자인 그대로
		'dist/**',
		'node_modules/**',
	],
	rules: {
		'declaration-property-value-disallowed-list': [
			{
				'font-size': [px([11, 12, 13, 15, 16, 17, 20, 22])],
				'border-radius': [px([4, 6, 8, 10, 14, 22, 999])], // 18px(--radius-18)은 떠 있는 판(--radius-panel)에만 쓰는 값이라 막지 않는다
				'z-index': [/^(1000|1001|1400|1500|2000|2100|2200|2400|2500|3000|9000|9999|10000|15000|20000)$/],
				'/^(gap|row-gap|column-gap|padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/': [
					px([2, 4, 6, 8, 10, 12, 14, 16, 20, 24]),
				],
				'/.*/': [/var\(--palette-/],
			},
			{
				message: (property, value) =>
					value.includes('--palette-')
						? `${property}: ${value} — 원시값(--palette-*) 대신 의미 토큰(--color-* 등, styles/tokens/semantic.css)을 쓰세요`
						: `${property}: ${value}는 이름이 있는 값입니다. styles/tokens/의 토큰(var(--…))을 쓰세요`,
			},
		],
	},
};
