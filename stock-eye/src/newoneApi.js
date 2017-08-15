import { decode } from 'iconv-lite';
import { MOBILE_TOKEN, ACCOUNT_NUMBER, PASSWORD, MOBILE_NUMBER } from './secrets';
import { sendNotification } from './chromeApi';

const ROOT_URL = 'https://etrade.newone.com.cn';

const param = (data = {}) => Object.entries(data).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');

const sendRequest = async (url = '', payload = {}) => {
  const hasPayload = Object.keys(payload).length;
  const response = await fetch(`${ROOT_URL}${url}`, {
    method: hasPayload ? 'POST' : 'GET',
    headers: new Headers({
      'Content-Type': 'application/x-www-form-urlencoded',
    }),
    credentials: 'include',
    body: hasPayload ? param(payload) : null,
  });
  return response;
};

const readResponse = async (response = new Response()) => {
  const [, charset] = response.headers.get('Content-Type').match(/charset=(.*?)$/);
  const bytes = await response.arrayBuffer();
  const text = decode(new Buffer(bytes), charset);
  return text;
};

const loadCaptcha = async () => {
  const response = await sendRequest('/validatecode/imgcode');
  if (!response.ok) {
    throw new Error(`fail to load captcha: ${response.statusText}`);
  }

  const contentType = response.headers.get('Content-Type');
  const data = await response.arrayBuffer();
  const base64String = btoa(String.fromCharCode(...new Uint8Array(data)));

  return `data:${contentType};base64,${base64String}`;
};

const loadLoginForm = async () => {
  const response = await sendRequest(`/include/loginFormNew.jsp?khxxbh_sj=${MOBILE_TOKEN}`);
  if (!response.ok) {
    throw new Error(`fail to load login form: ${response.statusText}`);
  }

  const text = await readResponse(response);
  const mimeType = response.headers.get('Content-Type').split(';')[0];

  const form = new DOMParser().parseFromString(text, mimeType).forms[0];
  const formData = Array.from(new FormData(form).entries()).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
  return formData;
};

const doLogin = async (payload, captcha) => {
  const response = await sendRequest('/xtrade', { ...payload,
    f_khh: ACCOUNT_NUMBER,
    f_mm: PASSWORD,
    validatecode: captcha,
    macip: MOBILE_NUMBER,
  });
  if (!response.ok) {
    throw new Error(`fail to login: ${response.statusText}`);
  }

  const [, charset] = response.headers.get('Content-Type').match(/charset=(.*?)$/);
  const bytes = await response.arrayBuffer();
  const text = decode(new Buffer(bytes), charset);
  return !text.includes('验证码输入错误');
};

const login = async () => {
  const formData = await loadLoginForm();

  const captchaImage = await loadCaptcha();

  let captcha = 2;
  while (captcha <= 20) {
    if (await doLogin(formData, String(captcha))) { // eslint-disable-line no-await-in-loop
      break;
    }
    captcha += 1;
  }

  sendNotification({ title: 'Login successful', message: `captcha is ${captcha}`, iconUrl: captchaImage });
};

const welcome = async () => {
  const response = sendRequest(`/xtrade?random=${new Date().getTime()}`, { jybm: 100027 });
  if (!response.ok) {
    throw new Error(`fail to load welcome page: ${response.statusText}`);
  }

  const text = await readResponse(response);
  console.log(text);
};

const buyStock = async (stockCode = '') => {
  const response = await sendRequest(`/newtrade/func/getWDData.jsp?random=${new Date().getTime()}`, { zqdm: stockCode });
  const text = await readResponse(response);
  console.log(text);
};

const holdings = async () => {
  const response = await sendRequest(`/xtrade?random=${new Date().getTime()}`, { jybm: '100040' });
  const text = await readResponse(response);
  console.log(text);
};

export { login, buyStock, holdings, welcome };

