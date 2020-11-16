import camelcase from 'camelcase';
import lifecycleScopes from '../lifecycleScopes';
import logger from '../logger';
import injectableMetadataStore from './injectableMetadataStore';

export default function Injectable(injectableMetadata) {
	return (target) => {
		makeInjectable(target, injectableMetadata);
	};
}

export function makeInjectable(target, injectableMetadata = {}) {
	target.register = () => {
		const injectableName = injectableMetadata.name || camelcase(target.name);
		logger.debug('Registering injectable', injectableName);
		injectableMetadata.scope = injectableMetadata.scope || lifecycleScopes.EXECUTION;
		injectableMetadata.builder = injectableMetadata.builder || async function builder(dependencies) {
			const Target = target;
			const instance = new Target(...dependencies);
			if (instance.init) {
				await instance.init();
			}
			return instance;
		};
		injectableMetadataStore[injectableName] = injectableMetadata;
		target.injectableMetadata = injectableMetadata;
	};
}

export const TRANSIENT_SCOPE = 'TRANSIENT';
