// Windows can occasionally make uv_os_get_passwd fail even when USERNAME is available.
// tsx only needs a stable value for its temporary directory name.
if (typeof process.geteuid !== 'function') {
  Object.defineProperty(process, 'geteuid', { value: () => 0 })
}
