/**
 * Created by FJC on 2017/11/6.
 */


import Watcher from './observer/Watcher'
import TaskQueue from './scheduler'
import {observe,defineReactive} from './observer/Observable'
import Dep from './observer/Dep'
import util from '../util'

import Bus from '../EventBus'

import DataQueue from './DataQueue'

class Vue {
	
	$options = {};
	_props = {};
	_data = {};
	$mappingProps={};
	
	$wxpage;
	$route = {};
	$mixins = [];
	
	$refs = {}
	data_queue ;
	
	constructor(options) {
		// console.log('Vue constructor');
		this.$options = util.$copy(options,true) || {};

		this.$wxpage = this.$options.wxpage;
		this.$parent = this.$options.parent;
		this.$prefix = this.$options.prefix;
		this.$name = this.$options.name;
		this.$router = getApp().$app.$router;


		if (!this.$wxpage) {
			console.warn(`${this.$name}: wxpage null, could not bind with template`);
		} else {
            this.data_queue = new DataQueue(this.$wxpage);
		}

		this._bus = new Bus();

        this.init();

        if (!this.$wxpage) {
        	this.onLoad()
		}
	}

	init () {

		this.abc = new Date().getTime();

		this._listeners = {};

        this._childs = {};

        this.initMappingProps();

        this.initMixins();

        this.initMethods();

        this.initEvent();

        this.startData();

        this.initComponent();

        this.initRefs();

        this.$bindMethod();

        this.initBindWatch();

	}

	startData () {

        this._props = {};

        this._data = {};

        this.initProps();

        this.initData();

        this.initComputed();

        this.initWatch();

        // console.log('this._props',this.$name,this._props);
	}
	
    /**
	 * 将方法绑定到wxpage 上，供bindTap等模板事件回调
     */
    $bindMethod () {
    	if (!this.$wxpage) {
    		return
		}
        const methods = this.$options.methods || {};

        for (const name in methods) {

            let methodName = this.$prefix? this.$prefix +'$'+name : name;

            let vm = this;
            this.$wxpage[methodName] = function (e, ...args) {

                let wepyParams = [], paramsLength = 0, tmp, p;
                if (e.currentTarget && e.currentTarget.dataset) {
                    tmp = e.currentTarget.dataset;
                    while (tmp['wepyParams' + (p = String.fromCharCode(65 + paramsLength++))] !== undefined) {
                        wepyParams.push(tmp['wepyParams' + p]);
                    }
                }

                args = args.concat(wepyParams);
                args.push(e);
                let rst;
                let comfn = methods[name];

                if (comfn) {
                    rst = comfn.apply(vm, args);
                }
                return rst;
            }
        }

        Object.keys(this._childs || {}).forEach(name => {
            let child = this._childs[name];
            child.$bindMethod();
        })
	}

	initBindWatch () {
		let bindWatch = [];
		let t =new Date().getTime();
		bindWatch = bindWatch.concat(Object.keys(this._props|| {}))
			.concat(Object.keys(this._data || {}))
			.concat(Object.keys(this._computedWatchers || {}))
		
		t=new Date().getTime();

		bindWatch.forEach(key=>{

			this.$watch(key, () => {
				let map = this.$mappingProps[key];
				Object.keys(map || {}).forEach(compName=>{
					let props = map[compName] || [];

					props.forEach(prop=>{
						this._childs[compName][prop] = this[key];
					})
				});

                let params = {};
				let k = this.$prefix ? this.$prefix+'$'+key : key;
				let v = this[key];
				if (k.indexOf('_weex_style')!==-1) {
					if (typeof v !== 'string') {
						v = util.$formatStyle(v);
					}
				}
				params[k] = v;
				this.setData(params);
			}, {
				immediate: true
			})
		})
		
		t=new Date().getTime();
	}
	

	setData (params) {

		// this.setData(params);
		if (this.data_queue) {
            this.data_queue.push(params);
        }
	}

	initEvent () {
		let self = this;
        let $events = {};
        if (this.$parent) {
            $events = this.$parent.$options.$events || {}
        }

        if ($events[this.$name]) {
            Object.keys($events[this.$name]).forEach(event=>{
                let methodName = $events[this.$name][event];

                let r = event.match(/v-on:(.*)/)
                if (r) {
                    let method = self.$parent[methodName];
                    if (method && typeof method === 'function') {
                        this.$on(r[1].trim(),function (args) {
                            method.apply(self.$parent,args);
                        })
                    }
                }
            })
        }
	}

	initMappingProps () {
		let self = this;
		const $props = this.$options.$props;
		
		Object.keys($props || {}).forEach(compName => {
			Object.keys($props[compName] || binded).forEach(binded=>{
				if (/\.sync$/.test(binded) || /\.once$/.test(binded)) {
					let bindValue = $props[compName][binded];
					
					if (typeof bindValue === 'object') {
						bindValue = bindValue.value;
					}
					if (bindValue) {
						if (!this.$mappingProps[bindValue]) {
							this.$mappingProps[bindValue] = {};
						}
						
						this.$mappingProps[bindValue][compName] = this.$mappingProps[bindValue][compName] || [];
						this.$mappingProps[bindValue][compName].push(binded.substring(7,binded.length-5));
					}
				}
			})
		})
		
	}

	initRefs () {
		this.$refs = {};
		let refs = this.$options.refs || {};


        for (let key in refs) {
            let comName = refs[key];

            let com = this._childs[comName];

            if (!com) {
                throw new Error(`no child component named ${comName}`);
            }

            let comProxy = {}

            if (com.$options.methods) {
                Object.keys(com.$options.methods).forEach(methodName=>{
                    let method = com.$options.methods[methodName];
                    comProxy[methodName] = function (...args) {
                        // console.log(`refs ${key}-->invoke function ${methodName} `);
                        if (typeof method !== 'function') {
                            throw new Error(`${comName} has no method called ${methodName}`);
                        }
                        let rst = method.apply(com,args);
                        return rst;
                    }
                });
            }

            this.$refs[key] = comProxy;
        }
	}
	
	initComponent() {
		// this.$options.components = {}

		this._childs = {}
		Object.keys(this.$options.components || {}).forEach(name=>{
			let comp = this.$options.components[name] || {};
			let prefix = this.$prefix ? this.$prefix+'$'+name : '$'+name;
			
			comp.name = name;
			comp.prefix = prefix;
			comp.parent = this;
			comp.wxpage = this.$wxpage;
			this._childs[name] = new Vue(comp);
		})


	}

	initMixins () {
		// TODO mixin... data,created,...
		let $wxapp = getApp();
		
		let globalMixins = $wxapp.$app.mixins || [];
		
		let mixins = this.$options.mixins || [];
		
		this.$mixins = globalMixins.concat(mixins);
		
		this.$mixins.forEach(mix=>{
			Object.keys(mix['methods'] || {}).forEach(k=>{
				this[k]=mix['methods'][k];
			})
		})
	}
	
	initProps () {

		this._props = this._props || {};
		const propsOptions = this.$options.props || {};
		
		Object.keys(propsOptions).forEach(key=>{
			let props = propsOptions[key];
			let value = this.getPropValue(key,props);
			defineReactive(this._props, key, value);
			this.proxy('_props',key)
		})
		
	}
	
	getPropValue(key,prop){
		let value;
		
		let parent = this.$parent;
		if (parent && parent.$options.$props && parent.$options.$props[this.$name]) {
			let val = parent.$options.$props[this.$name][key];
			let binded = parent.$options.$props[this.$name][`v-bind:${key}.once`]
				|| parent.$options.$props[this.$name][`v-bind:${key}.sync`];


			if (binded) {
                value = parent[binded];
                if (typeof binded === 'object') {
                    value = parent[binded.value];
				}
			} else {
				// 静态传值  title="hello"
				value = val;
				if (typeof val === 'object') {
					value = val.value;
				}
			}

		}

		// console.log('@@@',this.$name,key,value);
		if (value==null) {
			if (prop.required) {
				// throw new Error(`prop ${key} in ${name} must be required!`);
				util.$warn(`prop ${key} in ${this.$name} must be required!`);
			}
			if (prop.default) {
				if (typeof prop.default === 'function') {
					value = prop.default.call(this);
				} else {
					value = prop.default;
				}
			}
		}

		if (prop.type) {
			let valid = false;
			if (Array.isArray(prop.type)) {
				for (let i=0;i<prop.type.length;i++) {
					valid = this.checkProp(prop.type[i], value);
					if (valid) {
						break;
					}
				}
			} else {
				valid = this.checkProp(prop.type, value);
			}
			if (!valid) {
				util.$warn(`${this.$parent?this.$parent.$name:''} ${this.$name} prop ${key} is not valid !!`)
			}
		}
		return value;
	}
	
	checkProp (t, val) {
		switch (t) {
			case String:
				return typeof(val) === 'string';
			case Number:
				return typeof(val) === 'number';
			case Boolean:
				return typeof(val) === 'boolean';
			case Function:
				return typeof(val) === 'function';
			case Object:
				return typeof(val) === 'object';
			case Array:
				return toString.call(val) === '[object Array]';
			default:
				return val instanceof t;
		}
	}
	
	initMethods () {
		const methods = this.$options.methods || {};

		for (const key in methods) {
			this[key] = methods[key];
		}
	}
	
	initData () {
		
		this._data = this._data || {};
		this.dataFn = this.$options.data;
		if (typeof this.dataFn === 'object') {
			this._data = this.dataFn
		} else if (typeof this.dataFn === 'function') {
			this._data = this.dataFn ? this.dataFn.call(this) : {};
		}
		
		let props = this._props;
		Object.keys(this._data).forEach(key => {
			if (!props || !props.hasOwnProperty(key)) {
				this.proxy('_data',key);
			}
		})
		
		observe(this._data)
	}
	
	proxy (source,key) {
		let self = this;

		Object.defineProperty(this,key,{
			configurable: true,
			enumerable: true,
			get: function proxyGetter () {
				return self[source][key]
			},
			set: function proxySetter (val) {
				self[source][key] = val
			}
		})
		
	}

	initComputed () {
		this._computedWatchers = this._computedWatchers || {}
		let computed = this.$options.computed || {};
		for (const key in computed) {
			let getter = computed[key];
			if (typeof getter !== 'function') {
				throw new Error(`the computed named ${key} is not a function`);
			}

			let watcher = new Watcher(this, getter, undefined,{
				lazy: true
			});
			this._computedWatchers[key] = watcher;


			if (!this.hasOwnProperty(key)) {
				this.defineComputed(this,key,getter);
			}
		}
	}

	defineComputed (vm, key, getter) {
		let self = this;
		Object.defineProperty(vm, key, {
			enumerable: true,
			configurable: true,
			get: function () {
				const watcher = self._computedWatchers[key];
				if (watcher) {
					if (watcher.dirty) {
						watcher.evaluate();
					}
					if (Dep.target) {
						watcher.depend();
					}
					return watcher.value;
				}
			},
			set: function (val) {
			
			}
		})
	}
	
	initWatch () {
		let watch = this.$options.watch || {};
		for (const key in watch) {
			const handler = watch[key];
			if (Array.isArray(handler)) {
				handler.forEach(item=>{
					this.$watch(key, item);
				})
			} else {
				this.$watch(key, handler);
			}
		}
	}
	
	$watch (keyOrFn, callback, options) {
		
		const vm = this;
		
		options = options || {}
		
		if (typeof callback === 'object') {
			options = callback;
			callback = callback.callback;
		}
		
		if (typeof callback === 'string') {
			callback = vm[callback];
		}
		
		const watcher = new Watcher(vm, keyOrFn, callback, options);
		
		if (options.immediate) {
			callback.call(vm, watcher.value);
		}
		
		return function unwatchFn() {
			watcher.teardown()
		}
	}
	
	$nextTick (fn) {
		TaskQueue.queue(fn);
	}
	
	$on (event, fn) {
        this._listeners[event] = fn;
		this._bus.addEventListener(event,fn);
	}
	
	$emit (event, ...args){
		this._bus.sendEvent(event,args);
	}

	$once (event, fn) {
		this._bus.addEventOnceListener(event,fn);
	}

	$off (event, fn) {
		delete this._listeners[event];
		this._bus.removeEventListener(event, fn);
	}

	onLoad (options){

		this.$route.params = {};
		if (options) {
			
			let params = options.params;
			if (params) {
				this.$route.params = JSON.parse(params);
			}
		}
		
		this.refreshGlobalParam();
		
		Object.keys(this._childs || {}).forEach(key => {
			this._childs[key].onLoad && this._childs[key].onLoad.call(this._childs[key])
		})



		this.$mixins.forEach((mix) => {
			mix['created'] && mix['created'].apply(this);
		});
		
		this.$options.created && this.$options.created.apply(this);
		
	}
	
	refreshGlobalParam() {
		// let _params = getApp().globalData._params || {};
        let _params = getApp()._params || {};
		Object.keys(_params || {}).forEach(key=>{
			if (key in this.$route.params) {
				delete this.$route.params[key];
			}
			Object.defineProperty(this.$route.params, key, {
				configurable: true,
				get() {
					let val = util.$copy(_params[key],true);
					delete _params[key];
					return val;
				}
			});
		});
		
	}
	
	onReady () {
		
		Object.keys(this._childs || {}).forEach(key => {
			this._childs[key].onReady && this._childs[key].onReady.call(this._childs[key])
		})
		
		this.$mixins.forEach((mix) => {
			mix['mounted'] && mix['mounted'].apply(this);
		});
		
		this.$options.mounted && this.$options.mounted.apply(this);
	}
	
	onShow () {
		
		this.refreshGlobalParam();
		
		Object.keys(this._childs || {}).forEach(key => {
			this._childs[key].onShow && this._childs[key].onShow.call(this._childs[key])
		})
		
		this.$mixins.forEach((mix) => {
			mix['onShow'] && mix['onShow'].apply(this);
		});
		
		this.$options.onShow && this.$options.onShow.apply(this);
		
	}
	
	onHide () {
	}
	
	onUnload () {
		
		Object.keys(this._childs || {}).forEach(key => {
			this._childs[key].onUnload && this._childs[key].onUnload.call(this._childs[key])
		})
		
		this.$mixins.forEach((mix) => {
			mix['beforeDestroy'] && mix['beforeDestroy'].apply(this);
		});
		this.$options.beforeDestroy && this.$options.beforeDestroy.apply(this);

		Object.keys(this._listeners || {}).forEach(event=>{
			this.$off(event,this._listeners[event]);
		})
	}
	
	$apply() {
	
	}
}

export default  Vue