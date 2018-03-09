/**
 * Created by FJC on 2017/11/7.
 */



//
// export const nextTick = (()=>{
// 	const callbacks = [];
// 	let pending = false;
// 	let timerFunc;
//
//
// 	function nextTickhandler() {
// 		pending = false;
// 		const copies = callbacks.slice(0)
// 		callbacks.length = 0
// 		for (let i = 0; i < copies.length; i++) {
// 			copies[i]()
// 		}
// 	}
//
// 	timerFunc = () => {
// 		setTimeout(nextTickhandler, 0);
// 	}
//
// 	return function queueNextTick(callback, ctx) {
//
// 		callbacks.push(()=>{
// 			if (callback) {
// 				callback.call(ctx);
// 			}
// 		});
//
// 		if (!pending) {
// 			pending = true;
// 			if (timerFunc) {
// 				timerFunc()
// 			}
// 		}
//
// 	}
// })()

let TaskQueue = {
    task_queue : [],
    running :false,

    flush() {

        let self = this;
        setTimeout(function () {
            self.running = false;
            const copies = self.task_queue.slice(0);
            self.task_queue.length = 0;

            for (let i = 0;i<copies.length;i++){
                let callback = copies[i];
                if (callback) {
                    callback();
                } else {
                    continue;
                }
            }

        },0);
    },
    queue(callback,ctx) {
        if (ctx) {
            this.task_queue.push(function () {
                callback.call(ctx);
            })
        } else {
            this.task_queue.push(callback);
        }

        if (!this.running) {
            this.running  = true;
            this.flush();
        }
    }
}

export default TaskQueue;
