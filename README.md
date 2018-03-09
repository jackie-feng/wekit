# wekit
Vue/weex-小程序转编译框架


wekit项目主要解决weex到小程序的编译问题，fork自[wepy](https://tencent.github.io/wepy/)。
其中主要改写了预编译部分wepy-cli和运行时wepy


> wekit为运行时框架,嵌入Vue的动态数据绑定。

> wekit-cli为预编译框架,解决模板、js、css编译以及npm包依赖问题。

`npm install -g wekit-cli` 全局安装预编译脚手架

`wekit new demo` 创建模板项目

`wekit build` 编译打包



# 入口文件

全局配置文件app.vue, 继承自wekit.app
关于不同平台(android/ios,h5,小程序)的入口文件请分开写。以下app.vue即为小程序入口配置文件。

```
export default class extends wekit.app {
  // 小程序配置
  config = {
    pages: [
      "pages/index",
      "pages/course/courseAudio",
    ],
    window: {
      // ...
    },
    tabBar: {
      // ...
    }
  };
  // 全局混合
  mixins = [wepyBase];
  // 路由配置
  router = routerConfig;

  constructor() {
    super();
  }

  onLaunch() { 
  }
}

<style lang="less">
/** less **/
</style>
```


# wekit.Vue

wekit运行时，实现了类vue的计算属性、watch等数据依赖，每一个组件都是一个Vue实例。
可以运行时创建Vue实例，但是由于小程序不具备dom操作的能力，所以目前不能用template、el属性创建一个视图组件。但是如果需要使用数据动态依赖的能力，还是可以用`new Vue`去构建模块组件。

```
let vm = new wekit.Vue({
   data(){},
   computed:{},
   watch:{},
   created(){
     // 动态创建的组件都是和视图无关的，所以只有created一个钩子。
   },
   methods:{},
})

// 也可以依托vue实例去完成构建eventbus 

let vm = new wekit.Vue()
vm.$on('event1',function(res){
  // 订阅事件
})
vm.$once('event1',function(res){
  // 订阅一次性事件，回调后自动解绑
})

// 解除订阅，handler为订阅的回调函数，不传时取消事件event1下所有订阅
vm.$off('event1',handler)

// 发送事件
vm.$emit('event1',params)


```


# 模板样式注意点

1.v-for展开

目前仅支持`v-for="item in items"`,`v-for="item,index in items"`,`v-for="(item,index) in items"`三种写法。

> 由于小程序的限制，目前v-for循环中的临时变量item,index不能作为组件的props参数传入。


2.class属性继承关系: 
```
//组件
<div class="a" :class="b">
...
</div>

//父组件
<child class="c" :class="d">
</child>

// 最终编译为class="a b c d"
```

当然尽可能简化模板的class和style

3. style 
```
<div :style="mStyle"></div>
```
上述mStyle编译时会编译为mStyle_weex_style作为样式进行特殊处理，所以注意命名冲突。


# 代码注意点

1.dom元素操作无效

2.避免vue $el属性的使用

3.组件间通信统一使用eventbus，避免$parent的调用

```
import wekit from 'wekit'

let bus = new wekit.EventBus()
// let bus = new Vue()

module.exports = {

  addEventListener: function (type, callback) {
    bus.addEventListener(type,callback)
  },
  sendEvent: function (type, data, sticky) {
    bus.sendEvent(type,data,sticky)
  },
  removeEventListener: function (type, callback) {
    bus.removeEventListener(type,callback)
  },
  addEventOnceListener: function (type, callback) {
    bus.addEventOnceListener(type,callback)
  }
}

```

sticky为粘性事件。
事件切忌重复监听，一定要销毁。removeEventListener不传callback就会清除该type的全部监听。

4.生命周期

|wepy|小程序|
|---|-----|
|created|onLoad|
|mounted|onReady|
|onShow*|onShow|
|onHide*|onHide|
|onPullDownRefresh*|onPullDownRefresh|
|onReachBottom*|onReachBottom|
|onShareAppMessage*|onShareAppMessage|
|onPageScroll*|onPageScroll|
|beforeDestroy|onUnload|

其中*标记的钩子只对小程序有效，所以业务逻辑请放在 created、mounted、beforeDestroy下。

5.$refs可以invoke组件的方法

通过this.$refs 可以拿到子组件的实例，可以调用其方法。

6.模板内多次使用统一组件，组件tag命名要区分，例如OText1，OText2

```
import OText from './components/o-text.vue'
import OComp from './components/o-comp.vue'
module.exports = {
  components: {
    OText1: OText,
    OText2: OText,
    OComp1: OComp,
    OComp2: OComp
  },
}
```

* 注意：components排序决定组件创建顺序




7. 必须设置 `data () {}`,其中数据可以为空


# 混合

### 全局混合
```
export default class extends wepy.app {
  
  // 全局混合
  mixins = [wepyBase];
  
}
```

### 局部混合

单vue文件中混入
```
export default {
  
  // 局部混合
  mixins:[mixin];
  
}
```


# 路由

小程序路由如下，请单独配置。

```
export default class extends wepy.app {
  
  // 路由配置
  router = routerConfig;
  
}
```
### routerConfig

```
config = {
  routes: [
    {
      name: 'index',
      url: '/pages/index',  // 小程序页面路径‘/’开始
    },
  ],
  success: function (pre, next, errMsg) {

  },
  fail: function (pre, next, errMsg) {

  },
  complete: function (pre, next, errMsg) {

  }
}

...

// 使用
this.$router.push({
        name: 'index',
        params: {id: 123},

        success: function () {
        },
        fail: function () {
        },
        complete: function () {
        }
      })

// success、fail、complete先执行config内的配置，后执行局部的回调,只在小程序下回调。

// 取参数
let id = this.$route.params.id

```
# 组件

`不支持动态组件`

|wepy|小程序|
|---|----|
|slider|swiper|
|div|view|
|cell|view|
|list|scroll-view|
|scroller|scroll-view|
|input|input|
|swtich|swtich|
|组件持续更新中...|


# 组件标签自定义匹配

由于小程序的标签会不断更新，不同需求对组件的需求量不一样，所以这边开放出标签匹配的接口，用于自定义匹配。

```
/**
 * 此处配置 模板标签映射关系
 *
 * weex与小程序基础组件属性不是一一对应的，所以在编译过程会建立一个从weex组件到小程序组件的映射，常用组件wekit已经处理。
 * 考虑到weex、小程序版本迭代中组件的变化、wekit没有及时跟进的问题，需在此配置额外的映射规则。
 *
 *
 * 规则如下：
 *   ```
 *   module.exports = {
 *      slider: {     // weex组件名
 *          name: 'swiper',  // wx小程序组件名
 *          attrs: {       // 属性名替换
 *              'auto-play': 'autoplay',
 *              infinite: 'circular',
 *              // extra方法会在节点编译时回调，如有额外的修改需求，在此操作node节点。
 *              extra:function (node) {
 *                  node.setAttribute('circular','{{true}}');
 *              }
 *          }
 *      },
 *   }
 *
 *   ```
 *
 * 注意： 此处映射规则会覆盖wekit内同名规则，不要随意替换，extra函数内attr修改要慎重。
 *
 * 另外，也可以将weex自定义组件完整的替换为wx组件。
 * 比如weex内用户封装的进度条 SliderComp，可以在此替换为wx基础组件slider。
 *
 * @type {{}}
 */

module.exports = {
}

```

并把该规则文件从 `wekit.config.js`引入。

```

var prod = process.env.NODE_ENV === 'production'

const rules = require('./comp_rules')

module.exports = {
  wpyExt: '.vue',
  eslint: true,
  rules: rules,

  ...
}

```


