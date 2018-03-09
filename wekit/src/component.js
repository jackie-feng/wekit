import event from './event';
import util from './util';


const Props = {
    check (t, val) {
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
    },
    build (props) {
        let rst = {};
        if (typeof(props) === 'string') {
            rst[props] = {};
        } else if (toString.call(props) === '[object Array]') {
            props.forEach((p) => {
                rst[p] = {};
            });
        } else {
            Object.keys(props).forEach(p => {
                if (typeof(props[p]) === 'function') {
                    rst[p] = {
                        type: [props[p]]
                    }
                } else if (toString.call(props[p]) === '[object Array]') {
                    rst[p] = {
                        type: props[p]
                    }
                } else
                    rst[p] = props[p];

                if (rst[p].type && toString.call(rst[p].type) !== '[object Array]')
                    rst[p].type = [rst[p].type];
            });
        }
        return rst;
    },
    valid (props, key, val) {
        let valid = false;
        if (props[key]) {
            if (!props[key].type) {
                valid = true;
            } else {
                return props[key].type.some(t => this.check(t, val));
            }
        }
        return valid;
    },
    getValue (props, key, value) {
        var rst;
        if (value !== undefined && this.valid(props, key, value)) {
        	
            rst = value;
        } else if (typeof(props[key].default) === 'function') {
            rst = props[key].default();
        } else
            rst = props[key].default;
        return props[key].coerce ? props[key].coerce(rst) : rst;
    }
};

export default class {

    $com = {};
    
    $refs = {};
    
    $mixins = [];

    $isComponent = true;
    $prefix = '';

    $mappingProps = {};

    data = {};
    methods = {};
	
	$route = {};
	
	_options = {};

    // rpx(num, b) {
    //     if (b) {
		// 	return num + 'rpx'
		// }
		// return num
    // }
	
    $deepCopy (obj) {
    	let newobj;
		
    	newobj=Object.assign({},obj);
	
		Object.keys(obj||{}).forEach(key=>{
			if (typeof obj[key] === 'object') {
				newobj[key] = this.$deepCopy(obj[key]);
			}
		});
    	
    	return newobj;
	}
 
	$bindPageObject (cClass) {
    	
    	let obj = util.$copy(cClass,true);
  
		Object.keys(obj || {}).forEach((option)=>{
			this[option] = obj[option]
		})
		
		
		// if (typeof(obj.data) === 'function') {
		// 	this.data = obj.data.apply(this);
		// }
		
		this.data = obj.data || {};
		
		this.methods = this.methods || {}
		this.events = this.events || {}
		
		Object.keys(obj.methods || {}).forEach((name)=>{
			this.methods[name] = obj.methods[name]
			this[name] = obj.methods[name]
			// this.events[name] = obj.methods[name]
		})
		
		this.components = obj.components || {}
		
		this.computed = this.computed || {}
		
		Object.keys(obj.computed || {}).forEach((key)=>{
			this.computed[key] = obj.computed[key]
			this[key] = obj.computed[key]
		})
		
		this.props = this.props || {};
		Object.keys(obj.props || {}).forEach( key => {
			this.props[key] = obj.props[key]
			this[key] = this.props[key]
		})
		
		this.created = obj.created || function () {
				// console.log('page created')
		}
		
		this.mounted = obj.mounted
		
		this.beforeDestroy = obj.beforeDestroy
	}
	
	$init ($wxpage, $root, $parent) {
		
		// console.log('info','comp $init')
        let self = this;
        this.$wxpage = $wxpage;
        if (this.$isComponent) {
            this.$root = $root || this.$root;
            this.$parent = $parent || this.$parent;
            this.$wxapp = this.$root.$parent.$wxapp;
        }

        if (this.props) {
            this.props = Props.build(this.props);
        }

        let k, defaultData = {};


        let props = this.props;
        let key, val, binded;
        let inRepeat = false, repeatKey;
		
		if (typeof(this.data) === 'function') {
		    this.$dataDefault = this.data;
		    this.data = {};
		}

        // save a init data.
        if (this.$initData === undefined) {
            this.$initData = util.$copy(this.data, true);
        } else {
            this.data = util.$copy(this.$initData, true);
        }
        
        
        if (this.$props) { // generate mapping Props
            for (key in this.$props) {
                for (binded in this.$props[key]) {
                    if (/\.sync$/.test(binded) || /\.once$/.test(binded)) { // sync goes to mapping
                        if (!this.$mappingProps[this.$props[key][binded]]){
							this.$mappingProps[this.$props[key][binded]] = {};
						}
	
						this.$mappingProps[this.$props[key][binded]][key] = this.$mappingProps[this.$props[key][binded]][key] || [];
						this.$mappingProps[this.$props[key][binded]][key].push(binded.substring(7, binded.length - 5));
                        // this.$mappingProps[this.$props[key][binded]][key] = binded.substring(7, binded.length - 5);
                    }
                }
            }
        }
		// console.log(`xxx $mappingProps  =`,this.$mappingProps);

		if (this.refs) {
			for (key in this.refs) {
				let comName = this.refs[key];
				let com = this.$getComponent(comName);
				
				if (!com) {
					throw new Error('Invalid path: ' + com);
				}
				
				let comProxy = {}
				
				if (com.methods) {
					Object.keys(com.methods).forEach(methodName=>{
						let method = com.methods[methodName];
						comProxy[methodName] = function (...args) {
							// console.log(`refs ${key}-->invoke function ${methodName} `);
							if (typeof method !== 'function') {
								throw new Error(`${comName} has no method called ${methodName}`);
							}
							let $evt = new event('', this, 'invoke');
							let rst = method.apply(com,args.concat($evt));
							// com.$apply();
							return rst;
						}
					});
				}
				
				this.$refs[key] = comProxy;
			}
		}
		
        if (props) {
            // console.log('props=',this.$name,props);
			for (key in props) {
				val = undefined;
                // 此处$name 组件局部名
                if ($parent && $parent.$props && $parent.$props[this.$name]) {
                    
                    val = $parent.$props[this.$name][key];
                    binded = $parent.$props[this.$name][`v-bind:${key}.once`] || $parent.$props[this.$name][`v-bind:${key}.sync`];
	
                    if (binded) {
                        if (typeof(binded) === 'object') {
							props[key].repeat = binded.for;
							props[key].item = binded.item;
							props[key].index = binded.index;
							props[key].key = binded.key;
							props[key].value = binded.value;

							inRepeat = true;

							let bindfor = binded.for, binddata = $parent;
							bindfor.split('.').forEach(t => {
                                binddata = binddata[t];
							});
							if (binddata && (typeof binddata === 'object' || typeof binddata === 'string')) {
                                repeatKey = Object.keys(binddata)[0];
							}
							
							if (!this.$mappingProps[key]) this.$mappingProps[key] = {};
							this.$mappingProps[key]['parent'] = {
                                mapping: binded.for,
                                from: key
							};
	
							// console.log('binded.value=',binded.value);
	
							// // for循环中的 常量值绑定
							// val = binded.value;
	
							if (props[key].value === props[key].item) {
								// val = binddata[index];
							} else if (props[key].value === props[key].index) {
								// val = index;
							} else if (props[key].value === props[key].key) {
								// val = index;
							} else {
								val = $parent[props[key].value];
							}
	
							this.data[key] = val;
							
							// for循环中，父子组件参数绑定 ，用于后续动态响应
							if(!$parent.$mappingProps[binded.value]){
								$parent.$mappingProps[binded.value]={};
							}
	
							$parent.$mappingProps[binded.value][this.$name] = $parent.$mappingProps[binded.value][this.$name] || [];
							$parent.$mappingProps[binded.value][this.$name].push(key);
                        } else {
                            // 从父节点取props参数
                            val = $parent[binded];
							// this.data[key] = val;
							
                            if (props[key].twoWay) {
                                if (!this.$mappingProps[key]) this.$mappingProps[key] = {};
								this.$mappingProps[key]['parent'] = this.$mappingProps[key]['parent'] || [];
								this.$mappingProps[key]['parent'].push(binded);
                            }
                        }
                        // console.log(`++++ ${this.$prefix} `,key,val);
                    } else if (typeof val === 'object' && val.value !== undefined) { // 静态传值
                        // for 循环中静态传值
                        this.data[key] = val.value;
                    }
					// console.log(`++++ ${this.$prefix} key,val,this.data[key]= `,key,val,this.data[key]);
                }
				// console.log('fn key=',key,this.data,this.data[key],props[key].repeat);
                if (!this.data[key] && !props[key].repeat) {
                    // 如果没有传参，default赋值
                    val = Props.getValue(props, key, val);
                    // console.log('++++ val=',val);
                    this.data[key] = val;
                }
				// console.log('fn key=',key,this.data);
            }
        }

		// console.log(`xxx ${this.$prefix} this.data=`,this.data)
        for (k in this.data) {
            defaultData[`${this.$prefix}${k}`] = this.data[k];
            this[k] = this.data[k];
            // this[k] = util.$copy(this.data[k], true);
        }
        
        if (this.$dataDefault) {
			let data = this.$dataDefault.apply(this);
			// console.log(`${this.$prefix} $dataDefault=`,data);
			
			// 处理data  mStyle_weex_style
			Object.keys(data).forEach(key=>{
				if (key.indexOf('_weex_style') !== -1) {
					
					let mStyle = data[key];
					
					if (!mStyle.display||mStyle.display==='') {
						mStyle.display='flex';
					}
					data[key] = util.$formatStyle(mStyle);
				}
			})
			
			this.data=Object.assign(this.data,data);
        }
		
        
		for (k in this.data) {
			defaultData[`${this.$prefix}${k}`] = this.data[k];
			this[k] = this.data[k];
		}
        
        this.$data = util.$copy(this.data, true);
		
		// console.log('inRepeat repeatKey=',inRepeat,repeatKey);
        if (inRepeat && repeatKey !== undefined){
			this.$setIndex(repeatKey);
		
        }
		// console.log(`xxx ${this.$prefix} this.data=`,this.data);
        
        

        if (this.computed) {
			let weex_computed = {};
			
            for (k in this.computed) {
        
            	if (k.indexOf('weex_computed_') !== -1) {
            		weex_computed[k] = this.computed[k];
            		continue;
				}
            	
                let fn = this.computed[k];
                if (fn.name.indexOf('_weex_style') !== -1) {
                
					let fn2 = function () {
						let mStyle = fn.call(this);
						// style:   {}  -> 'string'
						
						if (typeof mStyle === 'string') {
							return mStyle;
						}
						
                        return util.$formatStyle(mStyle);
					}

					this.computed[k] = fn2;
                }
				defaultData[`${this.$prefix}${k}`] = this.computed[k].call(this);
                this[k] = util.$copy(defaultData[`${this.$prefix}${k}`], true);
            }
            
            for (k in weex_computed) {
				let fn = this.computed[k];
				if (fn.name.indexOf('_weex_style') !== -1) {
		
					let fn2 = function () {
						let mStyle = fn.call(this);
						// style:   {}  -> 'string'
						if (typeof mStyle === 'string') {
							return mStyle;
						}
						return util.$formatStyle(mStyle);
					}
					
					this.computed[k] = fn2;
				}
				defaultData[`${this.$prefix}${k}`] = this.computed[k].call(this);
				this[k] = util.$copy(defaultData[`${this.$prefix}${k}`], true);
			}
        }
		
        
        this.setData2(defaultData);
		
        let coms = Object.getOwnPropertyNames(this.$com);
        if (coms.length) {
            coms.forEach((name) => {
                this.$com[name].$init(this.getWxPage(), $root, this);
                this.$com[name].onLoad && this.$com[name].onLoad();
                this.$com[name].$mixins.forEach((mix) => {
                    mix['onLoad'] && mix['onLoad'].call(this.$com[name]);
                });

                this.$com[name].$apply();
            });
        }
    }

    $initMixins () {
		
		let $wxapp = getApp();
		
		let globalMixins = $wxapp.$app.mixins || [];
		
		
		this.mixins = this.mixins || [];
	
		this.$mixins = globalMixins.concat(this.mixins);
		
		
		this.$mixins.forEach(mix=>{
			Object.keys(mix['methods'] || {}).forEach(k=>{
				this[k]=mix['methods'][k];
			})
		})
    }

    onLoad (options) {
	
		this._options = options;
		
		this.$route.params = {};
		if (options) {
			
			let params = options.params;
			if (params) {
				this.$route.params = JSON.parse(params);
			}
			
		}
		// let _params = getApp().globalData._params || {};
        let _params = getApp()._params || {};
		Object.keys(_params || {}).forEach(key=>{
			// if (Reflect.has(this.$route.params,key)) {
			// 	Reflect.deleteProperty(this.$route.params, key);
			// }

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
		
    	this.$router = getApp().$app.$router;
		this.$mixins.forEach((mix) => {
			mix['created'] && mix['created'].apply(this);
		});
	
		this.created && this.created.apply(this);
    
    }
	
	onReady () {
		let coms = Object.getOwnPropertyNames(this.$com);
		if (coms.length) {
			coms.forEach((name) => {
				this.$com[name].onReady && this.$com[name].onReady();
				this.$com[name].$apply();
			});
		}
		this.$mixins.forEach((mix) => {
			mix['mounted'] && mix['mounted'].apply(this);
		});
		
		this.mounted && this.mounted.apply(this);
	}
	
	$onShow () {
		// let _params = getApp().globalData._params || {};
        let _params = getApp()._params || {};
		Object.keys(_params || {}).forEach(key=>{
			// if (Reflect.has(this.$route.params,key)) {
			// 	Reflect.deleteProperty(this.$route.params, key);
			// }
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
  
		let coms = Object.getOwnPropertyNames(this.$com);
		if (coms.length) {
			coms.forEach((name) => {
				this.$com[name].onShow && this.$com[name].onShow();
				this.$com[name].$apply();
			});
		}
		this.$mixins.forEach((mix) => {
			mix['onShow'] && mix['onShow'].apply(this);
		});
		
		this.onShow && this.onShow.apply(this);
	}
	
	onUnload () {
		let coms = Object.getOwnPropertyNames(this.$com);
		if (coms.length) {
			coms.forEach((name) => {
				this.$com[name].onUnload && this.$com[name].onUnload();
				this.$com[name].$apply();
			});
		}
		this.$mixins.forEach((mix) => {
			mix['beforeDestroy'] && mix['beforeDestroy'].apply(this);
		});
		this.beforeDestroy && this.beforeDestroy.apply(this);
	}
	
	setData2 (k, v) {
        // console.log(`### setData ${this.$prefix}`, k, v);
        if (typeof(k) === 'string') {
            if (v) {
                let tmp = {};
                tmp[k] = v;
                k = tmp;
            } else {
                let tmp = {};
                tmp[k] = this.data[`${k}`];
                k = tmp;
            }
            return this.$wxpage.setData(k);
        }
        let t = null, reg = new RegExp('^' + this.$prefix.replace(/\$/g, '\\$'), 'ig');
        for (t in k) {
            let noPrefix = t.replace(reg, '');
            this.$data[noPrefix] = util.$copy(k[t], true);
        }
        return this.$wxpage.setData(k);
    }

    getWxPage () {
        return this.$wxpage;
    }

    getCurrentPages () {
        return this.$wxpage.getCurrentPages();
    }

    /**
     * 对于在repeat中的组件，index改变时需要修改对应的数据
     */
    $setIndex (index) {
        
        // return;
        
        this.$index = index;

        let props = this.props,
            $parent = this.$parent;
        let key, val, binded;
        if (props) {
            for (key in props) {
                val = undefined;
                if ($parent && $parent.$props && $parent.$props[this.$name]) {
                    val = $parent.$props[this.$name][key];
                    binded = $parent.$props[this.$name][`v-bind:${key}.once`] || $parent.$props[this.$name][`v-bind:${key}.sync`];
                    if (binded) {
                        if (typeof(binded) === 'object') {
                            let bindfor = binded.for, binddata = $parent;
                            bindfor.split('.').forEach(t => {
                                binddata = binddata[t];
                            });

                            index = Array.isArray(binddata) ? +index : index;
                            
                            if (props[key].value === props[key].item) {
                                val = binddata[index];
                            } else if (props[key].value === props[key].index) {
                                val = index;
                            } else if (props[key].value === props[key].key) {
                                val = index;
                            } else {
                                val = $parent[props[key].value];
                            }
                            this.$index = index;
                            this.data[key] = val;
                            this[key] = val;
                            this.$data[key] = util.$copy(this[key], true);
                        }
                    }
                }
            }
            // Clear all childrens index;
            for (key in this.$com) {
                this.$com[key].$index = undefined;
            }
        }

    }
	
	
	$nextTick(fn) {
    	this.$apply();
    	fn.apply(this);
	}

    $getComponent(com) {
        if (typeof(com) === 'string') {
            if (com.indexOf('/') === -1) {
                return this.$com[com];
            } else if (com === '/') {
                return this.$parent;
            } else {
                let path = com.split('/');
                path.forEach((s, i) => {
                    if (i === 0) {
                        if (s === '') {   //   /a/b/c
                            com = this.$root;
                        } else if (s === '.') {
                            // ./a/b/c
                            com = this;
                        } else if (s === '..') {
                            // ../a/b/c
                            com = this.$parent;
                        } else {
                            com = this.$getComponent(s);
                        }
                    } else if (s) {
                        com = com.$com[s];
                    }
                });
            }
        }
        return (typeof(com) !== 'object') ? null : com;
    }

    $invoke (com, method, ...args) {
        // console.log('do $invoke', com, methods, args);
        com = this.$getComponent(com);

        if (!com) {
            throw new Error('Invalid path: ' + com);
        }

        let fn = com.methods ? com.methods[method] : '';

        if (typeof(fn) === 'function') {
            let $evt = new event('', this, 'invoke');
            let rst = fn.apply(com, args.concat($evt));
            com.$apply();
            return rst;
        } else {
            fn = com[method];
        }

        if (typeof(fn) === 'function') {
            return fn.apply(com, args);
        } else {
            throw new Error('Invalid method: ' + method);
        }
    }

    $broadcast (evtName, ...args) {
        let com = this;
        let $evt = typeof(evtName) === 'string' ? new event(evtName, this, 'broadcast') : $evt;
        let queue = [com];

        while(queue.length && $evt.active) {
            let current = queue.shift();
            for (let c in current.$com) {
                c = current.$com[c];
                queue.push(c);
                let fn = getEventsFn(c, evtName);
                if (fn) {
                    c.$apply(() => {
                        fn.apply(c, args.concat($evt));
                    });
                }
                if (!$evt.active)
                    break;
            }
        }
    }
    
    $emit (evtName, ...args) {
        let com = this;
        let source = this;
        let $evt = new event(evtName, source, 'emit');
        // User custom event;
        if (this.$parent.$events && this.$parent.$events[this.$name]) {
            let method = this.$parent.$events[this.$name]['v-on:' + evtName];
            if (method && this.$parent.methods) {
				// console.log(`$emit1  ${evtName}-->${method}`);
                let fn = this.$parent.methods[method];
                if (typeof(fn) === 'function') {
                    this.$parent.$apply(() => {
                        fn.apply(this.$parent, args.concat($evt));
                    });
                    return;
                } else {
                    throw new Error(`Invalid method from emit, component is ${this.$parent.$name}, method is ${method}. Make sure you defined it already.\n`);
                }
            }
        }
        while(com && com.$isComponent !== undefined && $evt.active) {
            // 保存 com 块级作用域组件实例
            let comContext = com;
            let fn = getEventsFn(comContext, evtName);
            fn && comContext.$apply(() => {
                fn.apply(comContext, args.concat($evt));
            });
            com = comContext.$parent;
        }
    }

    $apply (fn) {
        if (typeof(fn) === 'function') {
            fn.call(this);
            this.$apply();
        } else {
            if (this.$$phase) {
                this.$$phase = '$apply';
            } else {
                this.$digest();
            }
        }
    }

    $digest () {
		// console.log(`xxx ${this.$prefix} digest this.$data`,this.$data);
        let k;
        let originData = this.$data;
        this.$$phase = '$digest';
        while (this.$$phase) {
            let readyToSet = {};
            if (this.computed) {
            	let weex_computed = {}
                for (k in this.computed) { // If there are computed property, calculated every times
					if (k.indexOf('weex_computed_') !== -1) {
						weex_computed[k] = this.computed[k];
						continue;
					}
					let fn = this.computed[k], val = fn.call(this);
					if (!util.$isEqual(this[k], val)) { // Value changed, then send to ReadyToSet
						readyToSet[this.$prefix + k] = val;
						this[k] = util.$copy(val, true);
					}
				}
				for (k in weex_computed) {
					let fn = this.computed[k], val = fn.call(this);
					if (!util.$isEqual(this[k], val)) { // Value changed, then send to ReadyToSet
						readyToSet[this.$prefix + k] = val;
						this[k] = util.$copy(val, true);
					}
				}
            }
            for (k in originData) {
                if (!util.$isEqual(this[k], originData[k])) { // compare if new data is equal to original data
                    // data watch trigger
                    if (this.watch) {
                        if (this.watch[k]) {
                            if (typeof this.watch[k] === 'function') {
                                this.watch[k].call(this, this[k], originData[k]);
                            } else if (typeof this.watch[k] === 'string' && typeof this.methods[k] === 'function') {
                                this.methods[k].call(this, this[k], originData[k]);
                            }
                        }
                    }
					readyToSet[this.$prefix + k] = this[k];
					this.data[k] = this[k];
	
					originData[k] = util.$copy(this[k], true);
					// Send to ReadyToSet
					if (this.$mappingProps[k]) {
                        Object.keys(this.$mappingProps[k]).forEach((changed) => {
                            let mappingList = this.$mappingProps[k][changed] || [];
							mappingList.forEach(mapping=>{
								if (typeof(mapping) === 'object') {
									// console.log(`1 ${this.$prefix} changed=`,changed,k,this.$mappingProps)
									this.$parent.$apply();
								} else if (changed === 'parent' && !util.$isEqual(this.$parent.$data[mapping], this[k])) {
									// console.log(`2 ${this.$prefix} changed=`,changed,k,this.$mappingProps)
									this.$parent[mapping] = this[k];
									this.$parent.data[mapping] = this[k];
									this.$parent.$apply();
								} else if (changed !== 'parent' && !util.$isEqual(this.$com[changed].$data[mapping], this[k])) {
									// console.log(`3 ${this.$prefix} changed=`,changed,k,this.$mappingProps)
									this.$com[changed][mapping] = this[k];
									this.$com[changed].data[mapping] = this[k];
									this.$com[changed].$apply();
								}
							})
                        });
                    }
                }
            }
            if (Object.keys(readyToSet).length) {
                this.setData2(readyToSet);
            }
            this.$$phase = (this.$$phase === '$apply') ? '$digest' : false;
        }
    }

}

function getEventsFn (comContext, evtName) {
    let fn = comContext.events ? comContext.events[evtName] : undefined;
    const typeFn = typeof(fn);
    let fnFn;
    if (typeFn === 'string') {
        // 如果 events[k] 是 string 类型 则认为是调用 methods 上方法
        const method = comContext.methods && comContext.methods[fn];
        if (typeof(method) === 'function') {
            fnFn = method;
        }
    } else if (typeFn === 'function') {
        fnFn = fn;
    }
    return fnFn;
}
