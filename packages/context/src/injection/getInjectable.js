import { v1 as uuidv1 } from 'uuid';
import injectableMetadataStore from './injectableMetadataStore';
import Context from '../context';
import logger from '../logger';
import { TRANSIENT_SCOPE } from './injectable';

const INJECTABLE_PREFIX = 'Injectable_';

async function getInjectable(injectableName, parentScope = null) {
	const injectableKey = `${INJECTABLE_PREFIX}${injectableName}`;
	logger.debug('Resolving injectable:', injectableName, 'parent scope', parentScope);
	const injectableMetadata = injectableMetadataStore[injectableName];
	if (!injectableMetadata) {
		throw new Error(`Unknown injectable ${injectableName}`);
	}
	const scopeChain = [...Context.getContextHierarchy()];
	const contextToAssociate = scopeChain.find((context) => Context.getContextName(context) === injectableMetadata.scope);
	const parentContext = scopeChain.find((context) => Context.getContextName(context) === parentScope);

	if (!contextToAssociate && injectableMetadata.scope !== TRANSIENT_SCOPE) {
		throw new Error(`Cannot locate scope ${injectableMetadata.scope} of ${injectableName}`);
	}

	if (scopeChain.indexOf(parentContext) > scopeChain.indexOf(contextToAssociate)) {
		throw new Error(`Cannot locate injectable with scope ${injectableMetadata.scope} within a scope ${parentScope}`);
	}

	const cached = Context.getContextVariable(injectableKey);
	if (cached) {
		logger.debug('Returning cached injectable:', injectableName);
		return await cached;
	}

	const buildPromise = buildInjectable(injectableName, injectableMetadata, injectableKey);
	if (injectableMetadata.scope !== TRANSIENT_SCOPE) {
		contextToAssociate[injectableKey] = buildPromise;
	}

	return buildPromise.then((injectable) => {
		if (injectableMetadata.scope !== TRANSIENT_SCOPE) {
			logger.debug(`Attaching injectable ${injectableName} to context ${Context.getContextName(contextToAssociate)}`);
			contextToAssociate[injectableKey] = injectable;
		}
		return injectable;
	});
}

async function buildInjectable(injectableName, injectableMetadata) {
	logger.debug('Building injectable:', injectableName);
	const injectableDependencies = [];
	for (const dependencyName of (injectableMetadata.dependencies || [])) {
		injectableDependencies.push(await getInjectable(dependencyName, injectableMetadata.scope));
		logger.debug('Located dependency', dependencyName, 'for injectable', injectableName);
	}

	const built = await injectableMetadata.builder(injectableDependencies);
	built.injectableUUID = uuidv1();
	logger.debug('Built injectable:', injectableName, built.injectableUUID);
	return built;
}

export default getInjectable;
