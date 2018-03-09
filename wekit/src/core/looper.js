/**
 * Created by FJC on 2017/11/7.
 */

import TaskQueue from './scheduler'

let waiting = false;

let flushing = false;
let queue = [];
let queue2 = [];
let ids = new Set();

let flushSchedulerQueue = function () {
	

	// console.log('flushSchedulerQueue,queue=',queue)
	
	flushing = true;

	queue.sort((a,b)=>a.id-b.id);

	let watcher;
	let id;
	
	queue.forEach(watcher=>{
		ids.delete(watcher.id);
		watcher.run();
	})

	reset();
}

function reset() {

	ids.clear();
	let tmp = queue;
	queue = queue2;
	queue2 = tmp;
	queue2.length=0;
	waiting = false;
	flushing = false;

}


export function queueWatcher(watcher) {
	const id = watcher.id;
	if (!ids.has(id)) {
		ids.add(id);
		if (!flushing) {
			queue.push(watcher);
		} else {
			// console.log('is not flushing')
			queue2.push(watcher);
		}

		if (!waiting) {
			waiting = true;
            TaskQueue.queue(flushSchedulerQueue)
		}
	}
}