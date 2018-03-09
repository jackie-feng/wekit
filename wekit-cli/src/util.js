
import colors from 'colors/safe';
import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import { exec } from 'child_process';
import hash from 'hash-sum';
import cache from './cache';
import resolve from './resolve';
import escodegen from 'escodegen'
let acorn = require('acorn');
require('acorn-es7')(acorn);
require('acorn-es7-plugin')(acorn);
const acorn_walk = require('acorn/dist/walk')

colors.enabled = true;

colors.setTheme({
  /*SILLY: 'rainbow',
  INPUT: 'grey',
  VERBOSE: 'cyan',
  PROMPT: 'grey',
  INFO: 'green',
  DATA: 'grey',
  HELP: 'cyan',
  WARN: 'yellow',
  DEBUG: 'blue',
  ERROR: 'red',*/
  'info': 'grey',
  '变更': 'bgYellow',
  '删除': 'bgMagenta',
  '执行': 'blue',
  '压缩': 'blue',
  '信息': 'grey',
  '完成': 'green',
  '创建': 'green',
  '监听': 'magenta',
  '错误': 'red',
  '测试': 'red',
  '拷贝': 'yellow',
  '编译': 'blue',
  '写入': 'green'
});

let ID_CACHE = {};
const utils = {

  Log(...msg) {
    // console.log(colors.blue('--info-- '), ...msg)
  },

  seqPromise(promises) {
    return new Promise((resolve, reject) => {

      let count = 0;
      let results = [];

      const iterateeFunc = (previousPromise, currentPromise) => {
        return previousPromise
          .then(function (result) {
            if (count++ !== 0) results = results.concat(result);
            return currentPromise(result, results, count);
          })
          .catch((err) => {
            return reject(err);
          });
      }

      promises = promises.concat(() => Promise.resolve());

      promises.reduce(iterateeFunc, Promise.resolve(false))
        .then(function (res) {
          resolve(results);
        });

    });
  },


  /*
  小程序内表达式和weex一致
  :prop="a"   -> prop="{{a}}"
  :prop="a&&b>0"  -> prop="{{a&&b>0}}" 
  :prop="a?b:c"  ->  prop="{{a?b:c}}"
  关于对象绑定
  :prop="{key:value}"   ->  prop="{{key:value}}"

  关于style绑定
  小程序不支持style的对象绑定
  :style="{fontSize:value}"  -> style="font-size:{{value}}"
   */
  parseStyleExp(exp, prefix = '') {
    if (prefix && prefix[0] !== '$') {
      prefix = '$' + prefix + '$'
    }
    try {
      function doreplace(exp) {
        const ast = acorn.parse(exp)
        let exps = [];
        acorn_walk.simple(ast, {
          Expression(node) {
            // utils.Log('Expression',escodegen.generate(node,{format: {compact:true}}));
          },
          Identifier(node) {
            // node.name =  '{{' + prefix + node.name + '}}'
            node.name = prefix + node.name
          },
          Punctuator(node) {
            if (node.value === ',') {
              node.value = ';'
            }
          },
          ObjectExpression(node) {
            exps.push(node);
          },
          Property(node) {
          }
        })
        let node = exps[exps.length - 1];


        let s = ''
        node.properties.forEach(property => {
          let key = escodegen.generate(property.key, { format: { compact: true } });
          let value = escodegen.generate(property.value, { format: { compact: true } });
          key = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          utils.Log('parseStyleExp key=', key);
          s = s + key + ': {{' + value + '}};';
        })
        return s;
        // return ast
      }

      if (exp.match(/^\s*{/)) {
        //like {width: variable, ...}
        //change object expression to assigenment expression
        //so that can be parsed
        exp = 'f=' + exp
        // const ast = doreplace(exp)
        //strip assignement part
        // let r = escodegen.generate(ast.body[0].expression.right, {format: {compact:true}})

        let s = doreplace(exp);
        return s
      } else {
        return this.parseExp(exp, prefix)
      }
    } catch (e) {
      utils.error(`编译模板中表达式${exp}出错：` + e + e.stack)
    }
  },

  testExp(exp) {
    try {
      var ast = acorn.parse(exp, {
        sourceType: 'module',
        ecmaVersion: 8,
        plugins: { asyncawait: true, es7: true }
      });

      let exps = [];

      acorn_walk.simple(ast, {
        Expression(node) {
          utils.Log('Expression', escodegen.generate(node, { format: { compact: true } }));

        },
        Literal(node) {
          utils.Log('Literal', escodegen.generate(node, { format: { compact: true } }));
          // utils.Log('Literal',node);
        },
        Identifier(node) {
          utils.Log('Identifier', escodegen.generate(node, { format: { compact: true } }));
          // utils.Log('Identifier',node);
          // node.name = 'this.' + node.name;
        },
        LabeledStatement(node) {
          utils.Log('LabeledStatement', escodegen.generate(node, { format: { compact: true } }));
        },
        Functions(node) {
          utils.Log('Functions', escodegen.generate(node, { format: { compact: true } }));
        },
        ObjectExpression(node) {
          utils.Log('ObjectExpression', escodegen.generate(node, { format: { compact: true } }));
          // utils.Log('ObjectExpression',node);
          // utils.Log(node.properties[0]);
          // utils.Log(node.properties[1]);
          exps.push(node);
        },
        Property(node) {
          utils.Log('Property', escodegen.generate(node, { format: { compact: true } }));
          utils.Log('Property', node);
          // let v = node.value;
          // v.
        },
        MemberExpression(node) {
          // let v = node.property;
          utils.Log('MemberExpression', escodegen.generate(node, { format: { compact: true } }));
          // utils.Log('MemberExpression',node);
          //
          // utils.Log('MemberExpression',v);
          // v.name = v.name+'_weex_style';
        },
        Pattern(node) {
          utils.Log('Pattern', escodegen.generate(node, { format: { compact: true } }));
        }
      });
      let last = exps[exps.length - 1];
      // let arr = [];
      // last.properties.forEach(node=>{
      //     arr.push(node.key.name);
      // })
      // utils.Log('arr=',arr)

      return escodegen.generate(last, { format: { compact: true } });

    } catch (e) {
      utils.error(`编译模板中表达式${exp}出错：` + e + e.stack)
    }
  },

  parseExp(exp, prefix = '') {
    try {
      if (prefix && prefix[0] !== '$') {
        prefix = '$' + prefix + '$'
      }
      function doreplace(exp) {
        const ast = acorn.parse(exp)
        acorn_walk.simple(ast, {
          Identifier(node) {
            node.name = prefix + node.name
          }
        })
        return ast
      }

      if (exp.match(/^\s*{/)) {
        //like {width: variable, ...}
        //change object expression to assigenment expression
        //so that can be parsed
        exp = 'f=' + exp
        const ast = doreplace(exp)
        //strip assignement part
        const r = escodegen.generate(ast.body[0].expression.right, { format: { compact: true } })
        return '{' + r.replace(';', '') + '}'
      } else {
        //like variable | expression
        const ast = doreplace(exp)
        const r = escodegen.generate(ast, { format: { compact: true } })
        return "{{" + r.replace(';', '') + "}}"
      }
    } catch (e) {
      utils.error(`编译模板中表达式${exp}出错：` + e + e.stack)
    }
  },

  exec(cmd, quite) {
    return new Promise((resolve, reject) => {
      let fcmd = exec(cmd, (err, stdout, stderr) => {
        if (err) { reject(err); }
        else { resolve(stdout, stderr); }
      });
      fcmd.stdout.on('data', (chunk) => {
        !quite && process.stdout.write(chunk);
      });
      fcmd.stderr.on('data', (chunk) => {
        !quite && process.stdout.write(chunk);
      });
    });
  },
  timeoutExec(sec, cmd, quite) {
    let timeout = new Promise(function (resolve, reject) {
      setTimeout(() => {
        reject('timeout');
      }, sec * 1000);
    });
    let task = this.exec(cmd, quite);
    return Promise.race([timeout, task]);
  },
  elemToArray(elems) {
    let rst = [];
    for (let i = 0, len = elems.$$length; i < len; i++) {
      rst.push(elems[i]);
    }
    return rst;
  },

  elemRecursion(node) {
    // this.Log('elemRecursion',Object.keys(node), typeof node);
    let arr = [];
    [].slice.call(node || []).forEach(child => {
      // this.Log('foreach',child.nodeName)
      if (child.nodeName !== '#text' && child.nodeName !== '#comment') {
        if (child.parentNode) {

        }
        if (child.getAttribute('v-for')) {
          arr.push(child)
        }
        arr = arr.concat(this.elemRecursion(child.childNodes))
      }
    });
    return arr;
  },

  getNodes(node, infor = false, keyword = []) {
    let arr = [];
    [].slice.call(node.childNodes || []).forEach(child => {
      if (child.nodeName !== '#text' && child.nodeName !== '#comment') {

        if (infor) {
          arr.push({
            node: child,
            infor: true,
            keyword: keyword
          });
        } else {
          arr.push({
            node: child,
            infor: false
          });
        }
        let f = false;
        if (child.getAttribute('for')) {
          f = true;
          let item = child.getAttribute('item');
          let index = child.getAttribute('index');
          let key = child.getAttribute('key');
          if (item && item !== '') {
            keyword.push(item)
          }
          if (index && index !== '') {
            keyword.push(index)
          }
          if (key && key !== '') {
            keyword.push(key)
          }
        }
        arr = arr.concat(this.getNodes(child, infor || f, keyword));
      }
    });
    return arr;
  },

  getComId(elem) {
    let tagName = elem.nodeName;
    let path = elem.getAttribute('path');
    let id = elem.getAttribute('id');
    if (tagName !== 'component')
      return tagName;
    if (id)
      return id;
    if (path && !id)
      return path;
  },
  getComPath(elem) {
    return elem.getAttribute('path') || this.getComId(elem);
  },
  findComponentInTemplate(com, template) {
    if (typeof (com) !== 'string') {
      com = this.getComId(com);
    }
    let definePath = template.components[com];
    definePath = definePath.indexOf('.') === -1 ? definePath : path.resolve(template.src, '..' + path.sep + definePath)
    return this.findComponent(definePath, true);
  },

  oCompRealPath(com) {
    // console.log('oCompRealPath:', com)
    var src = ''
    if (this.isFile(com)) {
      var txt = this.readFile(com)
      var matches = /register\(require\s*\(\s*['"](.*)['"]\s*\)/.exec(txt)
      if (matches && matches[1]) {
        src = path.resolve(path.dirname(com), matches[1])
      }
    } else if (this.isFile(com + '/index.js')) {
      var txt = this.readFile(com + '/index.js')
      var matches = /register\(require\s*\(\s*['"](.*)['"]\s*\)/.exec(txt)
      if (matches && matches[1]) {
        src = path.resolve(com, matches[1])
      }
    } else if (this.isFile(com + '.js')) {
      var txt = this.readFile(com + '.js')
      var matches = /register\(require\s*\(\s*['"](.*)['"]\s*\)/.exec(txt)
      if (matches && matches[1]) {
        src = path.resolve(path.dirname(com), matches[1])
      }
    }
    return src
  },

  findComponent(com) {
    let wpyExt = cache.getExt();

    let src = '';
    if (com.indexOf(path.sep) !== -1) {
      if (com.match(wpyExt + '$')) {
        src = com
      } else if (this.isFile(com + wpyExt)) {
        src = com + wpyExt;
      } else if (this.isFile(com + '/index.js')) {
        var txt = this.readFile(com + '/index.js')
        var matches = /register\(require\s*\(\s*['"](.*)['"]\s*\)/.exec(txt)
        if (matches && matches[1]) {
          src = path.resolve(com, matches[1])
        }
      } else if (this.isFile(com + '.js')) {
        var txt = this.readFile(com + '.js')
        var matches = /register\(require\s*\(\s*['"](.*)['"]\s*\)/.exec(txt)
        if (matches && matches[1]) {
          src = path.resolve(path.dirname(com), matches[1])
        }
      }
    } else {
      console.log('com else', com)
      let o = resolve.getMainFile(com);
      console.log(o)
      if (o) {
        src = path.join(o.dir, o.file);
      } else {
        let comPath = path.join(this.currentDir, cache.getSrc(), 'components', com);
        if (this.isFile(comPath + wpyExt)) {
          src = comPath + wpyExt;
        } else if (this.isFile(comPath + '/index' + wpyExt)) {
          src = comPath + '/index' + wpyExt;
        } else if (this.isFile(comPath + '/' + com + wpyExt)) {
          src = comPath + '/' + com + wpyExt;
        }
      }
    }
    return src;
  },

  currentDir: process.cwd(),
  cliDir: __dirname,

  isFunction(fn) {
    return typeof (fn) === 'function';
  },
  isString(obj) {
    return toString.call(obj) === '[object String]';
  },
  isObject(obj) {
    return toString.call(obj) === '[object Object]';
  },
  isNumber(obj) {
    return toString.call(obj) === '[object Number]';
  },
  isBoolean(obj) {
    return toString.call(obj) === '[object Boolean]';
  },
  isArray(obj) {
    return Array.isArray(obj);
  },
  isFile(p) {
    p = (typeof (p) === 'object') ? path.join(p.dir, p.base) : p;
    if (!fs.existsSync(p)) {
      return false;
    }
    return fs.statSync(p).isFile();
  },
  isDir(p) {
    if (!fs.existsSync(p)) {
      return false;
    }
    return fs.statSync(p).isDirectory();
  },
  /**
  * Hyphenate a camelCase string.
  */
  hyphenate(str) {
    return str
      .replace(/([^-])([A-Z])/g, '$1-$2')
      .replace(/([^-])([A-Z])/g, '$1-$2')
      .toLowerCase();
  },
  /**
   * Camelize a hyphen-delimited string.
   */
  camelize(str) {
    return str.replace(/-(\w)/g, (_, c) => c ? c.toUpperCase() : '');
  },
  /**
   * xml dom 对 TEXT_NODE 和 ATTRIBUTE_NODE 进行转义。
   */
  decode(content) {
    let pmap = ['<', '&', '"'];
    let amap = ['&lt;', '&amp;', '&quot;'];
    let reg = new RegExp(`(${amap[0]}|${amap[1]}|${amap[2]})`, 'ig');
    return content.replace(reg, (match, m) => {
      return pmap[amap.indexOf(m)];
    });
  },
  encode(content, start, end) {
    start = start || 0;
    end = end || content.length;

    let buffer = [];
    let pmap = ['<', '&', '"'];
    let amap = ['&lt;', '&amp;', '&quot;'];

    let i = 0, c;
    for (let i = 0, len = content.length; i < len; i++) {
      if (i < start || i > end) {
        buffer.push(content[i]);
      } else {
        c = pmap.indexOf(content[i]);
        buffer.push(c === -1 ? content[i] : amap[c]);
      }
    }
    return buffer.join('');
  },
  /**
   * xml replace
   */
  attrReplace(content) {
    const config = utils.getConfig();
    const knownTags = [
      // 视图容器
      'view',
      'scroll-view',
      'swiper',
      'swiper-item',

      // 基础内容
      'icon',
      'text',
      'progress',

      // 表单组件
      'button',
      'checkbox-group',
      'checkbox',
      'form',
      'input',
      'label',
      'picker',
      'picker-view',
      'picker-view-column',
      'radio-group',
      'radio',
      'slider',
      'switch',
      'textarea',

      // 导航
      'navigator',

      // 媒体组件
      'audio',
      'image',
      'video',

      // 地图
      'map',

      // 画布
      'canvas',

      // 客服会话
      'contact-button'
    ];
    const configTags = config.knownTags;
    if (configTags && Array.isArray(configTags)) {
      // 增加可配置的 knownTags
      // 以防止由于小程序升级 上边的默认tag不完全导致的问题
      // 如果说小程序升级的话 在 wepy 没升级的情况下
      // 用户可以通过临时加入 knownTags 的方法兼容
      knownTags.push.apply(knownTags, configTags);
    }
    // Exp error when using this code: <input focus wx:if="{{test >
    if (config.output === 'ant') {
      content = content.replace(/\s+wx\:(\w+)/ig, (match, name) => {
        return ' a:' + name;
      });
    }
    return content.replace(/<([\w-]+)\s*[\s\S]*?(\/|<\/[\w-]+)>/ig, (tag, tagName) => {
      tagName = tagName.toLowerCase();
      return tag.replace(/\s+:([\w-_]*)([\.\w]*)\s*=/ig, (attr, name, type) => { // replace :param.sync => v-bind:param.sync
        if (type === '.once' || type === '.sync') {
        }
        else
          type = '.once';
        return ` v-bind:${name}${type}=`;
      }).replace(/\s+\@([\w-_]*)\s*=/ig, (attr, name) => { // replace @change => v-on:change

        let eventMap = {
          click: 'tap',
          focus: 'focus',
          blur: 'blur',
          return: 'confirm',
          input: 'input',
          change: 'change',
          scroll: 'scroll',
          loadmore: 'loadmore',
          touchstart: 'touchstart',
          touchmove:'touchmove',
          touchend:'touchend',
          touchcancel:'touchcancel'
        }
        let prefix;

        if (!eventMap[name]) {
          prefix = 'v-on:';
        } else {
          prefix = 'bind';
          name = eventMap[name];
        }

        // let prefix = type !== '.user' ? (type === '.stop' ? 'catch' : 'bind') : 'v-on:';
        // if (config.output === 'ant' && prefix === 'bind') {
        //     prefix = 'on';
        //     name = name[0].toUpperCase() + name.substring(1);
        // }
        return ` ${prefix}${name}=`;
      });
    });
  },
  /**
   * get indent of a mutiple lines string
   * return {length: 4, char: ' '}
   */
  getIndent(str) {
    let arr = str.split('\n');
    while (arr.length && !/\w/.test(arr[0])) { // if the first line is empty line, then get rid of it
      arr.shift();
    }
    let indent = { firstLineIndent: 0, indent: 0, char: '' };
    let s = arr[0], i = 0;
    if (s.charCodeAt(0) === 32 || s.charCodeAt(0) === 9) { // 32 is space, 9 is tab
      indent.char = s[0];
    }
    while (s[i] === indent.char) {
      i++;
    }
    indent.firstLineIndent = i;
    if (!arr[1])
      return indent;
    s = arr[1], i = 0;
    if (!indent.char) {
      if (s.charCodeAt(0) === 32 || s.charCodeAt(0) === 9) { // 32 is space, 9 is tab
        indent.char = s[0];
      }
    }
    while (s[i] === indent.char) {
      i++;
    }
    indent.indent = i - indent.firstLineIndent;
    return indent;
  },
  /**
   * Fix indent for a mutiple lines string
   * @param  {String} str  string to fix
   * @param  {Number} num  4 means add 4 chars to each line, -4 means remove 4 chars for each line
   * @param  {String} char space or tab, indent charactor
   * @return {String}      fixed indent string
   */
  fixIndent(str, num, char) {
    if (char === undefined) {
      let indent = getIndent(str);
      char = indent.char;
    }
    let arr = str.split('\n');
    if (num > 0) { // added char to each line
      arr.forEach(function (v, i) {
        let p = 0;
        while (p++ < num) {
          arr[i] = char + arr[i]
        }
      });
    } else { // remove char for each line
      arr.forEach(function (v, i) {
        arr[i] = arr[i].substr(-1 * num);
      });
    }
    return arr.join('\n');
  },
  unique(arr) {
    let tmp = {}, out = [];
    arr.forEach((v) => {
      if (!tmp[v]) {
        tmp[v] = 1;
        out.push(v);
      }
    });
    return out;
  },
  unlink(p) {
    let rst = '';
    p = (typeof (p) === 'object') ? path.join(p.dir, p.base) : p;
    try {
      rst = fs.unlinkSync(p);
    } catch (e) {
      rst = null;
    }
    return rst;
  },
  readFile(p) {
    let rst = '';
    p = (typeof (p) === 'object') ? path.join(p.dir, p.base) : p;
    try {
      rst = fs.readFileSync(p, 'utf-8');
    } catch (e) {
      rst = null;
    }
    return rst;
  },
  mkdir(name) {
    let rst = true;
    try {
      fs.mkdirSync(name);
    } catch (e) {
      rst = e;
    }
    return rst;
  },
  writeFile(p, data) {
    let opath = (this.isString(p) ? path.parse(p) : p);
    if (!this.isDir(opath.dir)) {
      mkdirp.sync(opath.dir);
    }
    fs.writeFileSync(p, data);
  },
  copy(opath, ext, src, dist) {
    let target = this.getDistPath(opath, ext, src, dist);
    this.writeFile(target, this.readFile(path.join(opath.dir, opath.base)));
    let readable = fs.createReadStream(path.join(opath.dir, opath.base));
    let writable = fs.createWriteStream(target);
    readable.pipe(writable);
  },
  getRelative(opath) {
    return path.relative(this.currentDir, path.join(opath.dir, opath.base));
  },
  getDistPath(opath, ext, src, dist) {
    let relative;
    src = src || cache.getSrc();
    dist = dist || cache.getDist();
    if (typeof (opath) === 'string')
      opath = path.parse(opath);
    ext = (ext ? (ext[0] === '.' ? ext : ('.' + ext)) : opath.ext);
    // 第三组件
    if (opath.npm) {
      relative = path.relative(opath.npm.modulePath, opath.npm.dir);
      relative = path.join('npm', relative);
    } else {
      relative = path.relative(path.join(this.currentDir, src), opath.dir);
    }
    return path.join(this.currentDir, dist, relative, opath.name + ext);
  },
  getModifiedTime(p) {
    return this.isFile(p) ? +fs.statSync(p).mtime : false;
  },
  getConfig() {
    let config = cache.getConfig();
    if (config)
      return config;

    let configFile = path.join(this.currentDir, path.sep, 'wekit.config.js');
    let configType = 'js';

    if (!this.isFile(configFile)) {
      configFile = path.join(this.currentDir, path.sep, '.wepyrc');

      config = this.readFile(configFile);
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = null;
      }
    } else {
      config = require(configFile);
    }

    cache.setConfig(config);
    return config;
  },
  getIgnore() {
    let ignoreFile = path.join(this.currentDir, path.sep, '.wepyignore');
    return this.isFile(ignoreFile) ? this.readFile(ignoreFile) : '';
  },
  getFiles(dir = process.cwd(), prefix = '') {
    let cfiles = cache.getFileList(dir);
    if (cfiles)
      return cfiles;
    dir = path.normalize(dir);
    if (!fs.existsSync(dir)) {
      return [];
    }
    let files = fs.readdirSync(dir);
    let rst = [];
    files.forEach((item) => {
      let filepath = dir + path.sep + item;
      let stat = fs.statSync(filepath);
      if (stat.isFile()) {
        rst.push(prefix + item);
      } else if (stat.isDirectory()) {
        rst = rst.concat(this.getFiles(path.normalize(dir + path.sep + item), path.normalize(prefix + item + path.sep)));
      }
    });

    cache.setFileList(dir, rst);
    return rst;
  },
  getVersion() {
    let filepath = path.resolve(__dirname, '../package.json');
    let version = JSON.parse(this.readFile(filepath)).version;
    return version;
  },
  datetime(date = new Date(), format = 'HH:mm:ss') {
    let fn = (d) => {
      return ('0' + d).slice(-2);
    };
    if (date && this.isString(date)) {
      date = new Date(Date.parse(date));
    }
    const formats = {
      YYYY: date.getFullYear(),
      MM: fn(date.getMonth() + 1),
      DD: fn(date.getDate()),
      HH: fn(date.getHours()),
      mm: fn(date.getMinutes()),
      ss: fn(date.getSeconds())
    };
    return format.replace(/([a-z])\1+/ig, function (a) {
      return formats[a] || a;
    });
  },
  error(msg) {
    this.log(msg, 'error', false);
    process.exit(0);
  },
  warning(msg) {
    this.log(msg, 'warning', false);
  },
  log(msg, type, showTime = true) {
    let dateTime = showTime ? colors.gray(`[${this.datetime()}] `) : '';
    if (this.isObject(msg) || this.isArray(msg)) {
      msg = JSON.stringify(msg);
    }
    if (type && this.isString(type)) {
      type = type.toUpperCase();
      if (type === 'ERROR') {
        console.error(colors.red('[Error] ' + msg));
      } else if (type === 'WARNING') {
        console.error(colors.yellow('[WARNING] ' + msg));
      } else {
        let fn = colors[type] ? colors[type] : colors['info'];
        console.log(dateTime + fn(`[${type}]`) + ' ' + msg);
      }
    } else {
      console.log(dateTime + msg);
    }
  },
  output(type, file, flag) {
    if (!flag) {
      flag = file.substr(file.lastIndexOf('.') + 1).toUpperCase();
      if (flag.length < 4) {
        let i = 4 - flag.length;
        while (i--) {
          flag += ' ';
        }
      }
    }
    this.log(flag + ': ' + path.relative(this.currentDir, file), type);
  },
  genId(filepath) {
    if (!ID_CACHE[filepath]) {
      ID_CACHE[filepath] = '_' + hash(filepath).slice(1, 8);
    }
    return ID_CACHE[filepath];
  }
}
export default utils



