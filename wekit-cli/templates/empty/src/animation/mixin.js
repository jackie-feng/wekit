/**
 * 此处统一weex和小程序的动画调用方式。
 *
 * weex端需要在入口文件引入 '../animation/index.js'文件， 配置自定义指令v-animation，
 *
 */
export default {
  methods: {
    createAnimation: function (params, bindKey) {
      // 小程序和weex都支持的函数
      params.timingFunction = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'ease'].indexOf(params.timingFunction) >= 0
        ? params.timingFunction : 'linear'

      if (params.styles && params.styles.transformOrigin) {
        var origins = params.styles.transformOrigin.split(' ')
        var x, y
        x = y = '50%'

        if (origins[0] === 'left') x = '0%'
        if (origins[0] === 'right') x = '100%'
        if (origins[1] === 'top') y = '0%'
        if (origins[1] === 'bottom') y = '100%'
        params.transformOrigin = x + ' ' + y + ' 0'
      }

      if (typeof process === 'undefined') {
        var animation = wx.createAnimation({
          duration: params.duration,
          timingFunction: params.timingFunction,
          delay: params.delay,
          transformOrigin: params.transformOrigin
        })

        if (params.styles) {
          var commonKeys = ['width', 'height', 'backgroundColor', 'opacity','top','left','right','bottom']
          var singleKeys = ['translateX', 'translateY', 'scale', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY']
          var doubleKeys = ['translate']

          for (var key in params.styles) {
            if (commonKeys.indexOf(key) >= 0) {
              animation[key](params.styles[key])
            }
          }

          if (params.styles.transform) {
            params.styles.transform.split(' ').map(function (str) {
              str = str.replace(/\s/g, '')
              let m = str.match(/([a-zA-Z]+)\(([0-9px,\.\s]+)\)/)
              if (m && m[1]) {
                let fun = m[1]

                let getParam = function (str) {
                  let m = str.match(/[a-zA-Z]+\(\s*([0-9px\.]+)\s*\)/)
                  return m&&m[1] ? m[1] : null
                }

                let getParams = function (str) {
                  let m = str.match(/[a-zA-Z]+\(\s*([0-9px\.]+)\s*,\s*([0-9px\.]+)\s*\)/)
                  let rst = m&&m[1]&&m[2] ? [m[1],m[2]] : null
                  return rst
                }

                if (singleKeys.indexOf(fun) >= 0) {
                  animation[fun](getParam(str))
                }

                if (doubleKeys.indexOf(fun) >= 0) {
                  let arr = getParams(str)
                  if (arr) {
                    animation[fun](arr[0],arr[1])
                  }
                }
              }
            })
          }
        }

        let bindData = {}
        bindData[bindKey] = animation.step().export()
        this[bindKey] = bindData[bindKey]
      } else {
        this[bindKey] = params
      }
    }
  }
}
