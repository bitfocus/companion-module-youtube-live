// @ts-check

import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs';

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
		ignores: ['eslint.config.{js,mjs,mts,ts}', 'jest.config.{js,ts}'],
		rules: {
			'n/no-missing-import': 'off',
			'n/no-unpublished-import': 'error',
		},
	},

	permitLimitedUnpublishedImports(allTestFilePatterns, ['jest']),
	permitLimitedUnpublishedImports(['eslint.config.mjs'], ['@companion-module/tools']),
];

export default customConfig;
