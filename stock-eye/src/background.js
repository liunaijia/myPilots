import isTradeTime from './tradeTime';
import { STOCK_POOL, THRESHOLD } from './settings';
import fetchStockData from './stockData';
import { setBadge, sendNotification } from './chromeApi';
import { login, buyStock, holdings, sellStock } from './newoneApi';

const process = (stocks = [{ buyingRatio: 0, sellingRatio: 0 }]) => {
  const stockMayBuy = stocks.sort((a, b) => a.sellingRatio - b.sellingRatio)[0];
  const stockMaySell = stocks.sort((a, b) => b.buyingRatio - a.buyingRatio)[0];

  const gap = Math.round((stockMaySell.buyingRatio - stockMayBuy.sellingRatio) * 100) / 100;
  setBadge(gap.toString());

  if (gap > THRESHOLD) {
    return {
      gap,
      buy: [stockMayBuy.code, stockMayBuy.sellingAt],
      sell: [stockMaySell.code, stockMaySell.buyingAt],
      timestamp: new Date(),
    };
  }

  // console.log(`${gap} B:${STOCK_POOL[stockMayBuy.code]}${stockMayBuy.sellingRatio}% S:${STOCK_POOL[stockMaySell.code]}${stockMaySell.buyingRatio}%`);
  return null;
};

const sendDecision = ({ gap = 0, buy: [buyCode, buyPrice], sell: [sellCode, sellPrice] }) => {
  const title = `价差${gap}%`;
  const message = `买${STOCK_POOL[buyCode]} ${buyPrice}，卖${STOCK_POOL[sellCode]} ${sellPrice}`;
  sendNotification({ title, message });
};

const sleep = async seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const runDuringTradeTime = async (block) => {
  try {
    const now = new Date();
    if (isTradeTime(now)) {
      await block();
    } else {
      setBadge('');
    }
  } catch (e) {
    console.error(e);
    sendNotification({ title: e.message });
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

sendNotification({ title: 'StockEye 启动' });

// login().then(() => {
//   // buyStock('sh601988', 3.71, 200); // 中国银行
//   // sellStock('sh601288', 3.91, 200); // 农业银行
// });

