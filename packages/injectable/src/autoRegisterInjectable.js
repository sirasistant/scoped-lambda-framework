export default function AutoRegisterInjectable(target) {
	if (target.register) {
		target.register();
	}
}
