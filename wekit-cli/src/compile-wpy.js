import path from 'path';
import fs from 'fs';
import {DOMParser,DOMImplementation} from 'xmldom';
import eslint from './eslint';
import cache from './cache';
import util from './util';

import escodegen from 'escodegen'
const acorn = require('acorn');
require('acorn-es7-plugin')(acorn);
const acorn_walk = require('acorn/dist/walk')


import crypto from 'crypto';

import cConfig from './compile-config';
/*import cLess from './compile-less';
import cSass from './compile-sass';
import cCss from './compile-css';*/
import cStyle from './compile-style';
import cTemplate from './compile-template';
import cScript from './compile-script';
import toWeb from './web/index';
import loader from './loader';

export default {
    _cacheWpys: {},
    createParser () {
        return new DOMParser({errorHandler: {
            warning (x) {
                util.warning(x);
                if (x.indexOf('missed value!!') > -1) {
                    // ignore warnings
                } else
                    util.warning(x);
            },
            error (x) {
                util.error(x);
            }
        }});
    },
	
	
	getMappingName(str) {
    	let stash = [], rst = '';
    	let isValue = false;
    	for (let i = 0;i <str.length ;i++ ){
    		if (str[i] === '{') {
    			stash.push('{');
			}
			if ( stash.length === 1 ){
    
				if (str[i] === ',') {
					isValue = false;
				}
				if (!isValue || str[i] === '}' ) {
					rst += str[i];
				} else {
					rst += 0;
				}
    			if (str[i] === ':') {
    				isValue = true;
				}
				
			}
			if (str[i]=== '}') {
				stash.pop();
				if (stash.length === 1) {
					rst += '1';
				}
			}
		}
		return rst;
	},

    grabConfigFromScript(str, n) {
        let stash = [], rst = '';
        for (let i = n, l = str.length; i < l; i++) {
            if (str[i] === '{')
                stash.push('{');
            if (str[i] === '}') {
                stash.pop();
                if (stash.length === 0) {
                    rst += '}';
                    break;
                }
            }
            if (stash.length) {
                rst += str[i];
            }
        }
        return rst;
    },
    /*
    Use components instead, unused functions
     */
    resolveRelation (xml) {
        let requires = [];
        let matchs = xml.match(/<component[^/>]*\/>/ig);

        (matchs || []).forEach(function (m) {
            let rst;
            if (m.indexOf('path') > -1) {
                rst = m.match(/path\s*=\s*['"](.*)['"]/);
            } else {
                rst = m.match(/id\s*=\s*['"](.*)['"]/);
            }
            if (rst[1] && requires.indexOf(rst[1]) === -1)
                requires.push(rst[1]);
        });
        return requires;
    },

    resolveWpy (xml, opath) {
        // // console.log('resolve', xml)
        let config = util.getConfig();
        let filepath;

        if (typeof(xml) === 'object' && xml.dir) {
            opath = xml;
            filepath = path.join(xml.dir, xml.base);
        } else {
            opath = path.parse(xml);
            filepath = xml;
        }
        let content = util.readFile(filepath);

        if (content === null) {
            util.error('打开文件失败: ' + filepath)
            return null;
        }
        if (content === '') {
            return null;
        }

        let startlen = content.indexOf('<script') + 7;
        if (startlen >= 7 && content.length >= 8) { // this is no scripts
            while(content[startlen++] !== '>') {
                // do nothing;
            }
            content = util.encode(content, startlen, content.indexOf('</script>') - 1);
        }
        // replace :attr to v-bind:attr
        /*content = content.replace(/<[\w-\_]*\s[^>]*>/ig, (tag) => {
            return tag.replace(/\s+:([\w-_]*)([\.\w]*)\s*=/ig, (attr, name, type) => { // replace :param.sync => v-bind:param.sync
                if (type === '.once' || type === '.sync') {
                }
                else
                    type = '.once';
                return ` v-bind:${name}${type}=`;
            }).replace(/\s+\@([\w-_]*)\s*=/ig, (attr, name) => { // replace @change => v-on:change
                return `v-on:${name}`;
            });
        })*/

        content = util.attrReplace(content);

        xml = this.createParser().parseFromString(content);
        const moduleId = util.genId(filepath);

        let rst = {
            moduleId: moduleId,
            style: [],
            template: {
                code: '',
                src: '',
                type: ''
            },
            script: {
                code: '',
                src: '',
                type: ''
            }
        };

        [].slice.call(xml.childNodes || []).forEach((child) => {
            const nodeName = child.nodeName;
            if (nodeName === 'style' || nodeName === 'template' || nodeName === 'script') {
                let rstTypeObj;

                if (nodeName === 'style') {
                    rstTypeObj = {code: ''};
                    rst[nodeName].push(rstTypeObj);
                } else {
                    rstTypeObj = rst[nodeName];
                }

                rstTypeObj.src = child.getAttribute('src');
                rstTypeObj.type = child.getAttribute('lang') || child.getAttribute('type');
                if (nodeName === 'style') {
                    // 针对于 style 增加是否包含 scoped 属性
                    rstTypeObj.scoped = child.getAttribute('scoped') ? true : false;
                }

                if (rstTypeObj.src) {
                    rstTypeObj.src = path.resolve(opath.dir, rstTypeObj.src);
                    rstTypeObj.link = true;
                } else {
                    rstTypeObj.link = false;
                }

                if (rstTypeObj.src && util.isFile(rstTypeObj.src)) {
                    const fileCode = util.readFile(rstTypeObj.src, 'utf-8');
                    if (fileCode === null) {
                        throw '打开文件失败: ' + rstTypeObj.src;
                    } else {
                        rstTypeObj.code += fileCode;
                    }
                } else {
                    [].slice.call(child.childNodes || []).forEach((c) => {
                        rstTypeObj.code += util.decode(c.toString());
                    });
                }

                if (!rstTypeObj.src)
                    rstTypeObj.src = path.join(opath.dir, opath.name + opath.ext);
	
				
            }
        });
        
        
        if (rst.style.length === 0){
        	rst.style.push({
				code: '',
				src: path.join(opath.dir, opath.name + opath.ext),
				type: 'sass',
				scoped: true,
				link: false
			})
		}
        
        //util.mergeWpy(rst);

        /*
        Use components instead
        if (rst.template.code) {
            rst.template.requires = this.resolveRelation(rst.template.code);
        }*/

        // default type
        rst.template.type = rst.template.type || 'wxml';
        rst.script.type = rst.script.type || 'babel';

        // get config
        (() => {
            let match = rst.script.code.match(/[\s\r\n]config\s*[=:][\s\r\n]*/);
            match = match ? match[0] : undefined;

            rst.config = match ? this.grabConfigFromScript(rst.script.code, rst.script.code.indexOf(match) + match.length) : false;
            try {
                if (rst.config) {
                    rst.config = new Function(`return ${rst.config}`)();
                }
            } catch (e) {
                util.output('错误', path.join(opath.dir, opath.base));
                util.error(`解析config出错，报错信息：${e}\r\n${rst.config}`);
            }
        })();
	
		
        // pre compile wxml
        (() => {
            if (rst.template.type !== 'wxml' && rst.template.type !== 'xml') {
                let compiler = loader.loadCompiler(rst.template.type);
                if (compiler && compiler.sync) {
                    if (rst.template.type === 'pug') { // fix indent for pug, https://github.com/wepyjs/wepy/issues/211
                        let indent = util.getIndent(rst.template.code);
                        if (indent.firstLineIndent) {
                            rst.template.code = util.fixIndent(rst.template.code, indent.firstLineIndent * -1, indent.char);
                        }
                    }
                    let compilerConfig = config.compilers[rst.template.type];

                    // xmldom replaceNode have some issues when parsing pug minify html, so if it's not set, then default to un-minify html.
                    if (compilerConfig.pretty === undefined) {
                        compilerConfig.pretty = true;
                    }

                    rst.template.code = compiler.sync(rst.template.code, config.compilers[rst.template.type] || {});
                    rst.template.type = 'wxml';
                }
            }
            if (rst.template.code) {
				rst.template.node = this.createParser().parseFromString(util.attrReplace(rst.template.code));
			}
        })();

        // get imports
        (() => {
        	
            let coms = {};
            rst.script.code.replace(/import\s*([\w\-\_]*)\s*from\s*['"]([\w\-\_\.\/]*)['"]/ig, (match, com, compath) => {
                coms[com] = compath
            });

            let match = rst.script.code.match(/[\s\r\n]components\s*[=:][\s\r\n]*/);
            match = match ? match[0] : undefined;
	
			rst.script.code = rst.script.code.replace(/import\s*([\w\-\_]*)\s*from\s*['"]([\w\-\_\.\/]*)['"]/ig, (match, com, compath) => {
			    let reg = new RegExp(cache.getExt(), 'g')
				match = match.replace(reg, '')
			    return match
			});
	
	
			rst.script.code = rst.script.code.replace(/\.weexComponent/ig, '')
            // // console.log(rst.script.code)

            rst.script.code = rst.script.code.replace(/require\(['"](.*?)(\.png|\.jpg)['"]\s*\)/ig, (match, path, ext)=> {
                return '"' + path + ext + '"'
            })

            let components = match ? this.grabConfigFromScript(rst.script.code, rst.script.code.indexOf(match) + match.length) : false;
            let vars = Object.keys(coms).map((com, i) => `var ${com} = "${coms[com]}";`).join('\r\n');
            try {
                if (components) {
                    components = components.replace(/\.weexComponent/ig, '');
                    rst.template.components = new Function(`${vars}\r\nreturn ${components}`)();
                } else {
                    rst.template.components = {};
                }
            } catch (e) {
                util.output('错误', path.join(opath.dir, opath.base));
                util.error(`解析components出错，报错信息：${e}\r\n${vars}\r\nreturn ${components}`);
            }
        })();
	
        /*
        	v-for  ---->  repeat
         */
		(() => {
			if (!rst.template.node)
				return;
			let arr = util.elemRecursion(rst.template.node.childNodes);
			arr.reverse().forEach( elem => {
				let vfor = elem.getAttribute('v-for');
				// console.log('vfor',vfor);
				
				let tmp;
				let t=false;
				vfor.replace(/\s*\(?\s*([^\s\(\)]*)\s*,\s*([^\s\(\)]*)\s*\)?\s*in\s*([^\s]*)/g,(match,item,index,items)=>{
					t=true;
					//util.Log('vfor',match,item,index,items);
					// elem.setAttribute('wx:for',`{{${items}}}`);
					// elem.setAttribute('wx:for-index',`{{${index}}}`);
					// elem.setAttribute('wx:for-item',`{{${item}}}`);
					// elem.removeAttribute('v-for');
					tmp = {
						for: `{{${items}}}`,
						item: item,
						index: index,
						key: index,
					}
					
					// console.log('vfor tmp=',tmp);
					
					let doc = new DOMImplementation().createDocument();
					let repeat = doc.createElement('repeat');
					repeat.setAttribute('for',tmp.for);
					repeat.setAttribute('item',tmp.item);
					repeat.setAttribute('index',tmp.index);
					repeat.setAttribute('key',tmp.key);
					
					elem.removeAttribute('v-for');
					
					
					let parentNode = elem.parentNode;
					
					let newElem = elem.cloneNode(true);
					repeat.appendChild(newElem);
					parentNode.replaceChild(repeat,elem);
					
					// let array = util.elemRecursion(newElem.childNodes);
					// // console.log('@@@ array.length=',array.length);
					// arr = arr.concat(array);
					// parentNode.appendChild(repeat);
				});
				
				if (!t){
					vfor.replace(/\s*\(?\s*([a-zA-Z$_][a-zA-Z0-9$_]*)\s*\)?\s*in\s*([a-zA-Z$_][a-zA-Z0-9$_]*)/g,(match,item,items)=>{
						
						//util.Log('vfor',match,item,items);
						// elem.setAttribute('wx:for',`{{${items}}}`);
						// elem.setAttribute('wx:for-index',`{{${index}}}`);
						// elem.setAttribute('wx:for-item',`{{${item}}}`);
						// elem.removeAttribute('v-for');
						tmp = {
							for: `{{${items}}}`,
							item: item,
							index: 'index',
							key: 'index',
						}
						
						let doc = new DOMImplementation().createDocument();
						let repeat = doc.createElement('repeat');
						repeat.setAttribute('for',tmp.for);
						repeat.setAttribute('item',tmp.item);
						repeat.setAttribute('index',tmp.index);
						repeat.setAttribute('key',tmp.key);
						
						elem.removeAttribute('v-for');
						
						
						let parentNode = elem.parentNode;
						repeat.appendChild(elem.cloneNode(true));
						parentNode.replaceChild(repeat,elem);
						// parentNode.appendChild(repeat);
					})
				}
				
				if (!tmp) {
					//util.Log('vfor=',vfor)
				}
			})
			rst.template.code = rst.template.node.toString();
			rst.template.node = this.createParser().parseFromString(util.attrReplace(rst.template.code));
			
		})();
		
		/*
			获取props data computed
		 */
		(() => {
			
			let props_match = rst.script.code.match(/[^$]props\s*[=:][\s\r\n]*/);
			props_match = props_match ? props_match[0] : undefined;
			let props = props_match ? this.grabConfigFromScript(rst.script.code, rst.script.code.indexOf(props_match) + props_match.length) : '';
			
			let data_match = rst.script.code.match(/[\s\r\n]*data\s*\(\)[\s\r\n]*/);
			data_match = data_match ? data_match[0] : undefined;
			let data = data_match ? this.grabConfigFromScript(rst.script.code, rst.script.code.indexOf(data_match) + data_match.length) : '';
			
			let computed_match = rst.script.code.match(/[\s\r\n]*computed\s*[=:][\s\r\n]*/);
			computed_match = computed_match ? computed_match[0] : undefined;
			let computed = computed_match ? this.grabConfigFromScript(rst.script.code, rst.script.code.indexOf(computed_match) + computed_match.length) : '';
			
			// console.log('xxx computed=',computed);

			try {
				if (props) {
					let obj = new Function(`return ${props}`)();
					rst.template.props = Object.keys(obj);
				} else {
					rst.template.props = [];
				}
			} catch (e) {
				util.output(`解析props错误${e}`, path.join(opath.dir, opath.base));
			}

			try {
				if (data) {
					//util.Log('data=',data);
					let return_match =  data.match(/return/);
					return_match =return_match ? return_match[0]:undefined;
					/*
					 	d = {
					 		a: 1,
					 		b: {
					 			a:1,
					 		},
					 		c: {
					 			m:1,
					 		}
					 	}
					 */
					let d = return_match ? this.grabConfigFromScript(data, data.indexOf(return_match)+return_match.length): '';
					
					
					const ast = acorn.parse('f='+d,{ sourceType : 'module'});
					let objs = [];
					acorn_walk.simple(ast, {
						ObjectExpression(node){
							objs.push(node);
						}
					});
					let data_node = objs[objs.length-1];
					let arr = [];
					let properties = data_node.properties;
					properties.forEach(node=>{
						arr.push(node.key.name);
					})
					
					rst.template.data = arr;
					//util.Log('rst.template.data=',rst.template.data);
				} else {
					rst.template.data = [];
				}
			} catch (e) {
				util.output(`解析data错误${e}`, path.join(opath.dir, opath.base));
			}

			try {
				if (computed) {
					let obj = new Function(`return ${computed}`)();
					rst.template.computed = Object.keys(obj);
				} else {
					rst.template.computed = [];
				}
			} catch (e) {
				util.output(`解析computed错误${e}`, path.join(opath.dir, opath.base));
			}
			
			
			
		})();
		
		/* 属性处理
		1. 处理 :attr="a>0?b:c"   ->
		:attr="weex_computed_xxx"
		 
		 computed:{
			 weex_computed_xxx () {
			 	return this.a>0?this.b:this.c;
			 }
		 }
		 
		 2. style="color:red"  -> style="display:flex;color:red"
		 
		 :style="{color:'red'}"  -> :style="{display:'flex',color:'red'}"
		 
		 3.require('../../../image/tag.png')
		 -> ../../../image/tag.png
		
		 */
		
		(() => {
		
			if (!rst.template.code) {
				return ;
			}
		
			rst.template.node = this.createParser().parseFromString(util.attrReplace(rst.template.code));
		
			// 修改属性值   :attr="a>0?b:c"   ->  :attr="weex_computed_xxx"
		
			let expComputedMap = {};
		
			util.getNodes(rst.template.node).map(item => {
			
			
				let node = item.node;
			
				let attrs = node.attributes;
			
				if(!attrs){
					return;
				}
				// //util.Log(node.getAttribute('v-bind.style.once'));
				// //util.Log(attrs);
				[].slice.call(attrs||[]).forEach(attr => {
				
					let k = attr.name;
					let v = attr.value.trim();
				
					
					if (v.trim() === '') {
						return
					}
					
					
					if (k==='style') {
						// v=`display:flex;`+v;
						v=v.replace(/([^r])px/g,(m1,m2)=>{
							
							return m2+'rpx';
						})
						node.setAttribute(k,v);
						// console.log('v=',v);
						return
					}
					
					if (k === 'v-if' || k === 'v-show') {
						node.setAttribute('wx:if', v);
						node.removeAttribute(k);
						k='wx:if';
						
					}
					
					if (k === 'v-else') {
						node.setAttribute('wx:else', v);
						node.removeAttribute('v-else');
						k='v-else';
					}
					// if (k === 'v-show') {
					// 	node.setAttribute('v-bind:hidden.once', `!(${v})`);
					// 	node.removeAttribute('v-show');
					// }
					
				
					if (k.match(/v-bind:(.*).once/) === null && k.match(/v-bind:(.*).sync/) === null
					&& k !== 'wx:if' ) {
						return
					}
				
					if (k.indexOf('class') !== -1 || k.indexOf('style') !== -1) {
						// return
					}
					
					if (k.indexOf('style') !== -1) {
						// v = v.replace(/{/,match=>{
						// 	match=match+`display:'flex',`
						// 	return match;
						// })
						
						// console.log('k,v=',k,v);
						v=v.replace(/([^r])px/g,(m1,m2)=>{

							return m2+'rpx';
						})
						node.setAttribute(k,v);
						// return
					}
					
					
					// console.log('rst.template.data=',rst.template.data);
					
					if (rst.template.props.indexOf(v)!==-1
						||rst.template.data.indexOf(v)!==-1
						||rst.template.computed.indexOf(v)!==-1){
						// 如果value直接引用computed、data或者props，则是变量，不做转化
						return
					}
					
					// 引用图片
					let require_match = v.match(/require\((.*?)\)/);
					if (require_match){
						
						let str = require_match[1];
						let md5 = crypto.createHash('md5');
						let md5_str = md5.update(str).digest('hex');
						let computed_name = 'weex_computed_' + md5_str;
						expComputedMap[computed_name] = str;
						node.setAttribute(k, computed_name);
						return;
					}
					try {
						let exps = [];
						let ast = acorn.parse('f='+v, { sourceType : 'module'});
					
						let f = false;
						acorn_walk.simple(ast, {
							Expression(node) {
								exps.push(node)
							},
							Identifier(node) {
								
								
								// if (opath.base.indexOf('index.vue')!==-1) {
								// 	// console.log('--f-- node.name',node.name,item.keyword,item.infor);
								// }
								if (item.infor) {
									// console.log('### item.keyword',item.keyword,node.name);
									item.keyword.forEach(key=>{
										if (node.name.indexOf(key)){
											f=true
										}
									})
									// if (item.keyword.indexOf(node.name)===-1) {
									// 	node.name = 'this.' + node.name;
									// } else {
									// 	f = true;
									// }
									
								}
								
								if (!f) {
									node.name = 'this.' + node.name;
								}
								
								// if (opath.base.indexOf('index.vue')!==-1) {
								// 	// console.log('--f-- node.name',node.name);
								// }
							}
						});
					
						// if (opath.base.indexOf('index.vue')!==-1) {
						// 	// console.log('--f--',f);
						// }
						
					
						let last = exps[exps.length-2];
						let str = escodegen.generate(last,{format: {compact:true}});
						
						// console.log('str=',str);
						let md5 = crypto.createHash('md5');
						let md5_str = md5.update(str).digest('hex');
						
						let computed_name = 'weex_computed_' + md5_str;
						
						
						
						if (opath.base.indexOf('index.vue')!==-1) {
							//util.Log('-exp-',k,v,str);
						}
						
						
						if (!f) {
							
							expComputedMap[computed_name] = str;
							node.setAttribute(k, computed_name);
						}
					
					
					} catch (e) {
						util.error(`编译模板内嵌表达式${v}出错` + e + e.stack)
					}
				
				
				})
			});
		
			rst.template.code = rst.template.node.toString();
		
			
			if (rst.script.code.indexOf('computed') === -1) {
				
				//util.Log('no computed',rst.script.code);
				
				rst.script.code = rst.script.code.replace(/data\s*\(\s*\)\s*{/g,(match)=>{
					
					let s=`
					computed: {
					},
					`
					return s + match;
					
				});
				//util.Log('no computed',rst.script.code);
			
			}
			

			// 新增 computed
			rst.script.code = rst.script.code.replace(/computed\s*[=|:]\s*{/g,(match)=>{
			
				let s = '';
				Object.keys(expComputedMap).forEach(key=>{
					s = s + `
                    ${key} () {
                        return ${expComputedMap[key]}
                    },
                    `;
				})
				return match + s;
			
			})
			

		
		})();
		
		// //util.Log('rst.script.code=',rst.script.code);
	
		// get $props and $events
        (() => {
            if (!rst.template.node)
                return;
            let coms = Object.keys(rst.template.components);
            let elems = [];
            let props = {};
            let events = {};
            let refs = {};

            let calculatedComs = [];

            
            
            
            // Get components in repeat
            util.elemToArray(rst.template.node.getElementsByTagName('repeat')).forEach(repeat => {
                elems = [];
                if (repeat.getAttribute('for')) {
                    let tmp = {
                        for: repeat.getAttribute('for').replace(/^\s*\{\{\s*/, '').replace(/\s*\}\}\s*$/, ''),
                        item: repeat.getAttribute('item') || 'item',
                        index: repeat.getAttribute('index') || 'index',
                        key: repeat.getAttribute('key') || 'key',
                    }
                    coms.concat('component').forEach((com) => {
                        elems = elems.concat(util.elemToArray(repeat.getElementsByTagName(com)));
                    });

                    elems.forEach((elem) => {
                        calculatedComs.push(elem);
                        let comid = util.getComId(elem);
                        [].slice.call(elem.attributes || []).forEach((attr) => {
                            if (attr.name !== 'xmlns:v-bind=""') {
                                if (attr.name !== 'id' && attr.name !== 'path') {
                                    if (/v-on:/.test(attr.name)) { // v-on:fn user custom event
                                        if (!events[comid])
                                            events[comid] = {};
                                        events[comid][attr.name] = attr.value;
                                    } else {
                                        if (!props[comid])
                                            props[comid] = {};
                                        if (['hidden', 'wx:if', 'wx:elif', 'wx:else'].indexOf(attr.name) === -1) {
                                            props[comid][attr.name] = Object.assign({}, tmp);
                                            props[comid][attr.name]['value'] = attr.value;
                                        }
                                    }
                                }
                            }
                        });
                    });
                }
            });

            elems = [];
            coms.concat('component').forEach((com) => {
                elems = elems.concat(util.elemToArray(rst.template.node.getElementsByTagName(com)));
            });
            // //util.Log('elems',elems)
			// //util.Log('props',props)

            elems.forEach((elem) => {
                // ignore the components calculated in repeat.
				// //util.Log('elem.attributes', elem.attributes)
                if (calculatedComs.indexOf(elem) === -1) {
                    let comid = util.getComId(elem);
                    [].slice.call(elem.attributes || []).forEach((attr) => {
                    	
                        if (attr.name !== 'id' && attr.name !== 'path') {
                            if (/v-on:/.test(attr.name)) { // v-on:fn user custom event
                                if (!events[comid])
                                    events[comid] = {};
                                events[comid][attr.name] = attr.value;
                            } else {
                                if (!props[comid])
                                    props[comid] = {};
                                if (['hidden', 'wx:if', 'wx:elif', 'wx:else'].indexOf(attr.name) === -1) {
                                    props[comid][attr.name] = attr.value;
                                }
                            }
                        }
                        if (attr.name === 'ref') {
                        	let ref = attr.value;
                        	refs[ref] = comid;
						}
                    });
                }
            });
			// //util.Log('props',props)
            if (Object.keys(props).length) {
                rst.script.code =rst.script.code.replace(/[\s\r\n]components\s*([=:])[\s\r\n]*/, (match, operator) => {
                    
                    return `$props ${operator} ${JSON.stringify(props)}${operator==='='?';':','}\r\n
                    $events ${operator} ${JSON.stringify(events)}${operator==='='?';':','}\r\n
                    refs ${operator} ${JSON.stringify(refs)}${operator==='='?';':','}\r\n
                    ${match}`;
                });
            }
        })();
        
        /*
         	处理 :style="mStyle"   ->  style="{{mStyle_weex_style}}"
         	
         	方便后面运行时处理mStyle
          */
        (() => {
			if (!rst.template.node)
				return;
			rst.template.code = rst.template.node.toString();
			
			let mStyles = [];
			
			const m = /v-bind:(.*).(once)/.exec(rst.template.code);

			rst.template.code = rst.template.code.replace(/v-bind:style.once*\s*=\s*\"\s*([a-zA-Z$_][a-zA-Z0-9$_]*)\s*\"/g,
                (match, value)=>{
			    
			        //util.Log('style=',match,'value=',value);
			        mStyles.push(value);
					let s = `v-bind:style.once="${value}_weex_style"`;
					return s;
            });
	
			try {
				const ast = acorn.parse(rst.script.code, {
					sourceType : 'module',
					ecmaVersion: 8,
					plugins:{asyncawait:true}
				});
				acorn_walk.simple(ast, {
					MemberExpression(node) {
					    let v = node.property;
					    if (mStyles.indexOf(v.name) !== -1) {
					    	//util.Log('node=',v.name);
					        v.name = v.name + '_weex_style';
                        }
                    },
					Property(node) {
					    if (mStyles.indexOf(node.key.name) !== -1){
							node.key.name = node.key.name + '_weex_style';
						}
                    }
                });
				rst.script.code = escodegen.generate(ast, {format: {compact:true}});
			} catch (e) {
				util.error('编译Style计算属性表达式出错:' + e + e.stack)
			}
			// //util.Log('rst.script.code3=',rst.script.code);

        
        })();
	
		if (rst.style.some(v => v.scoped) && rst.template.code) {
           // 存在有 scoped 部分就需要 更新 template.code
            var node = this.createParser().parseFromString(rst.template.code);
            walkNode(node, rst.moduleId);
            // 更新 template.code
            rst.template.code = node.toString();
        }
        this._cacheWpys[filepath] = rst;
        
        return this._cacheWpys[filepath];
        // return rst;
    },

    remove (opath, ext) {
        let src = cache.getSrc();
        let dist = cache.getDist();
        ext = ext || opath.substr(1);
        let target = util.getDistPath(opath, ext, src, dist);
        if (util.isFile(target)) {
            //util.Log('配置: ' + path.relative(util.currentDir, target), '删除');
            fs.unlinkSync(target);
        }
    },

    lint (filepath) {
        eslint(filepath);
    },

    compile (opath) {
        // // console.log('compile', opath);
        let filepath = path.join(opath.dir, opath.base);
        let src = cache.getSrc();
        let dist = cache.getDist();
        let wpyExt = cache.getExt();
        let pages = cache.getPages();

        let type = '';
        
        let relative = path.relative(util.currentDir, filepath);

        if (filepath === path.join(util.currentDir, src, 'app' + wpyExt)) {
            type = 'app';
            //util.Log('入口: ' + relative, '编译');
        } else if (pages.indexOf(relative) > -1) {
            type = 'page';
            //util.Log('页面: ' + relative, '编译');
        } else if (relative.indexOf(path.sep + 'components' + path.sep) > -1){
            type = 'component';
            //util.Log('组件: ' + relative, '编译');
        } else {
            //util.Log('Other: ' + relative, '编译');
        }
        
        

        // Ignore all node modules, avoid eslint warning.
        // https://github.com/eslint/eslint/blob/75b7ba4113db4d9bc1661a4600c8728cf3bfbf2b/lib/cli-engine.js#L325
        if (!opath.npm) {
            this.lint(filepath);
        }

        let wpy = this.resolveWpy(opath);

        if (!wpy) {
            return;
        }

        if (type === 'app') { // 第一个编译
            cache.setPages(wpy.config.pages.map(v => path.join(src, v + wpyExt)));

            // scoped 设置无效
            wpy.style.forEach(rst => rst.scoped = false);

            // 无template
            delete wpy.template;

        } else if (type === 'component') {
            delete wpy.config;
        }

        if (wpy.config) {
            cConfig.compile(wpy.config, opath);
        } else {
            this.remove(opath, 'json');
        }

        if (wpy.style.length || (wpy.template && Object.keys(wpy.template.components).length)) {
            let requires = [];
            let k, tmp;
            if (wpy.template) {
                for (k in wpy.template.components) {
                    tmp = wpy.template.components[k];
                    if (!tmp) {
                        util.error("文件" + opath.base + ' 引用组件:' + k + '没有路径')
                    }
                    if (tmp.indexOf('.') === -1) {
                        requires.push(tmp); // 第三方组件
                    } else {
                        requires.push(path.join(opath.dir, wpy.template.components[k]));
                    }
                }
            }
            try {
                cStyle.compile(wpy.style, requires, opath, wpy.moduleId);
            } catch (e) {
                util.error(e);
                process.exit(0);
            }
        } else {
            this.remove(opath, 'wxss');
        }
        
        if (wpy.template && wpy.template.code && type !== 'component') { // App 和 Component 不编译 wxml
            //cTemplate.compile(wpy.template.type, wpy.template.code, opath);
            wpy.template.npm = opath.npm;
            cTemplate.compile(wpy);
        }

        if (wpy.script.code) {
            cScript.compile(wpy.script.type, wpy.script.code, type, opath);
        }
        // // console.log("compile-wpy.compile finish")
    }
};

function walkNode (node, moduleId) {
    if (node.childNodes) {
        [].slice.call(node.childNodes || []).forEach((child) => {
            if (child.tagName) {
                // 是标签 则增加class
                const cls = child.getAttribute('class');
                child.setAttribute('class', ('wx-ct ' +cls + ' ' + moduleId).trim());
                walkNode(child, moduleId);
            }
        });
    }
}
