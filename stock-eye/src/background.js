const STOCK_POOL = {
  sh601398: '工行',
  sh601988: '中行',
  sh601288: '农行',
  sh601939: '建行',
};
const THRESHOLD = 1;

const STOCK_CODES = Object.keys(STOCK_POOL);

const fetchData = async () => {
  const response = await fetch(`http://hq.sinajs.cn/rn=${new Date().getTime()}&list=${STOCK_CODES.join(',')}`);
  const text = await response.text();
  return text;
};

const getValueFrom = (array = [], index = 0) => parseFloat(array[index]);

const getValuesFrom = (array = [], index = 0, length = 1) =>
  Array.from({
    length,
  }, (_, i) => getValueFrom(array, index + i));

const collapseArray = (array = []) =>
  array.reduce((acc, _, idx) => {
    if (idx % 2 === 0) {
      acc.push([array[idx + 1], array[idx]]);
    }
    return acc;
  }, []);

const calcRatio = ((price, stock) => Math.round(((price / stock.closeAt) - 1) * 10000) / 100);

const parse = (text = '') =>
  text
    .split(';', STOCK_CODES.length)
    .map((line) => {
      const [, variable = '', valueExp = ''] = /(.*?)="(.*?)"/.exec(line);
      return [STOCK_CODES.find(code => variable.includes(code)), valueExp.split(',')];
    })
    .map((item) => {
      const [stockCode, rawValues] = item;
      const stock = {
        code: stockCode,
        openAt: getValueFrom(rawValues, 1),
        closeAt: getValueFrom(rawValues, 2),
        current: getValueFrom(rawValues, 3),
        buyingAt: getValueFrom(rawValues, 6),
        sellingAt: getValueFrom(rawValues, 7),
        buyBid: collapseArray(getValuesFrom(rawValues, 10, 10)),
        sellBid: collapseArray(getValuesFrom(rawValues, 20, 10)),
        timestamp: new Date(`${rawValues[30]} ${rawValues[31]}`),
      };
      stock.ratio = calcRatio(stock.current, stock);
      stock.buyingRatio = calcRatio(stock.buyingAt, stock);
      stock.sellingRatio = calcRatio(stock.sellingAt, stock);
      return stock;
    });

const process = (stocks = [{ buyingRatio: 0, sellingRatio: 0 }]) => {
  const stockMayBuy = stocks.sort((a, b) => a.sellingRatio - b.sellingRatio)[0];
  const stockMaySell = stocks.sort((a, b) => b.buyingRatio - a.buyingRatio)[0];

  const delta = stockMaySell.buyingRatio - stockMayBuy.sellingRatio;
  if (delta > THRESHOLD) {
    return {
      delta: Math.round(delta * 100) / 100,
      buy: [stockMayBuy.code, stockMayBuy.sellingAt],
      sell: [stockMaySell.code, stockMaySell.buyingAt],
    };
  }

  return null;
};

const sendNotification = ({ delta = 0, buy: [buyCode, buyPrice], sell: [sellCode, sellPrice] }) => {
  const title = `价差${delta}%`;
  const message = `买${STOCK_POOL[buyCode]} @ ${buyPrice}，卖${STOCK_POOL[sellCode]} @ ${sellPrice}`;
  chrome.notifications.create({ type: 'basic', title, message, iconUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' });
};

const start = (interval = 3) => fetchData()
  .then(parse)
  .then((data) => {
    const decision = process(data);
    if (decision) {
      sendNotification(decision);
    }
    console.log(decision);
    return new Promise(resolve => setTimeout(resolve, interval * 1000));
  })
  .then(start);

start();

// sendNotification({ delta: 1.2, buy: ['first', 2.33], sell: ['second', 4.33] });
