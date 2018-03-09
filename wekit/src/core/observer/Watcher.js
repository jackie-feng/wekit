/**
 * Created by FJC on 2017/10/19.
 */

import {pushTarget,popTarget} from './Dep'

import {queueWatcher} from '../looper'

import util from '../../util'
import {isObject} from '../lang'


import TaskQueue from '../scheduler'


let _id = 0;
// computed, watch, $watch
export default class Watcher {
	
	depIds;
	deps = [];
	newDeps = [];
	newDepIds;
	vm;
	dirty;
	callback;
	getter;
	value;
	
	
	constructor (vm,fnOrkey,callback,options) {
		this.vm=vm;
		if (options) {
			this.deep = !!options.deep
			this.lazy = !!options.lazy
			this.sync = !!options.sync
		} else {
			this.deep = this.lazy = this.sync = false
		}
		
		vm._watchers = vm._watchers || [];
		vm._watchers.push(this);
		this.callback = callback;
		this.id = ++_id;
		this.deps = [];
		this.depIds = new Set();
		this.newDeps = [];
		this.newDepIds = new Set();
		this.dirty = this.lazy;
		if (typeof fnOrkey === 'function') {
			this.getter = fnOrkey;
		} else {
			this.getter = parsePath(fnOrkey);
		}
		
		
		if (this.deep) {
		
		}
		
		/**
		 * watch,$watch 在构建时调用get以建立依赖
		 *
		 * computed lasy, 取值时建立依赖
		 * @type {undefined}
		 */
		
		this.value=this.lazy ? undefined : this.get();
	}
	
	
	// 建立新的依赖
	addDep (dep) {
		const id = dep.id;
		if (!this.newDepIds.has(id)) {
			this.newDeps.push(dep);
			this.newDepIds.add(id);
			if (!this.depIds.has(id)) {
				// 检测旧的依赖中是否已经存在
				dep.addSub(this);
			}
		}
	}
	
	/**
	 * 清除旧的依赖，更新依赖表
	 */
	cleanDep () {
		
		this.deps.forEach(dep=>{
			if (!this.newDepIds.has(dep.id)) {
				dep.removeSub(this);
			}
		})
		
		// 复用Set和Array,避免频繁创建Set、Array的性能开销、
		let tmp = this.depIds;
		this.depIds = this.newDepIds;
		this.newDepIds = tmp;
		this.newDepIds.clear();
		
		tmp = this.deps;
		this.deps = this.newDeps;
		this.newDeps = tmp;
		this.newDeps.length = 0;
	}
	
	
	// computed 获取最新的值
	get () {
		let value;
		pushTarget(this);
		try {
			/**
			 * 第一个传入this指针
			 * 第二个this.vm用于取watch观对象的值
			 */
			value = this.getter.call(this.vm,this.vm);
		} catch (e) {
			throw e;
		} finally {
			// TODO 待调试 deep依赖本应在 initData defineReactive中完成。
			// 如果观察对象为 object、array，需要建立深层依赖
			// if (this.deep) {
			// 	traverse(value);
			// }
			popTarget(this);
			this.cleanDep();
		}
		
		return value;
	}
	
	run () {
		const value = this.get();
		
		// watch观察对象如果是object、array，value会相似，
		if (value !== this.value || isObject(value) || this.deep) {
			const oldValue = this.value;
			this.value = value;
			
			if (this.callback) {
				this.callback.call(this.vm,value,oldValue);
			}
		}
	}
	
	evaluate () {
		this.value = this.get();
		this.dirty = false;
	}
	
	// 关联依赖
	depend () {
		this.deps.forEach(dep => {
			dep.depend();
		})
	}
	
	/**
	 * 被依赖项 notify 触发更新。
	 */
	update () {
		// console.log('watcher update',this);
		if (this.lazy) {
			this.dirty = true;
		} else if (this.sync) {
			this.run();
		} else {

			let self=this;
			TaskQueue.queue(function () {
				queueWatcher(self);
            })
            // TaskQueue.queue(this.run,this);
		}
	}
	
	
	teardown () {
		this.deps.forEach(dep=>{
			dep.removeSub(this);
		})
	}
}


const bailRE = /[^\w.$]/

/**
 * $watch('a.b',function(){})
 * ->
 * getter = (vm) = {return vm.a.b}
 * @param path
 * @returns {Function}
 */
export function parsePath (path) {
	if (bailRE.test(path)) {
		return
	}
	const segments = path.split('.')
	return function (obj) {
		for (let i = 0; i < segments.length; i++) {
			if (!obj) return
			obj = obj[segments[i]]
		}
		return obj
	}
}



const seenObjects = new Set()
function traverse (val) {
	seenObjects.clear()
	_traverse(val, seenObjects)
}

function _traverse (val, seen) {
	let i, keys
	const isA = Array.isArray(val)
	if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
		return
	}
	if (val.__ob__) {
		const depId = val.__ob__.dep.id
		if (seen.has(depId)) {
			return
		}
		seen.add(depId)
	}
	if (isA) {
		i = val.length
		while (i--) _traverse(val[i], seen)
	} else {
		keys = Object.keys(val)
		i = keys.length
		while (i--) _traverse(val[keys[i]], seen)
	}
}

