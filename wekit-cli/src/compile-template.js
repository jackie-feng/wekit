import {DOMParser, DOMImplementation} from 'xmldom';
import path from 'path';
import util from './util';
import cache from './cache';
import cWpy from './compile-wpy';

import loader from './loader';

const PREFIX = '$';
const JOIN = '$';

const BOOLEAN_ATTRS = ['a:else', 'wx:else', 'show-info', 'active', 'controls', 'danmu-btn', 'enable-danmu', 'autoplay', 'disabled', 'show-value', 'checked', 'scroll-x', 'scroll-y', 'auto-focus', 'focus', 'auto-height', 'password', 'indicator-dots', 'report-submit', 'hidden', 'plain', 'loading', 'redirect', 'loop', 'controls'];

export default {
	comPrefix: {},
	comCount: 0,
	getPrefix (prefix) {
		if (!this.comPrefix[prefix]) {
			this.comPrefix[prefix] = util.camelize(prefix || '');;
		}
		return this.comPrefix[prefix];
	},
	getTemplate (content) {
		content = `<template>${content}</template>`;
		content = util.attrReplace(content);
		let doc = new DOMImplementation().createDocument();
		let node = cWpy.createParser().parseFromString(content);
		let template = [].slice.call(node.childNodes || []).filter((n) => n.nodeName === 'template');
		
		[].slice.call(template[0].childNodes || []).forEach((n) => {
			doc.appendChild(n);
		});
		return doc;
	},
	
	isInQuote (str, n) {
		let firstIndex = str.search(/"|'/);
		if (firstIndex === -1 || firstIndex > n) return false;
		let char = '';
		let last = '';
		for (let i = 0; i < n; i++) {
			let c = str[i];
			if (c === '"' || c === '\'') {
				if (!char) {
					char = c;
				} else if (char === c && last !== '\\') {
					char = '';
				}
			}
			last = c;
		}
		return char !== '';
	},
	
	getFunctionInfo (str) {
		let rst = {name: '', params: []}, char = '', tmp = '', stack = [];
		for (let i = 0, len = str.length; i < len; i++) {
			char = str[i];
			if (!rst.name) {
				if (char === '(') {
					rst.name = tmp;
					tmp = '';
					continue;
				}
			}
			if ((char === ',' || char === ')') && stack.length === 0) {
				let p = tmp.replace(/^\s*/ig, '').replace(/\s*$/ig, '');
				if (p && (p[0] === '"' || p[0] === '\'') && p[0] === p[p.length - 1]) {
					p = p.substring(1, p.length - 1);
				}
				rst.params.push(p);
				tmp = '';
				continue;
			}
			if (char === '\'' || char === '"') {
				if (stack.length && stack[stack.length - 1] === char)
					stack.pop();
				else
					stack.push(char);
			}
			tmp += char;
		}
		return rst;
	},
	
	// 替换xmldom生成的无值属性
	replaceBooleanAttr(code) {
		let reg;
		BOOLEAN_ATTRS.forEach((v) => {
			reg = new RegExp(`${v}=['"]${v}['"]`, 'ig');
			code = code.replace(reg, v);
		})
		return code;
	},
	
	parseExp (content, prefix, ignores, mapping) {
		let comid = this.getPrefix(prefix);
		if (!comid)
			return content;
		// replace {{ param ? 'abc' : 'efg' }} => {{ $prefix_param ? 'abc' : 'efg' }}
		
		util.Log('mapping=',mapping);
		return content.replace(/\{\{([^}]+)\}\}/ig, (matchs, words) => {
			return matchs.replace(/[^\.\w'"](\.{0}|\.{3})([a-z_\$][\w\d\._\$]*)/ig, (match, expand, word, n) => {
				// console.log(matchs + '------' + match + '--' + word + '--' + n);
				
				let char = match[0];
				let tmp = word.match(/^([\w\$]+)(.*)/);
				let w = tmp[1];
				let rest = tmp[2];
				if (ignores[w] || this.isInQuote(matchs, n)) {
					return match;
				} else {
					if (mapping.items && mapping.items[w]) {
						// prefix 减少一层
						let upper = comid.split(PREFIX);
						upper.pop();
						upper = upper.join(PREFIX);
						upper = upper ? `${PREFIX}${upper}${JOIN}` : '';
						return `${char}${expand}${upper}${mapping.items[w].mapping}${rest}`;
					}
					return `${char}${expand}${PREFIX}${comid}${JOIN}${word}`;
				}
			});
		});
	},
	
	/**
	 * Get :class expression
	 * e.g. getClassExp('{"abc": num < 1}');
	 */
	parseClassExp (exp) {
		exp = exp.replace(/^\s/ig, '').replace(/\s$/ig, '');
		if (exp[0] === '{' && exp[exp.length - 1] === '}') {
			exp = exp.substring(1, exp.length - 1);
			let i = 0, len = exp.length;
			let flagStack = [], flag = 'start';
			let classNames = [], result = {}, str = '';
			for (i = 0; i < len; i++) {
				if ((exp[i] === '\'' || exp[i] === '"')) {
					if (flagStack.length && flagStack[0] === exp[i]) {
						flagStack.pop();
						if (flag === 'class') {
							flag = ':';
							continue;
						} else if (flag === 'expression') {
							str += exp[i];
							continue;
						}
					} else {
						if (flagStack.length === 0) {
							flagStack.push(exp[i]);
							if (flag === 'start') {
								flag = 'class';
								continue;
							} else if (flag === 'expression') {
								str += exp[i];
								continue;
							}
						}
					}
				}
				// {abc: num < 1} or {'abc': num <１}
				if (exp[i] === ':' && (flag === ':' || flag === 'class') && flagStack.length === 0) {
					flag = 'expression';
					classNames.push(str);
					str = '';
					continue;
				}
				if (exp[i] === ',' && flag === 'expression' && flagStack.length === 0) {
					result[classNames[classNames.length - 1]] = str.replace(/^\s/ig, '').replace(/\s$/ig, '');;
					str = '';
					flag = 'start';
					continue;
				}
				// get rid of the begining space
				if (!str.length && exp[i] === ' ')
					continue;
				
				// not started with '', like {abc: num < 1}
				if (flag === 'start') {
					flag = 'class';
				}
				
				if (flag === 'class' || flag === 'expression') {
					str += exp[i];
				}
			}
			if (str.length) {
				result[classNames[classNames.length - 1]] = str.replace(/^\s/ig, '').replace(/\s$/ig, '');
			}
			return result;
		} else {
			throw ':class expression is not correct, it has to be {\'className\': mycondition}';
		}
	},
	
	
	// 通过mapping一层层映射，反应到属性上
	getMappingIndex (mapping, arr) {
		if (!arr)
			arr = [];
		
		if (mapping === null)
			return arr.reverse();
		
		let val = mapping.prefix ? `${PREFIX}${mapping.prefix}${JOIN}${mapping.for.index}` : mapping.for.index;
		arr.push(`{{${val}}}`);
		return this.getMappingIndex(mapping.parent, arr);
	},
	
	
	updateBind (node, prefix, ignores = {}, mapping = {}) {
		
		let config = cache.getConfig();
		let tagprefix = config.output === 'ant' ? 'a' : 'wx';
		
		let comid = prefix ? this.getPrefix(prefix) : '';
		
		if (node.nodeName === '#text' && prefix) {
			if (node.data && node.data.indexOf('{{') > -1) {
				node.replaceData(0, node.data.length, this.parseExp(node.data, prefix, ignores, mapping));
			}
		} else {
			let parentClass;
			let parentStyle;
			[].slice.call(node.attributes || []).forEach((attr) => {
				//process require(....)"
				
				if (attr.name === 'parentClass') {
					parentClass = attr.value;
					node.removeAttribute(attr.name);
					return;
				}
				if (attr.name === 'parentStyle') {
					parentStyle = attr.value;
					node.removeAttribute(attr.name);
				}
				if (attr.name === 'v-bind:src.once') {
					attr.value = attr.value.replace(/require\s*\(\s*(['"][^'")]*['"])\s*\)/ig, (match, path) => {
						return path
					})
				}

				//process expression and add prefix
				const m = /v-bind:(.*).once/.exec(attr.name)
				if (m) {
					// compile-wpy:698行处,已经转化为计算属性
					// console.log('@@@ v-bind=',attr.value);
					const propname = m[1]
					if (propname === 'style') {
						let value = util.parseStyleExp(attr.value, prefix);
						let style = node.getAttribute('style');
						if (style && style.trim() !== ''){
							if (!style.endsWith(';')){
								style=style+';';
							}
							value = style+value;
						}
						node.setAttribute(propname, value);
						node.removeAttribute(attr.name);
						return
					} else if (propname !== 'class'){
						// class is processed under
						const value = util.parseExp(attr.value, prefix);
						node.setAttribute(propname, value);
						node.removeAttribute(attr.name);
						return
					}
				}

				if (attr.name === 'v-animation') {
                    if (!attr.value.match(/\{\{.*\}\}/)) {
                    	attr.name = 'animation'
                        attr.value = util.parseExp(attr.value, prefix);
                    }
                    return
				}

				if (attr.name === 'wx:if') {
					// console.log('@@@ wx:if=',attr.value);
					if (!attr.value.match(/\{\{.*\}\}/)) {
						attr.value = util.parseExp(attr.value, prefix);
					}
					return
				}
				
				let attr_maps = {
					// 'return-key-type':'confirm-type',
					// 'autofocus':'focus',
					// 'loadmoreoffset':'lower-threshold',
					// 'bindclick':'bindtap'
				}
				
				// console.log('xxx atr:',attr.name);
				
				Object.keys(attr_maps).forEach((key) => {
					if(attr.name === key){
						// console.log('attr_maps',key);
						attr.name = attr_maps[key];
					}
				});
				
				if (attr.name === 'v-bind:class.once') {
					// console.log('### bindclass',attr.value);
					// compile-wpy:698行处,已经转化为计算属性
					// let classObject = this.parseClassExp(attr.value);
					
					let classArray = (node.getAttribute('class') || '').split(' ').map(v => v.replace(/^\s/ig, '').replace(/\s$/ig, ''));
					if (classArray.length === 1 && classArray[0] === ''){
						classArray = [];
					}
					// for (let k in classObject) {
					// 	let exp = classObject[k].replace(/\'/ig, '\\\'').replace(/\"/ig, '\\"');
					// 	let name = k.replace(/\'/ig, '\\\'').replace(/\"/ig, '\\"');
					// 	let index = classArray.indexOf(name);
					// 	if (index !== -1) {
					// 		classArray.splice(index, 1);
					// 	}
					// 	exp = `{{${exp} ? '${name}' : ''}}`;
					// 	classArray.push(this.parseExp(exp, prefix, ignores, mapping));
					// }
					classArray.push(util.parseExp(attr.value, prefix));
					node.setAttribute('class', classArray.join(' '));
					node.removeAttribute(attr.name);
					return;
				}
				if (prefix) {
					if (attr.value.indexOf('{{') > -1 && attr.name !== 'class') {
						attr.value = this.parseExp(attr.value, prefix, ignores, mapping);
					}
					if (attr.name === tagprefix + ':for' || attr.name === tagprefix + ':for-items') {
						let index = node.getAttribute(tagprefix + ':for-index') || 'index';
						let item = node.getAttribute(tagprefix + ':for-item') || 'item';
						ignores[index] = true;
						ignores[item] = true;
						//attr.value = parseExp(attr.value, prefix, ignores);
					}
				}
				// bindtap="abc" => bindtap="prefix_abc"
				if (
					(config.output !== 'ant' && (attr.name.indexOf('bind') === 0 || attr.name.indexOf('catch') === 0)) ||
					(config.output === 'ant' && (attr.name.indexOf('on') === 0 || attr.name.indexOf('catch') === 0))
				) {
					// added index for all events;
					if (mapping.items && mapping.items.length > 0) {
						// prefix 减少一层
						let upper = comid.split(PREFIX);
						upper.pop();
						upper = upper.join(PREFIX);
						upper = upper ? `${PREFIX}${upper}${JOIN}` : '';
						let comIndex = this.getMappingIndex(mapping);
						node.setAttribute('data-com-index', comIndex.join('-'));
					}
					if (attr.value.indexOf('(') > 0) {  // method('{{p}}', 123);
						// console.log('@@@ func1=',attr.value);
						let funcInfo = this.getFunctionInfo(attr.value);
						// console.log('@@@ funcInfo=',funcInfo);
						// console.log('@@@ funcInfo.name=',funcInfo.name);
						attr.value = funcInfo.name;
						funcInfo.params.forEach((p, i) => {
							node.setAttribute('data-wepy-params-' + String.fromCharCode(97 + i), `{{${PREFIX}${comid}${JOIN}${p}}}`);
						});
					}
					if (prefix)
						attr.value = `${PREFIX}${comid}${JOIN}` + attr.value;
				}
				if (attr.name === 'a:for-items' && config.output === 'ant') {
					node.setAttribute('a:for', attr.value);
					node.removeAttribute(attr.name);
				}
			});
			if (parentClass) {
				let cls = node.getAttribute('class') || '';
				node.setAttribute('class',cls+' '+parentClass.replace('wx-ct',''));
			}
			if (parentStyle) {
				let style = node.getAttribute('style');
				if (!style) {
					style = parentStyle;
				} else {
					style = style + parentStyle;
				}
				node.setAttribute('style',style);
			}
			[].slice.call(node.childNodes || []).forEach((child) => {
				this.updateBind(child, prefix, ignores, mapping);
			});
		}
		return node;
	},
	
	
	
	updateSlot (node, childNodes) {
		let slots = {}, has;
		if (!childNodes || childNodes.length === 0)
			slots = {};
		else {
			[].slice.call(childNodes || []).forEach((child) => {

				let name;
                try {
                    name = (child.nodeName === '#text' || child.nodeName === '#comment') ? '' :
                        child.getAttribute('slot');
                } catch (e) {
                	console.log('#err child=',child);
                }


				if (!name) {
					name = '$$default';
				}
				if (slots[name])
					slots[name].push(child);
				else
					slots[name] = [child];
			});
		}
		
		let slotsElems = util.elemToArray(node.getElementsByTagName('slot'));
		
		slotsElems.forEach((slot) => {
			let name = slot.getAttribute('name');
			if (!name)
				name = '$$default';
			
			// 无内容时，用子内容替换
            let replacements = (slots[name] && slots[name].length > 0) ? slots[name] : [].slice.call(slot.childNodes || []);

			let doc = new DOMImplementation().createDocument();

			replacements.forEach((n) => {
				if (name !== '$$default' && n.nodeName !== '#text' && n.nodeName !== '#comment'){
					n.removeAttribute('slot');
				}
				doc.appendChild(n);
			});
			
			node.replaceChild(doc, slot);
		});
		return node;
	},
	
	compileXML (node, wpy, prefix, childNodes, comAppendAttribute = {}, propsMapping = {}) {

		// console.log('##compileXML node',node.tagName);
		let template = 	wpy.template;
		let config = cache.getConfig();
		let tagprefix = config.output === 'ant' ? 'a' : 'wx';
		
		this.updateSlot(node, childNodes);
		
		if (node && node.documentElement) {
			
			util.Log('comAppendAttribute=',comAppendAttribute);
			util.Log('wpy.template.data=',wpy.template.data);
			util.Log('wpy.template.props=',wpy.template.props);
			util.Log('wpy.template.computed=',wpy.template.computed);
			Object.keys(comAppendAttribute).forEach((key) => {
				if (key === 'class') {
					// let cls = node.documentElement.getAttribute('class').split(' ').join(' ');
					// let parentCls = comAppendAttribute[key].split(' ').join(' ');
					// // 两个空格区分 父子组件设定的class
					// let classNames = cls.trim() + '  ' + parentCls.trim();
					node.documentElement.setAttribute('parentClass', comAppendAttribute[key]);
				} else if (key === 'style') {
					node.documentElement.setAttribute('parentStyle', comAppendAttribute[key]);
				} else if (key === 'v-bind:class.once') {
				
				} else {
					let k=key;
					
					let m = key.match(/v-bind:(.*).once/)?key.match(/v-bind:(.*).once/):key.match(/v-bind:(.*).sync/)
					
					if (m) {
						
						k = m[1];
					}
					
					if (wpy.template.props.indexOf(k) === -1){
						// console.log('### key=',key,comAppendAttribute[key]);
						node.documentElement.setAttribute(key, comAppendAttribute[key]);
					}
					
				}
			});
		}
		
		this.changeTagName(node);
		
		let repeats = util.elemToArray(node.getElementsByTagName('repeat'));
		
		let forDetail = {};
		template.props = {};
		repeats.forEach(repeat => {
			let repeatComs = [];
			// <repeat for="xxx" index="idx" item="xxx" key="xxx"></repeat>
			//                    To
			// <block wx:for="xxx" wx:for-index="xxx" wx:for-item="xxx" wx:key="xxxx"></block>
			repeat.tagName = 'block';
			
			if (repeat.parentNode) {
				// console.log('repeat.parentNode.tagname=',repeat.parentNode.tagName);
				if (repeat.parentNode.tagName === 'swiper') {
					repeat.tagName = 'swiper-item';
				}
			}
			
			let val = repeat.getAttribute('for');
			let mappingfor = [];
			if (val) {
				repeat.setAttribute(tagprefix + ':for', val);
				repeat.removeAttribute('for');
				['index', 'item', 'key'].forEach(attr => {
					let val = repeat.getAttribute(attr);
					mappingfor.push(val.trim());
					let tag = attr === 'key' ? `${tagprefix}:key` : `${tagprefix}:for-${attr}`;
					val = val || attr;
					forDetail[attr] = val;
					
					if (prefix) {
						repeat.setAttribute(tag, `${PREFIX}${prefix}${JOIN}${val}`);
					} else {
						repeat.setAttribute(tag, val);
					}
					repeat.removeAttribute(attr);
				});
			}
			Object.keys(template.components).forEach((com) => {
				repeatComs = repeatComs.concat(util.elemToArray(repeat.getElementsByTagName(com)));
			});
			
			
			repeatComs.forEach(com => {
				let comAttributes = {};
				template.props[com.tagName] = {
					items: {length: 0},
					for: forDetail,
					prefix: prefix,
					parent: propsMapping.for ? propsMapping : null
				};
				[].slice.call(com.attributes || []).forEach(attr => {
					
					comAttributes[attr.name] = attr.value;
					if (['hidden', 'wx:if', 'wx:elif', 'wx:else', 'class', 'a:if', 'a:elif', 'a:else'].indexOf(attr.name) > -1) {
					
					}
					
					util.Log('mappingfor=',mappingfor,attr.name,attr.value)
					
					// let f=0;
					// for (let i=0;i<mappingfor.length;i++){
					//     console.log('indexof',mappingfor[i],attr.value,mappingfor[i].indexOf(attr.value));
					//     if (attr.value.indexOf(mappingfor[i])!==-1){
					//
					//         f = 1;
					//     }
					// }
					// if( f === 0 ){
					//    // return;
					// }
					
					if (attr.name.indexOf('v-bind')===-1){
						return;
					}
					
					util.Log('attr.value=',attr.value);
					
					let name = attr.name;
					
					let prop = template.props[com.tagName], tmp = {};
					
					if (name.indexOf('v-bind') === 0) {
						tmp.bind = true;
						name = name.replace(/^v\-bind\:/, '');
					}
					
					if (name.indexOf('.once') === name.length - 5) {
						name = name.replace(/\.once$/, '');
						tmp.type = 'once';
					} else if (name.indexOf('.sync') === name.length - 5) {
						tmp.type = 'sync';
						name = name.replace(/\.sync$/, '');
					}
					tmp.mapping = attr.value;
					tmp.mapping = tmp.mapping.replace(/\{\{(.*)\}\}/g, (match,v)=>{
						return v;
					});
					
					prop.items[name] = tmp;
					prop.items.length++;
				});
				
				util.Log(' template.props[com.tagName]=', template.props[com.tagName])
				util.Log('comAttributes=',comAttributes)
				
				let comid = util.getComId(com);
				let src = util.findComponentInTemplate(com, template);
				if (!src) {
					util.error('找不到组件：' + com.tagName, '\n请尝试使用 npm install ' + com.tagName + ' 安装', '错误');
				} else {
					let wpy = cWpy.resolveWpy(src);
					let newnode = this.compileXML(this.getTemplate(wpy.template.code),
						wpy,
						prefix ? `${prefix}$${comid}` : `${comid}`,
						com.childNodes, comAttributes, template.props[comid]);
					node.replaceChild(newnode, com);
					
				}
			});
		});
		
		
		this.updateBind(node, prefix, {}, propsMapping);

		let componentElements = util.elemToArray(node.getElementsByTagName('component'));
		let customElements = [];
		Object.keys(template.components).forEach((com) => {
			customElements = customElements.concat(util.elemToArray(node.getElementsByTagName(com)));
		});
		
		
		componentElements = componentElements.concat(customElements);

		componentElements.forEach((com) => {


			let comid, definePath, isCustom = false, comAttributes = {};
			[].slice.call(com.attributes || []).forEach((attr) => {

				comAttributes[attr.name] = attr.value;
				if (['hidden', tagprefix + ':if', tagprefix + ':elif', tagprefix + ':else', 'class'].indexOf(attr.name) > -1) {

				}
			});
			// util.Log('###com=',com.toString());
			// util.Log('###com.childs=',com.childNodes.toString());
			if (com.nodeName === 'component') {
				comid = util.getComId(com);
				definePath = util.getComPath(com);
				if (!comid)
					throw new Error('Unknow component id');
			} else {
				isCustom = true;
				comid = util.getComId(com);
				definePath = template.components[comid];
				definePath = definePath.indexOf('.') === -1 ? definePath : path.resolve(template.src, '..' + path.sep + template.components[comid])
			}

			// console.log('-------------------------------------')
			// console.log('文件' + template.src + '\n引用 组件:' + comid + '\nimport 地址：' + definePath)
			let src = util.findComponent(definePath, isCustom);
			// console.log('路径:' + src)
			// console.log('-------------------------------------\n')


			if (!src) {
				util.error('找不到组件：' + definePath, '\n请尝试使用 npm install ' + definePath + ' 安装', '错误');
			} else {

				let wpy = cWpy.resolveWpy(src);
				let newnode = this.compileXML(this.getTemplate(wpy.template.code),
					wpy,
					prefix ? `${prefix}$${comid}` : `${comid}`,
					com.childNodes,
					comAttributes);
				let parent = com.parentNode;


				if (newnode.documentElement) {
					newnode=newnode.documentElement;
				}
                parent.replaceChild(newnode, com);
				// node.replaceChild(newnode, com);
			}
		});
		
		
		// this.changeTagName(node);
		
		// util.Log('node2=',node.toString());
		
		// console.log('文件' + template.src + '所有组件解析完毕')
		return node;
	},
	
	changeViewAttr(node, totag) {
		// util.Log('node', node)
		let tagname;
		if (typeof totag === 'object') {
			tagname = totag.name;
		} else {
			tagname = totag;
		}
		node.tagName = tagname;
		node.nodeName = tagname;
		node.localName = tagname;
		
		// console.log('tagname=',tagname);
		if (typeof totag === 'object') {
			if (totag.extra && typeof totag.extra === 'function') {
				let fn = totag.extra;
				fn.call(node,node);
			}
			Object.keys(totag.attrs||{}).forEach(key=>{
				
				if (node.getAttribute(key)) {
					node.setAttribute(totag.attrs[key], node.getAttribute(key));
					node.removeAttribute(key);
				}
				if (node.getAttribute(`v-bind:${key}.once`)) {
					node.setAttribute(`v-bind:${totag.attrs[key]}.once`, node.getAttribute(`v-bind:${key}.once`));
					node.removeAttribute(`v-bind:${key}.once`);
				}
			});
		}
	},
	
	replaceAttr (node, rules){
		let totag = rules[node.tagName];
		if (totag) {
			this.changeViewAttr(node, totag);
		}
		if (node.childNodes) {
			[].slice.call(node.childNodes || []).forEach((child) => {
				if (child.tagName) {
					this.replaceAttr(child, rules);
				}
			});
		}
	},
	changeTagName (node) {
		
		/**
		 *  weex 原生组件 -> 小程序原生组件 替换规则
		 *	name为替换的标签名
		 *	attrs替换属性名
		 *	extra额外的设置
		 *
		 * 	注：extra额外设置优先attrs替换执行
		 */

		let config = util.getConfig();
		let user_rules = config.rules || {};

		let rules = {
			cell: 'view',
			slider: {
				name: 'swiper',
				attrs: {
					'auto-play': 'autoplay',
					infinite: 'circular',
					extra:function (node) {
						node.setAttribute('circular','{{true}}');
					}
				}
			},
			div: 'view',
			list: {
				name: 'scroll-view',
				attrs: {
					loadmoreoffset: 'lower-threshold',
					bindloadmore: 'bindscrolltolower'
				},
				extra: function (node) {
					// console.log('list extra node=',node.tagName);
					if (node.getAttribute('scroll-direction') === 'horizontal') {
						node.setAttribute('scroll-y', 'false');
						node.setAttribute('scroll-x', 'true');
					} else {
						node.setAttribute('scroll-y', 'true');
						node.setAttribute('scroll-x', 'false');
					}
					node.removeAttribute('scroll-direction');
				}
			},
			scroller: {
				name: 'scroll-view',
				attrs: {
					loadmoreoffset: 'lower-threshold',
					bindloadmore: 'bindscrolltolower'
				},extra: function (node) {
					// console.log('scroller extra node=',node.tagName);
					if (node.getAttribute('scroll-direction') === 'horizontal') {
						node.setAttribute('scroll-y', 'false');
						node.setAttribute('scroll-x', 'true');
					} else {
						node.setAttribute('scroll-y', 'true');
						node.setAttribute('scroll-x', 'false');
					}
					node.removeAttribute('scroll-direction');
				}
			},
			transition: 'block',
			input: {
				name: 'input',
				attrs: {
					'return-key-type': 'confirm-type',
					autofocus: 'focus'
				}
			},
			switch: {
				name: 'switch',
				extra: function (node) {
					node.setAttribute('type','switch')
				}
			},
			wxslider: 'slider'
		}

		Object.assign(rules,user_rules);

		if (node.documentElement) {
			this.replaceAttr(node.documentElement,rules);
		}else{
			this.replaceAttr(node, rules);
		}
	},
	compile (wpy) {
		
		let template = wpy.template;
		let lang = template.type;
		// console.log('------------------------compile template -------------------------')
		// console.log(template.code)
		// console.log('----------------------------- end --------------------------------')
		let content = util.attrReplace(template.code);
		
		let config = util.getConfig();
		let src = cache.getSrc();
		let dist = cache.getDist();
		let self = this;
		
		
		let compiler = loader.loadCompiler(lang);
		
		if (!compiler) {
			return;
		}
		
		if (lang === 'pug') { // fix indent for pug, https://github.com/wepyjs/wepy/issues/211
			let indent = util.getIndent(content);
			if (indent.firstLineIndent) {
				content = util.fixIndent(content, indent.firstLineIndent * -1, indent.char);
			}
		}
		compiler(content, config.compilers[lang] || {}).then(content => {
			let node = cWpy.createParser().parseFromString(content);
			node=this.getTemplate(content);

			node = this.compileXML(node, wpy);
			let opath = path.parse(template.src);
			opath.npm = template.npm;
			let target = util.getDistPath(opath, config.output === 'ant' ? 'axml' : 'wxml', src, dist);
			
			if (node.childNodes.length === 0) {
				// empty node tostring will cause an error.
				node = '';
			} else {
				// https://github.com/jindw/xmldom/blob/master/dom.js#L585
				// https://github.com/jindw/xmldom/blob/master/dom.js#L919
				// if childNode is only one Text, then will get an error in doc.toString
				if (node.documentElement === null && node.nodeType === 9) {
					node.nodeType = 11;
				}
				// xmldom will auto generate something like xmlns:wx.
				node = node.toString().replace(/xmlns[^\s>]*/g, '');
			}
			let plg = new loader.PluginHelper(config.plugins, {
				type: 'wxml',
				code: util.decode(node.toString()),
				file: target,
				output (p) {
					util.output(p.action, p.file);
				},
				done (rst) {
					util.output('写入', rst.file);
					rst.code = self.replaceBooleanAttr(rst.code);
					util.writeFile(target, rst.code);
				}
			});
			// console.log('compile-template.js', template.src, '解析完毕')
		}).catch((e) => {
			console.log('eee', e);
		});
		//util.log('WXML: ' + path.relative(process.cwd(), target), '写入');
		//util.writeFile(target, util.decode(node.toString()));
	}
}
