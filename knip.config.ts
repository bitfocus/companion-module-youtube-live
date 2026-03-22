import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	entry: [],
	project: ['src/**/*.ts', '*.ts', '*.mjs'],
	tags: ['-allowunused'],
};

export default config;
