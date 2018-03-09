
<script>
import wekit from 'wekit'
import "wepy-async-function";
import anim_mixin from './animation/mixin'
import base from './mixins/base'
import routes from './routes/index'

export default class extends wekit.app {
  config = {
    pages: [
      'pages/index',
      'pages/test'
    ],
    window: {
      backgroundTextStyle: 'light',
      navigationBarBackgroundColor: '#fff',
      navigationBarTitleText: 'WeChat',
      navigationBarTextStyle: 'black'
    }
  }
  // 路由配置
  router = routes
  // 全局混合
  mixins = [base,anim_mixin]

  onLaunch() {
    console.log('on launch')
  }
  onShow () {

  }
  onHide () {

  }
  onError(){

  }
}
</script>
<style lang="less" scoped>
</style>
