const coverage = {
	unit: {
		global: {
			statements: 100,
			branches: 100,
			functions: 100,
			lines: 100,
		},
	},
};

module.exports = {
	testEnvironment: 'node',
	collectCoverageFrom: [
		'src/**/*.{js,mjs}',
	],
	testMatch: [],
	coverageThreshold: coverage[process.env.TEST_TYPE],
	coveragePathIgnorePatterns: [
		'/node_modules/',
		'/tests/',
	],
	transform: {
		'\\.js$': [
			'babel-jest',
			{
				rootMode: 'upward',
			},
		],
	},
};
