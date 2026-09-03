//创建统一的响应工具
//访问成功的返回的响应
exports.success = (data = null) => {
  return {
    errno: 0,
    data,
    errmsg: ''
  }
}

//访问失败的返回的响应
exports.fail = (errmsg = '请求失败', errno = 1) => {
  return {
    errno,
    data: null,
    errmsg
  }
}