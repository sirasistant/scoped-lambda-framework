import camelcase from 'camelcase';
import { Context, logger } from 'scoped-lambda-context';

export default class Service {
	async init() {
		// For easier development, when a service is started, it reproduces the onContextStart of the context already present
		const parentContexts = [...Context.getContextHierarchy()].reverse();
		for (let i = 0; i < parentContexts.length; i++) {
			const context = parentContexts[i];
			const parentContext = parentContexts[i - 1] || null;
			const contextName = Context.getContextName(context);
			await this.onContextStart(contextName, context, parentContext);
		}
	}

	async onContextStart(contextName, context, parentContext) {
		logger.debug(this.constructor.name, 'OnContextStart', contextName, 'parent', parentContext ? Context.getContextName(parentContext) : null);
		const methodName = camelcase(`ON_${contextName}_CONTEXT_START`);
		if (this[methodName]) {
			await this[methodName](context, parentContext);
		}
	}

	async onContextEnd(contextName, context, parentContext) {
		logger.debug(this.constructor.name, 'OnContextEnd', contextName);
		const methodName = camelcase(`ON_${contextName}_CONTEXT_END`);
		if (this[methodName]) {
			await this[methodName](context, parentContext);
		}
	}
}
