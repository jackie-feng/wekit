/**
 * Created by FJC on 2017/11/6.
 */

import Vue from './Vue'

var comp = {

	data() {
		return {
			a:1,
			b:{
				x:1,
				y:2
			}
		}
	},

	created(){
		console.log('created');
        console.log('com_b=',this.com_b)
        console.log('com_b=',this.com_a)

		this.a=2;


		console.log('com_b=',this.com_b)
        console.log('com_b=',this.com_a)
	},
	computed: {
		com_b() {
			return this.com_a+this.a
		},
		com_a() {
			return this.a + this.b.x
		}
	},
	watch: {
		a(a,b){
			console.log('watch', a, b)
		}
	}
}


let v=new Vue();

let fn1= function (p) {
    console.log('v.$on1---aa',p)
}
let fn2= function (p) {
    console.log('v.$on2---aa',p)
}
v.$on('aa',fn1)

v.$on('aa',fn2)

let fn3= function (p) {
    console.log('v.$on3---aa',p)
}
v.$once('aa',fn3)

v.$once('bb',function (p) {
    console.log('v.$on---bb',p)
})

v.$emit('bb',123);
v.$emit('bb',123);
v.$emit('aa',123);

v.$emit('aa',123);
// console.log('b=',b);