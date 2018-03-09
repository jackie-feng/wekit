/**
 * 此处自定义指令 v-animation 以适配小程序。
 * 所以在weex中需要引入本文件。
 */

const animation = weex.requireModule('animation')

Vue.directive('animation', function (el, binding, vnode) {
  console.log('start animation in animation.js')
  const v = binding.value
  if (v) {
    if (process.env.COMPILE_ENV === 'vue') {
      animation.transition({
        $el: el
      }, v)
    } else {
      console.log(el)
      console.log(v)
      animation.transition(el, v)
    }
  }
})

