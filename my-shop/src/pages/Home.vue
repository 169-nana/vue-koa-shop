<template>
  <main class="home">
    <h1>微商城</h1>

    <p>商城前台正在建设中</p>

    <nav>
      <RouterLink to="/login">
        登录
      </RouterLink>

      <RouterLink to="/register">
        注册
      </RouterLink>

      <RouterLink to="/profile">
        个人中心
      </RouterLink>
    </nav>
  </main>
</template>

<style scoped>
.home {
  max-width: 720px;
  margin: 80px auto;
  padding: 32px;
  text-align: center;
}

nav {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 32px;
}

a {
  color: #409eff;
}
</style>