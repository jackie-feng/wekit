/**
 * Created by FJC on 2017/11/7.
 */
/**
 * Define a property.
 */
export function def (obj, key, val, enumerable) {
	Object.defineProperty(obj, key, {
		value: val,
		enumerable: !!enumerable,
		writable: true,
		configurable: true
	})
}

export function isObject(obj) {
	return obj !== null && typeof obj === 'object';
}

export function remove (arr, item) {
	if (arr.length) {
		var index = arr.indexOf(item);
		if (index > -1) {
			return arr.splice(index, 1)
		}
	}
}

export function bind (fn, ctx) {
	function boundFn (a) {
		const l = arguments.length
		return l ?
			l > 1 ? fn.apply(ctx, arguments) : fn.call(ctx, a)
			: fn.call(ctx)
	}
	// record original fn length
	boundFn._length = fn.length
	return boundFn
}