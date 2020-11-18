import camelcase from 'camelcase';
import { LIFECYCLE_SCOPES, logger } from 'scoped-lambda-context';
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
		injectableMetadata.scope = injectableMetadata.scope || LIFECYCLE_SCOPES.EXECUTION;
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
