/**
 * 小程序路由配置
 *
 */

const routes = [

  {
    name: 'home',
    url: '/pages/index',
  },
  {
    name: 'test',
    url: '/pages/test',
  }
]

/**
 * 此处success等回调为全局回调。
 * 注意：小程序页面跳转，最多打开五个页面。
 */
export default {
  routes: routes,
  success: function (pre,next,params,errMsg) {

  },
  fail: function (pre,next,params,errMsg) {

  },
  complete: function (pre,next,params,errMsg) {

  }
}
