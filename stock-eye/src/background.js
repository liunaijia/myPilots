import isTradeTime from './tradeTime';
import { STOCK_POOL, THRESHOLD } from './settings';
import fetchStockData from './stockData';

const process = (stocks = [{ buyingRatio: 0, sellingRatio: 0 }]) => {
  const stockMayBuy = stocks.sort((a, b) => a.sellingRatio - b.sellingRatio)[0];
  const stockMaySell = stocks.sort((a, b) => b.buyingRatio - a.buyingRatio)[0];

  const delta = Math.round((stockMaySell.buyingRatio - stockMayBuy.sellingRatio) * 100) / 100;
  if (delta > THRESHOLD) {
    return {
      delta,
      buy: [stockMayBuy.code, stockMayBuy.sellingAt],
      sell: [stockMaySell.code, stockMaySell.buyingAt],
      timestamp: new Date(),
    };
  }

  console.log(`${delta} B:${STOCK_POOL[stockMayBuy.code]}${stockMayBuy.sellingRatio}% S:${STOCK_POOL[stockMaySell.code]}${stockMaySell.buyingRatio}%`);
  return null;
};

const sendNotification = (title = '', message = '') => {
  chrome.notifications.create({ type: 'basic', title, message, iconUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' });
};

const sendDecision = ({ delta = 0, buy: [buyCode, buyPrice], sell: [sellCode, sellPrice] }) => {
  const title = `价差${delta}%`;
  const message = `买${STOCK_POOL[buyCode]} ${buyPrice}，卖${STOCK_POOL[sellCode]} ${sellPrice}`;
  sendNotification(title, message);
};

const sleep = async seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const runDuringTradeTime = async (block) => {
  try {
    const now = new Date();
    if (isTradeTime(now)) {
      await block();
    }
  } catch (e) {
    console.error(e);
    sendNotification(e.message);
  } finally {
    await sleep(3);
    runDuringTradeTime(block);
  }
};

runDuringTradeTime(async () => {
  const stocks = await fetchStockData();
  const decision = process(stocks);
  if (decision) {
    sendDecision(decision);
    console.log(decision);
  }
});
sendNotification('StockEye 启动');
