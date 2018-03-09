
<template>
  <div class="container">
    <text>{{txt}}</text>
  </div>
</template>

<script>

  export default {
    config: {
      navigationBarTitleText: 'test'
    },
    data(){
      return {
        txt: 'abc'
      }
    },
    created(){
      this.txt=this.$route.params.txt;
    },
    methods:{}
  }

</script>
<style lang="less" scoped>
</style>
