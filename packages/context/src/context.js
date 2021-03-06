import cls from 'cls-hooked';
import logger from './logger';

const contextNamespace = cls.createNamespace('scoped-lambda-framework-context');

export default class Context {
	static CONTEXT_NAME_KEY = 'contextName';

	constructor() {
		throw new Error('Context is not instantiable');
	}

	static async #runSubContext (subContext, subContextName, contextFunction, parentContext, initializationFunction = () => {}) {
		// Run the provided initialization function for preparing the context
		await initializationFunction(subContext);
		// A for-in is needed, we want items from the protype chain
		for (const variableKey in subContext) { // eslint-disable-line guard-for-in
			const variable = subContext[variableKey];
			if (variable && variable.onContextStart) {
				await variable.onContextStart(subContextName, subContext, parentContext);
			}
		}
		try {
			// Without awaiting before returning, the finally block runs immediately
			return await contextFunction();
		} finally {
			for (const variableKey in subContext) { // eslint-disable-line guard-for-in
				const variable = subContext[variableKey];
				if (variable && variable.onContextEnd) {
					await variable.onContextEnd(subContextName, subContext, parentContext);
				}
			}
			logger.debug('Ended context', subContextName);
		}
	}

	static #setContextProperties (context, name) {
		context[this.CONTEXT_NAME_KEY] = name;
	}

	static async startSubContext(subcontextScope, contextBody, contextInitialization) {
		logger.debug('Starting context', subcontextScope);
		const parentContext = this.getCurrentContext();

		return new Promise((resolve, reject) => {
			contextNamespace.run((subContext) => {
				this.#setContextProperties(subContext, subcontextScope);
				this.#runSubContext(subContext, subcontextScope, contextBody, parentContext, contextInitialization).then(resolve).catch(reject);
			});
		});
	}

	static createParentContext(parentContextScope) {
		logger.debug('Starting parent context', parentContextScope);

		const parentContext = contextNamespace.createContext();
		this.#setContextProperties(parentContext, parentContextScope);
		parentContext.isParent = true;
		return parentContext;
	}

	static bindToParentContext(fn, parentContext) {
		if (!parentContext.isParent) {
			throw new Error('Cannot bind to non-parent context');
		}
		return (...args) => this.runWithinContext(() => fn(...args), parentContext);
	}

	static runWithinContext(fn, context) {
		contextNamespace.enter(context);
		try {
			return fn();
		} catch (exception) {
			if (exception) {
				exception[cls.ERROR_SYMBOL] = context;
			}
			throw exception;
		} finally {
			contextNamespace.exit(context);
		}
	}

	static* getContextHierarchy() {
		let { active: activeContext } = contextNamespace;
		while (activeContext && activeContext[this.CONTEXT_NAME_KEY]) {
			yield activeContext;
			activeContext = Object.getPrototypeOf(activeContext);
		}
	}

	static getCurrentContext() {
		return contextNamespace.active;
	}

	static getContextName(context) {
		return context[this.CONTEXT_NAME_KEY];
	}

	static setContextVariable(key, value) {
		contextNamespace.set(key, value);
	}

	static getContextVariable(key) {
		return contextNamespace.get(key);
	}
}
