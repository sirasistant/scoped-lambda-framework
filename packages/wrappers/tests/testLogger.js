import winston from 'winston';
import util from 'util';

export default function createTestLogger() {
	const { levels } = winston.config.npm;
	const winstonLogger = winston.createLogger({
		level: 'silly',
		levels,
		transports: [
			new winston.transports.Console({ format: winston.format.simple() }),
		],
	});

	for (const level of Object.keys(levels)) {
		const oldLevelFun = winstonLogger[level].bind(winstonLogger);
		winstonLogger[level] = (...args) => {
			oldLevelFun(util.format(...args));
		};
	}

	return winstonLogger;
}
