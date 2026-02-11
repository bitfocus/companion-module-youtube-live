// @ts-check

import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs';

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
});

const permittedUnpublishedImports = [
	// The type-testing types are erased during compilation, so it's fine to use
	// it as an unpublished import.
	'type-testing',
];

/**
 * Combine two arrays in arbitrary order, coalescing duplicated entries.
 *
 * @param {readonly string[]} s1
 * @param {readonly string[]} s2
 * @returns {readonly string[]}
 */
function mergeSets(s1, s2) {
	return [...new Set(s1.concat(s2))];
}

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
					allowModules: mergeSets(permittedUnpublishedImports, allowModules),
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
					format: null,
					custom: {
						match: true,
						// PascalCase (most types), '_' followed by PascalCase
						// (types explicitly allowed to go unused), or 'assert_'
						// followed by PascalCase (types that use 'type-testing'
						// to verify the characteristics of other types at
						// compile time).  PascalCase here is roughly consistent
						// with how naming-convention defines it, except the
						// first uppercase letter must be ASCII.
						// https://github.com/typescript-eslint/typescript-eslint/blob/8a95834bb5fd818cc049390e4cb57196717a011f/packages/eslint-plugin/src/rules/naming-convention-utils/format.ts
						regex: '^(?:(?:assert)?_)?[A-Z][^_]*$',
					},
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

			// Turn off the general unused-vars rule, and turn on a more refined
			// TypeScript-specific rule.
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					vars: 'all',
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					// In addition to `_*' variables, allow `assert_*` variables
					// as permitted for types by the naming-convention rule
					// above.  (This rule can't restrict `assert_*` to only
					// types, but the naming-convention rule likely usually
					// prevents this name for non-types anyway.)
					varsIgnorePattern: '^(?:assert)?_',
				},
			],
		},
	},

	{
		ignores: ['eslint.config.mjs', 'vitest.config.ts'],
		rules: {
			'n/no-missing-import': 'off',
			'n/no-unpublished-import': [
				'error',
				{
					allowModules: permittedUnpublishedImports,
				},
			],
		},
	},

	permitLimitedUnpublishedImports(allTestFilePatterns, ['vitest']),
	permitLimitedUnpublishedImports(['eslint.config.mjs'], ['@companion-module/tools']),
	permitLimitedUnpublishedImports(['vitest.config.ts'], ['vitest']),

	{
		files: allTestFilePatterns,
		rules: {
			// The TypeScript eslint rule that flags references to unbound
			// functions that discard a proper `this`, also flags
			// `expect(obj.nonStaticFunc).toHaveBeenCalled()` and similar test
			// patterns.
			//
			// Jest has the jest/unbound-method rule which will exempt the Jest
			// pattern from consideration.  Unfortunately, vitest doesn't yet
			// have such a rule exempting the pattern written for vitest.
			// https://github.com/vitest-dev/eslint-plugin-vitest/issues/591
			// So for now we turn off the TypeScript eslint rule and wait for
			// that vitest-aware version to be created.
			'@typescript-eslint/unbound-method': 'off',
			// 'vitest/unbound-method': 'error',
		},
	},
];

export default customConfig;
