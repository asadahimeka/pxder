module.exports = {
	env: {
		es2021: true,
		node: true,
	},
	extends: ['standard'],
	parserOptions: {
		ecmaVersion: 12,
		sourceType: 'module',
	},
	rules: {
		curly: 'off',
		camelcase: 'off',
		'no-case-declarations': 'off',
		semi: ['warn', 'never'],
		'comma-dangle': ['error', 'only-multiline'],
		'space-before-function-paren': 'off',
		'no-tabs': 'off',
		indent: 'off',
		eqeqeq: 'off',
		'no-async-promise-executor': 'off',
		'no-control-regex': 'off',
		'prefer-promise-reject-errors': 'off',
	},
}
