/**
 * Created by FJC on 2017/10/24.
 */

export default class WxRouter {
	
	$nameMapping = {}
	
	$pathMapping = {}
	
	$urlMapping = {}
	
	routes = []
	
	options = {}
	
	$pageStack = []
	
	constructor(options){
		this.options = options;
		// console.log('### WxRouter ,options=',options);
		Object.keys(options).forEach(key=>{
			this[key] = options[key];
		});
		
		// console.log('### WxRouter=',this);
		this.routes.forEach(k=>{
			this.$nameMapping[k.name] = k;
			this.$pathMapping[k.path] = k;
			this.$urlMapping[k.url] = k;
		});
	}
	
	
	updateStack () {
		
		let pageStack = getCurrentPages() || [];
		
		this.$pageStack = [];
		pageStack.forEach(page=>{
			this.$pageStack.push(this.$urlMapping['/'+page.__route__]);
		});
		
		// console.log('##$pageStack=',this.$pageStack);
		
		
	}
	
	
	get currentRoute () {
		// console.log('###currentRoute getter',)
		let pageStack = getCurrentPages() || [];
		
		let route = {};
		if (pageStack.length > 0) {
			let p = pageStack[pageStack.length-1];
			route = this.$urlMapping['/'+p.__route__];
		}
		// console.log('###currentRoute getter',route)
		return route;
		
	}
	
	
	checkData = function (obj, isGlobal = true){
		let params = {};
		let url = ''
		// console.log('router:',typeof(obj));
		
		if(typeof(obj) === 'object'){
			
			let r;
			
			if (obj.name) {
				r = this.$nameMapping[obj.name];
				if (!r) {
					throw new Error(`cannot find the route named ${obj.name},please check your WxRouter config.`);
				}
				url = r.url;
			} else if (obj.path) {
				r = this.$pathMapping[obj.path];
				if (!r) {
					throw new Error(`cannot find the route of which path is ${obj.name},please check your WxRouter config.`);
				}
				url = r.url;
			}
			if (!url) {
				throw new Error(`cannot find the url of the route:`,r);
			}
			
			url = url + '?';
			
			if(obj.params){
				if (isGlobal) {
                    // getApp().globalData = getApp().globalData || {};
                    // getApp().globalData._params = obj.params;

                    getApp()._params = obj.params;
				} else {
					url = url + 'params=' + JSON.stringify(obj.params);
				}
				

			}
			
			let self = this
			
			// self.updateStack();
			let pre = this.currentRoute;
			let next = r;
			
			params.success = function (msg) {
				// console.log('### getCurrentPages',getCurrentPages());
				self.success && self.success(pre,next,obj.params,msg);
				obj.success && obj.success ();
			}
			
			params.fail = function (msg) {
				self.fail && self.fail(pre,next,obj.params,msg);
				obj.fail && obj.fail ();
			}
			params.complete = function (msg) {
				self.complete && self.complete(pre,next,obj.params,msg);
				obj.complete && obj.complete ();
			}
			
		}else if(typeof(obj) === 'string'){
			
			// TODO 动态路由,对应 vue-router
			url = obj
		}
		
		if(url && url.length > 0){
			params.url = url
			
			// console.log('router push ',params)
			
			return params
		}else{
			// console.error('router push error')
			
			return false
		}
	}
	
	
	
	/*
	 wx.navigateTo(OBJECT)
	 保留当前页面，跳转到应用内的某个页面，使用wx.navigateBack可以返回到原页面。
	 
	 OBJECT 参数说明：
	 
	 参数	类型	必填	说明
	 url	String	是	需要跳转的应用内非 tabBar 的页面的路径 , 路径后可以带参数。参数与路径之间使用?分隔，参数键与参数值用=相连，不同参数用&分隔；如 'path?key=value&key2=value2'
	 success	Function	否	接口调用成功的回调函数
	 fail	Function	否	接口调用失败的回调函数
	 complete	Function	否	接口调用结束的回调函数（调用成功、失败都会执行）
	 */
	push = function (obj) {
		// console.log('wxRouter,push');
		let params =this.checkData(obj)
		if(params){
			wx.navigateTo(params)
		}
	}
	/*
	 wx.redirectTo(OBJECT)
	 关闭当前页面，跳转到应用内的某个页面。
	 
	 OBJECT 参数说明：
	 
	 参数	类型	必填	说明
	 url	String	是	需要跳转的应用内非 tabBar 的页面的路径，路径后可以带参数。参数与路径之间使用?分隔，参数键与参数值用=相连，不同参数用&分隔；如 'path?key=value&key2=value2'
	 success	Function	否	接口调用成功的回调函数
	 fail	Function	否	接口调用失败的回调函数
	 complete	Function	否	接口调用结束的回调函数（调用成功、失败都会执行）
	 */
	replace = function (obj) {
		// console.log('wxRouter,replace');
		let params = this.checkData(obj)
		if(params){
			wx.redirectTo(params)
		}
	}
	/*
	 wx.navigateBack(OBJECT)
	 关闭当前页面，返回上一页面或多级页面。可通过 getCurrentPages()) 获取当前的页面栈，决定需要返回几层。
	 
	 OBJECT 参数说明：
	 
	 参数	类型	默认值	说明
	 delta	Number	1	返回的页面数，如果 delta 大于现有页面数，则返回到首页。
	 */
	pop = function (delta) {
		// console.log('wxRouter,pop');
		wx.navigateBack({delta:delta})
	}
	
	go = function (delta) {
		// console.log('wxRouter,go');
		wx.navigateBack({delta:delta})
	}
	/*
	 wx.reLaunch(OBJECT)
	 基础库 1.1.0 开始支持，低版本需做兼容处理
	 
	 关闭所有页面，打开到应用内的某个页面。
	 
	 OBJECT 参数说明：
	 
	 参数	类型	必填	说明
	 url	String	是	需要跳转的应用内页面路径 , 路径后可以带参数。参数与路径之间使用?分隔，参数键与参数值用=相连，不同参数用&分隔；如 'path?key=value&key2=value2'，如果跳转的页面路径是 tabBar 页面则不能带参数
	 success	Function	否	接口调用成功的回调函数
	 fail	Function	否	接口调用失败的回调函数
	 complete	Function	否	接口调用结束的回调函数（调用成功、失败都会执行
	 */
	reLaunch = function (obj){
		// console.log('wxRouter,reLaunch');
		wx.reLaunch(obj)
	}
	/*
	 wx.switchTab(OBJECT)
	 跳转到 tabBar 页面，并关闭其他所有非 tabBar 页面
	 
	 OBJECT 参数说明：
	 
	 参数	类型	必填	说明
	 url	String	是	需要跳转的 tabBar 页面的路径（需在 app.json 的 tabBar 字段定义的页面），路径后不能带参数
	 success	Function	否	接口调用成功的回调函数
	 fail	Function	否	接口调用失败的回调函数
	 complete	Function	否	接口调用结束的回调函数（调用成功、失败都会执行
	 */
	switchTab = function (obj){
		// console.log('wxRouter,switchTab');
		let params =this.checkData(obj, true);
		if(params){
			wx.switchTab(params)
		}
	}
	
}