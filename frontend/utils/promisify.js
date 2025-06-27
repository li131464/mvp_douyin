// 开发者后端url，使用者可自行替换
export const BASE_URL = 'http://127.0.0.1:8000';

/**
 * @description: 将小程序api封装成Promise
 * @param {any} func js api，例如tt.login
 * @param {*} options 传入api的参数
 * @return {*}
 */
export function promisify(func, options = {}) {
  return new Promise((resolve, reject) => {
    func({
      ...options,
      success(res) {
        resolve(res);
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

/**
 * @description: 封装tt.request方法
 * @param {RequestData} options
 * @return {*}
 */
export async function request(options) {
  const urlRegexp = /(http|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/;
  const { url } = options;
  if (url && !urlRegexp.test(url)) {
    options.url = new URL(url, BASE_URL).href;
  }
  return await promisify(tt.request, options);
} 