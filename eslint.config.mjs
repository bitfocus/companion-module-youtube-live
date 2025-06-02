// @ts-check

import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs';
import jest from 'eslint-plugin-jest';

const baseConfig = await generateEslintConfig({
	enableJest: true,
	enableTypescript: true,
});

/**
 * @param {import('eslint').Linter.Config<import('eslint').Linter.RulesRecord>['files']} files
 * @param {readonly string[]} allowModules
 * @returns {import('eslint').Linter.Config<import('eslint').Linter.RulesRecord>}
 */
function permitLimitedUnpublishedImports(files, allowModules) {
	return {
		files,
		rules: {
			'n/no-unpublished-import': [
				'error',
				{
					allowModules,
				},
			],
		},
	};
}

const testFilePatterns = ['src/**/*spec.ts', 'src/**/*test.ts'];
const testHelperPatterns = ['src/**/__tests__/**/*.ts', 'src/**/__mocks__/**/*.ts'];

const allTestFilePatterns = [...testFilePatterns, ...testHelperPatterns];

/** @type {import('eslint').Linter.Config<import('eslint').Linter.RulesRecord>[]} */
const customConfig = [
	...baseConfig,

	{
		files: ['**/*.ts'],
		rules: {
			'@typescript-eslint/naming-convention': [
				'error',

				{
					selector: 'import',
					format: ['camelCase', 'PascalCase'],
				},

				{
					selector: 'typeLike',
					format: ['PascalCase'],
				},

				{
					selector: 'variable',
					format: ['camelCase'],
					leadingUnderscore: 'allow',
					trailingUnderscore: 'allow',
				},

				{
					selector: 'variable',
					modifiers: ['const'],
					format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
					leadingUnderscore: 'allow',
					trailingUnderscore: 'allow',
				},

				{
					selector: 'enumMember',
					format: ['PascalCase'],
				},

				{
					selector: 'objectLiteralProperty',
					format: ['camelCase', 'PascalCase'],
					filter: {
						// Also allow likely HTTP headers.
						regex: '^[A-Z][a-z0-9]*(?:-[A-Z][a-z0-9]+)*$',
						match: false,
					},
				},

				{
					selector: 'classProperty',
					format: ['camelCase', 'PascalCase'],
				},
				{
					selector: 'typeProperty',
					format: ['camelCase', 'PascalCase'],
				},
			],
		},
	},

	{
		ignores: ['eslint.config.{js,mjs,mts,ts}', 'jest.config.{js,ts}'],
		rules: {
			'n/no-missing-import': 'off',
			'n/no-unpublished-import': 'error',
		},
	},

	permitLimitedUnpublishedImports(allTestFilePatterns, ['jest']),
	permitLimitedUnpublishedImports(['eslint.config.mjs'], ['@companion-module/tools', 'eslint-plugin-jest']),

	{
		files: allTestFilePatterns,
		plugins: {
			jest,
		},
		rules: {
			// The TypeScript eslint rule that flags references to unbound
			// functions that discard a proper `this`, also flags
			// `expect(obj.nonStaticFunc).toHaveBeenCalled()` and similar test
			// patterns.  Disable the rule in tests in favor of a Jest-specific
			// rule that doesn't flag valid `expect`-related operations.
			'@typescript-eslint/unbound-method': 'off',
			'jest/unbound-method': 'error',
		},
	},
];

export default customConfig;
