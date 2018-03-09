/**
 * Created by FJC on 2017/11/1.
 */

import {remove} from '../lang'

let _id = 0;

let targetStack = [];

export default class Dep {
	

	
	id;
	subs;
	
	constructor () {
		this.id = _id++;
		this.subs = [];
	}
	
	addSub (sub) {
		this.subs.push(sub);
	}
	
	removeSub (sub) {
		remove(this.subs, sub);
	}
	
	depend () {
		if (Dep.target) {
			// this.addSub(Dep.target);
			Dep.target.addDep(this);
		}
	}
	
	notify () {
		const subs = this.subs.slice();
		for (let i= 0;i<subs.length;i++) {
			// console.log('dep id',this.id);
			subs[i].update();
		}
	}
}

export function pushTarget (target) {
	if (Dep.target) {
		targetStack.push(Dep.target);
	}
	Dep.target = target;
}

export function popTarget (target) {
	Dep.target = targetStack.pop();
}

Dep.target = null;