/**
 * Created by FJC on 2017/10/24.
 */
export default class EventBus {
	
	_event = {}
	
	_sticky_event = {}
	
	constructor(){
	
	}
	
	/**
	 * once
	 * 响应一次后销毁
	 * @param type
	 * @param callback
	 */
	addEventOnceListener = function (type, callback) {
		this._event[type] = this._event[type] || new Set();
		this._event[type].add({
			callback:callback,
			type:2
		});
		
		if (this._sticky_event[type]) {
			this._sticky_event[type].forEach(data=>{
				callback(data);
			});
		}
		
	}
	
	addEventListener = function (type, callback) {
		// console.log('#### addEventListener',type);
		this._event[type] = this._event[type] || new Set();
		
		this._event[type].add({
			callback:callback,
			type:1
		});
		
		if (this._sticky_event[type]) {
			// console.log('#### sticky',this._sticky_event[type]);
			this._sticky_event[type].forEach(data=>{
				callback(data);
			});
		}
	}
	/**
	 *
	 * @param type
	 * @param data
	 * @param sticky 是否粘性事件
	 */
	sendEvent = function (type, data ,sticky = false) {
		// console.log('#### sendEvent',type,data,sticky);
		let arr = this._event[type];
		
		if (arr) {
			arr.forEach(item=>{
				if (item.type === 1) {
					item.callback(data);
				} else if (item.type === 2) {
					item.callback(data);
					arr.delete(item)
				}
			});
		}
		
		if (sticky) {
			// console.log('#### sticky');
			this._sticky_event[type] = this._sticky_event[type] || [];
			this._sticky_event[type].push(data);
		}
		
	}
	
	removeEventListener = function (type, callback) {
		// console.log('#### removeEventListener',type);
		let arr = this._event[type] || new Set();
		if (callback) {
			arr.forEach(item=>{
				if (item.callback === callback) {
					// console.log('#### delete cb')
					arr.delete(item);
					if (this._sticky_event[type]) {
						delete this._sticky_event[type];
					}
				}
			});
		} else {
			arr.clear();
			this._sticky_event = {}
		}
	}
}