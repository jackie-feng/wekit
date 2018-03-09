/**
 * Created by FJC on 2017/11/10.
 */


export default class DataQueue {
	
	data_queue = []
	
	hasCommit = false
	
	
	
	constructor(wxpage) {
		this.$wxpage = wxpage;
	}
	
	push (params) {

		this.data_queue.push(params);
		
		if (!this.hasCommit) {
			this.commit();
		}
	}
	
	commit () {
		
		this.hasCommit = true;
		
		let self = this;
		
		
		setTimeout(function () {
			let data = Object.assign({}, ...self.data_queue);
			self.data_queue.length = 0;
			self.$wxpage.setData(data);
			self.hasCommit = false;
		}, 0);
		
	}
	
}