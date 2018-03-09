
<template>
  <div class="container">
    <text>Hello, Wekit!</text>

    <text class="btn_jump" @click="onclick">jump</text>
  </div>
</template>

<script>

  export default {
    config: {
      navigationBarTitleText: '首页'
    },
    data(){
      return{}
    },
    created(){

    },
    methods:{
      onclick(){
        this.$router.push({name: 'test',params: {txt:'params from home'}});
      }
    }
  }

</script>
<style lang="less" scoped>
  .container{
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
  }
  .btn_jump{
    padding-left: 30px;
    padding-right: 30px;
    padding-top: 10px;
    padding-bottom: 10px;

    background-color: antiquewhite;
    border-color: aqua;
    border-style: solid;
    border-width: 2px;
    border-radius: 10px;
  }
</style>
