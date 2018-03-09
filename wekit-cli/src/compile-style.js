import path from 'path';
import fs from 'fs';
import util from './util';
import cache from './cache';

import loader from './loader';
import resolve from './resolve';
import scopedHandler from './style-compiler/scoped';

const LANG_MAP = {
    'less': '.less',
    'sass': '.sass;.scss'
};

export default {
	transforCss (content) {
		
		return content.replace(/{((.|\n)*?)}/g, function (match, css) {
			match=match.replace(/([0-9]+)px/g, function (m, n) {
				return n + 'rpx'
			})
			css=css.replace(/([0-9]+)px/g, function (m, n) {
				return n + 'rpx'
			})
			return match
		})
    },
    
    appendBaseCss (content) {
	    content = content + `
	    .wx-ct {
	        display:flex;
	        flex-direction:column;
	        box-sizing:border-box;
	        position:relative;
	    }
	    `
        return content;
    },
    compile (styles, requires, opath, moduleId) {
		// console.log('style compile styles=',styles);
		// console.log('style compile requires=',requires);
		// console.log('style compile opath=',opath?opath.base:opath);
        let config = util.getConfig();
        let src = cache.getSrc();
        let dist = cache.getDist();
        let ext = cache.getExt();
        let isNPM = false;

        let outputExt = config.output === 'ant' ? 'acss' : 'wxss';

        if (typeof styles === 'string') {
            // .compile('less', opath) 这种形式
            opath = requires;
            requires = [];
            moduleId = '';
            styles = [{
                type: styles,
                scoped: false,
                code: util.readFile(path.join(opath.dir, opath.base)) || ''
            }];
        }
        let allPromises = [];

        // styles can be an empty array
        styles.forEach((style) => {
            let lang = style.type || 'css';
            let content = style.code;
            
            // content = this.transforCss(content)
            
            const scoped = style.scoped;
            let filepath = style.src ? style.src : path.join(opath.dir, opath.base);


            let options = Object.assign({}, config.compilers[lang] || {});

            if (lang === 'sass' || lang === 'scss') {
                let indentedSyntax = false;
                options = Object.assign({}, config.compilers.sass || {});
                
                if (lang === 'sass') { // sass is using indented syntax
                    indentedSyntax = true;
                }
                if (options.indentedSyntax === undefined) {
                    options.indentedSyntax = indentedSyntax;
                }
                lang = 'sass';
            }

            let compiler = loader.loadCompiler(lang);

            if (!compiler) {
                throw `未发现相关 ${lang} 编译器配置，请检查wekit.config.js文件。`
            }

            // console.log("编译:", lang, content, filepath)
            // console.log('compiler1=',content,options,filepath);
            const p = compiler(content, options || {}, filepath).then((css) => {
                // console.log('css=', css)
                // console.log("编译Sucess:", lang, content, filepath,css)
                // 处理 scoped
				// console.log('compiler2=',css);
                if (scoped) {
                    // 存在有 scoped 的 style
                    return scopedHandler(moduleId, css).then((cssContent) => {
                        return cssContent;
                    });
                } else {
                    return css;
                }
            }).catch(e => {
                console.log("编译Error:", lang, content, filepath)
                console.log(e)
            })
            allPromises.push(p);
        });

        // 父组件没有写style标签，但是有子组件的。
        if (requires.length > 0 && styles.length === 0) {
            allPromises = [Promise.resolve('')];
        }
        // console.log('allPromises=',opath.base,allPromises);
        Promise.all(allPromises).then((rets) => {
            let allContent = rets.join('');
            // console.log('allContent=',opath.base,allContent,requires);
            if (requires && requires.length) {
                requires.forEach((r) => {
                    // console.log('r=',r);
                    let comsrc = null;
                    if (path.isAbsolute(r)) {
                        if (path.extname(r) === '' && util.isFile(r + ext)) {
                            comsrc = r + ext;
                        } else {
                            comsrc = util.findComponent(r)
                        }
                    } else {
                        let lib = resolve.resolveAlias(r);
                        if (path.isAbsolute(lib)) {
                            comsrc = lib;
                            if (path.extname(comsrc) === '') {
                                comsrc += '.' + outputExt;
                            }
                        } else {
                            let o = resolve.getMainFile(r);
                            comsrc = path.join(o.dir, o.file);
                            let newOpath = path.parse(comsrc);
                            newOpath.npm = {
                                lib: r,
                                dir: o.dir,
                                file: o.file,
                                modulePath: o.modulePath
                            };
                            comsrc = util.getDistPath(newOpath);
                            comsrc = comsrc.replace(ext, '.' + outputExt).replace(`${path.sep}${dist}${path.sep}`, `${path.sep}${src}${path.sep}`);
                        }
                        isNPM = true;
                    }
					// console.log('r=',r,comsrc);
                    if (!comsrc) {
                        util.error('找不到组件：' + r + `\n请尝试使用 npm install ${r} 安装`, '错误');
                    } else {
                        let relative = path.relative(opath.dir + path.sep + opath.base, comsrc);
                        let code = util.readFile(comsrc);
                        
						// if (isNPM || /<style/.test(code)) {
                            if (/\.wpy$/.test(relative)) { // wpy 第三方组件
                                relative = relative.replace(/\.wpy$/, '.' + outputExt);
                            }
                            relative = relative.replace(ext, '.' + outputExt).replace(/\\/ig, '/').replace('../', './');
							// relative = relative.replace(/\/[^\/]*?wxss/g, function (match) {
                             //    return '/index.wxss'
							// });
                            allContent = '@import "' + relative + '";\n' + allContent;
                        // }
                    }
                });
            }
			// console.log('allContent2=',opath.base,allContent);
            let target = util.getDistPath(opath, outputExt, src, dist);
            
            // console.log('target=',target);
	
	
			allContent = this.transforCss(allContent)
	
			allContent = this.appendBaseCss(allContent)
            
            let plg = new loader.PluginHelper(config.plugins, {
                type: 'css',
                code: allContent,
                file: target,
                output (p) {
                    util.output(p.action, p.file);
                },
                done (rst) {
                    // console.log('done=',rst);
                    util.output('写入', rst.file);
                    util.writeFile(target, rst.code);
                }
            });
        }).catch((e) => {
            util.error('compile-style.js:'+ e + e.stack);
        });
    }
}