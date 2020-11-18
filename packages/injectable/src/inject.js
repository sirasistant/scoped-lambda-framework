import getInjectable from './getInjectable';

export default function Inject(...injectables) {
	return (_, __, descriptor) => {
		const original = descriptor.value;
		descriptor.value = async function decoratedWithInjections(...args) {
			for (const dep of injectables) {
				const resolvedDependency = await getInjectable(dep);
				this[dep] = resolvedDependency;
			}
			return original.call(this, ...args);
		};
	};
}
