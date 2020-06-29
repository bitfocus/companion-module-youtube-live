// eslint-disable-next-line no-undef
module.exports = {
	roots: ['<rootDir>/src'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	testRegex: '/src/__tests__/.*\\.ts$',
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
