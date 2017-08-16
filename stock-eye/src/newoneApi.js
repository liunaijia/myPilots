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

const readContentType = (response = new Response()) => {
  const contentType = response.headers.get('Content-Type');
  const groups = contentType.match(/([^;]+)(;\s*charset=([^;]+))?(;\s*boundary=([^;]+))?/);
  return { mimeType: groups[1], charset: groups[3], boundary: groups[5] };
};

const readAsText = async (response = new Response()) => {
  const { charset } = readContentType(response);
  const bytes = await response.arrayBuffer();
  const text = decode(new Buffer(bytes), charset);
  return text;
};

const readAsDataUrl = async (response = new Response()) => {
  const { mimeType } = readContentType(response);
  const data = await response.arrayBuffer();
  const base64String = btoa(String.fromCharCode(...new Uint8Array(data)));

  return `data:${mimeType};base64,${base64String}`;
};

const readAsDom = async (response = new Response()) => {
  const text = await readAsText(response);
  const { mimeType } = readContentType(response);

  const dom = new DOMParser().parseFromString(text, mimeType);
  return dom;
};

const loadCaptcha = async () => {
  const response = await sendRequest('/validatecode/imgcode');
  if (!response.ok) {
    throw new Error(`fail to load captcha: ${response.statusText}`);
  }

  return readAsDataUrl(response);
};

const loadLoginForm = async () => {
  const response = await sendRequest(`/include/loginFormNew.jsp?khxxbh_sj=${MOBILE_TOKEN}`);
  if (!response.ok) {
    throw new Error(`fail to load login form: ${response.statusText}`);
  }

  const form = (await readAsDom(response)).forms[0];
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

  const { charset } = readContentType(response);
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
      sendNotification({ title: 'Login successful', message: `captcha is ${captcha}`, iconUrl: captchaImage });
      return;
    }
    captcha += 1;
  }

  throw new Error('fail to login: incorrect captcha');
};

const parseStockType = (stockCode = '') => {
  if (stockCode.startsWith('sh')) { return '1'; }
  if (stockCode.startsWith('sz')) { return '2'; }
  throw new Error(`Unknown stock code: ${stockCode}`);
};

const getAccountCode = async (stockCode = '', tradeType = '') => {
  const stockType = parseStockType(stockCode);

  const payload = { jybm: '' };
  if (tradeType === 'buy') { payload.jybm = '100010'; } else if (tradeType === 'sell') { payload.jybm = '100020'; } else throw new Error(`Unknown trade type ${tradeType}`);

  const response = await sendRequest(`/xtrade?random=${new Date().getTime()}`, payload);
  const dom = await readAsDom(response);

  const matchedNode = Array.from(dom.querySelectorAll('#gddm option')).find(node => node.attributes.sscdm.value === stockType);
  if (matchedNode) {
    return matchedNode.value;
  }

  throw new Error(`Cannot find the account code matched with: ${stockCode}`);
};

const buyStock = async (stockCode = '', price = 0.0, amount = 0) => {
  const accountCode = await getAccountCode(stockCode, 'buy'); // double check the parameter

  const response = await sendRequest(`/xtrade?random=${new Date().getTime()}`, {
    jybm: '100012',
    mmlb: '1', // 交易类型：买
    gddm: accountCode,
    zqdm: stockCode.match(/\d{6}$/)[0],
    wtjg: price,
    wtsl: amount,
  });
  const text = await readAsText(response);
  if (!text.includes('您的申请已提交')) {
    throw new Error(`Fail to buy stock ${stockCode} ${price} ${amount}, ${text}`);
  }
};

const sellStock = async (stockCode = '', price = 0.0, amount = 0) => {
  const accountCode = await getAccountCode(stockCode, 'sell'); // double check the parameter

  const response = await sendRequest(`/xtrade?random=${new Date().getTime()}`, {
    jybm: '100012',
    mmlb: '2', // 交易类型：卖
    gddm: accountCode,
    zqdm: stockCode.match(/\d{6}$/)[0],
    wtjg: price,
    wtsl: amount,
  });
  const text = await readAsText(response);
  if (!text.includes('您的申请已提交')) {
    throw new Error(`Fail to sell stock ${stockCode} ${price} ${amount}, ${text}`);
  }
};

const parseHoldings = async (response) => {
  const dom = await readAsDom(response);
  const balance = parseFloat(dom.querySelector('#zongzichan').innerText.match(/可用：\s*([\d|.]+)/)[1]);
  return {
    balance,
  };
};

const holdings = async () => {
  const response = await sendRequest(`/xtrade?random=${new Date().getTime()}`, { jybm: '100040' });
  return parseHoldings(response);
};

export { login, buyStock, holdings, sellStock };

