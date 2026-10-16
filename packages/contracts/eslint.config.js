import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
	files: ['**/*.ts'],
	extends: [js.configs.recommended, ...tseslint.configs.recommended],
	languageOptions: { ecmaVersion: 2022 },
	rules: {
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
		// UI 프레임워크와 무관해야 한다 (#16)
		'no-restricted-imports': ['error', { patterns: ['react', 'react-*', 'react/*', 'vue', 'vue/*', '@/*'] }],
	},
});
