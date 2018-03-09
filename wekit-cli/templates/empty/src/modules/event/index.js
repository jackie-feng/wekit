
import wekit from 'wekit'

let bus = new wekit.EventBus()

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
