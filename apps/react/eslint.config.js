import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['dist', 'playwright-report', 'test-results'] },
	{
		files: ['**/*.{ts,tsx}'],
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			// 아래 규칙은 기존 코드 구조를 바꿔야 고칠 수 있어 경고로 둔다. #15 리팩터링에서 해결한 뒤 에러로 올린다.
			'react-hooks/refs': 'warn',
			'react-hooks/set-state-in-effect': 'warn',
			'react-hooks/immutability': 'warn',
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			// 구조 분해로 특정 필드를 빼낼 때(`const { a, ...rest } = obj`) 쓰는 변수는 허용
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
		},
	}
);
