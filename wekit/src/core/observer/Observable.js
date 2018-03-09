
import Dep from './Dep'

import {def,isObject} from '../lang'


var hasProto = '__proto__' in {};


import {arrayMethods} from './array'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)


export default class Observable {
	
	value;
	
	dep
	
	
	constructor(value, setterHook){
		this.setterHook = setterHook;
		this.value = value;
		this.dep = new Dep();
		def(value, '__ob__', this);
		if (Array.isArray(value)) {
            const augment = hasProto
                ? protoAugment
                : copyAugment
            augment(value, arrayMethods, arrayKeys)
			this.observeArray(value);
		} else {
			this.walk(value);
		}
	}
	
	
	walk (obj) {
		const keys = Object.keys(obj);
		Object.keys(obj).forEach(key => {
			defineReactive(obj, key, obj[key], this.setterHook);
		})
	}
	
	observeArray (arr) {
		arr.forEach(item=>{
			observe(item, this.setterHook)
		})
	}
}


/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src, keys) {
    /* eslint-disable no-proto */
    target.__proto__ = src
    /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target, src, keyss) {
    for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        def(target, key, src[key])
    }
}


export function observe(obj, setterHook) {
	if (!isObject(obj)) {
		return
	}
	
	let ob;
	
	if (obj.hasOwnProperty('__ob__') && obj.__ob__ instanceof Observable) {
		ob = obj.__ob__;
	} else {
		ob = new Observable(obj, setterHook);
		ob._vue_ = this;
	}
	
	return ob;
}


export function defineReactive(obj, key, val, setterHook) {
	
	const dep = new Dep();
	
	const property = Object.getOwnPropertyDescriptor(obj, key);
	if (property && property.configurable === false) {
		return
	}
	
	const getter = property && property.get
	const setter = property && property.set
	
	
	let childOb = observe(val);
	
	Object.defineProperty(obj, key, {
		enumerable: true,
		configurable: true,
		get: function () {
			
			
			const value = getter ? getter.call(obj) : val;
			
			if (Dep.target) {
				dep.depend();
				if (childOb) {
					childOb.dep.depend();
				}
			}
			
			return value;
		},
		set: function (newVal) {
			// console.log('setter ',dep.id,newVal);
			const value = getter ? getter.call(obj) : val
			if (value === newVal) {
				return
			}
			
			if (setter) {
				setter.call(obj,newVal);
			} else {
				val = newVal;
			}
			childOb = observe(newVal);
			dep.notify();
		}
	})
	
}
