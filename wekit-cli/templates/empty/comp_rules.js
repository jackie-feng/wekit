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
