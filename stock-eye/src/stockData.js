import { STOCK_CODES } from './settings';

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

const fetchStockData = async () => {
  const text = await fetchData();
  const stocks = parse(text);
  return stocks;
};

export default fetchStockData;
