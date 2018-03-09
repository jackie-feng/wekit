/**
 * Created by FJC on 2017/10/20.
 */

export default {
  methods:{
    rpx(num, needPx) {
      if (needPx) {
        if (num === 0) {
          return num + 'px'
        }
        return num + 'rpx'
      }
      return num
    },
    getPlatform(){
      let platform = 'UNKNOWN'
      if (typeof (window) !== 'undefined') {
        platform = 'BROWSER'
      } else if (typeof (wx) !== 'undefined'){
        platform = 'WX_APP'
      } else {
        platform = 'UNKNOWN'
      }
      return platform
    }
  }
}
