let logger = console;

export function setLogger(newLogger) {
	logger = newLogger;
}

export default new Proxy({}, {
	get: (_, property) => logger[property],
	set: (_, property, value) => {
		logger[property] = value;
		return true;
	},
});
