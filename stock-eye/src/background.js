import isTradeTime from './tradeTime';
import { STOCK_POOL, THRESHOLD } from './settings';
import fetchStockData from './stockData';
import { setBadge, sendNotification } from './chromeApi';
import { login, buyStock, getHoldings, sellStock } from './newoneApi';

const process = (stocks = [{ buyingRatio: 0, sellingRatio: 0 }]) => {
  const stockMayBuy = stocks.sort((a, b) => a.sellingRatio - b.sellingRatio)[0];
  const stockMaySell = stocks.sort((a, b) => b.buyingRatio - a.buyingRatio)[0];

  const gap = Math.round((stockMaySell.buyingRatio - stockMayBuy.sellingRatio) * 100) / 100;
  setBadge(gap.toString());

  if (gap > THRESHOLD) {
    return {
      gap,
      buy: {
        stockCode: stockMayBuy.code,
        stockName: STOCK_POOL[stockMayBuy.code],
        price: stockMayBuy.sellingAt,
      },
      sell: {
        stockCode: stockMaySell.code,
        stockName: STOCK_POOL[stockMaySell.code],
        price: stockMaySell.buyingAt,
      },
      timestamp: new Date().getTime(),
    };
  }

  // console.log(`${gap} B:${STOCK_POOL[stockMayBuy.code]}${stockMayBuy.sellingRatio}% S:${STOCK_POOL[stockMaySell.code]}${stockMaySell.buyingRatio}%`);
  return null;
};

const sendTradeSignal = ({ gap = 0,
  buy: { stockName: buyStockName, price: buyPrice },
  sell: { stockName: sellStockname, price: sellPrice } }) => {
  const title = `价差${gap}%`;
  const message = `买${buyStockName} ${buyPrice}，卖${sellStockname} ${sellPrice}`;
  sendNotification({ title, message });
};

const sleep = async seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const runDuringTradeTime = (interval = 3) => async (block) => {
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
    await sleep(interval);
    runDuringTradeTime(interval)(block);
  }
};

// watch stocks
let tradeSignal = null;
runDuringTradeTime()(async () => {
  const stocks = await fetchStockData();
  tradeSignal = process(stocks);
  if (tradeSignal) {
    sendTradeSignal(tradeSignal);
    // console.log(tradeSignal);
  }
});

// refresh holdings
let holdings = null;
runDuringTradeTime(10)(async () => {
  holdings = await getHoldings();
});

sendNotification({ title: 'StockEye 启动' });

const cutoffAmount = (price = 0, balance = 0, commission = 5) => {
  const amount = Math.floor(balance / price / 100) * 100;
  if (amount <= 0) { return 0; }

  const cost = amount * price * (1 + (commission / 10000));
  if (balance < cost) { return amount - 100; }
  return amount;
};

const createTradeSuggestion = () => {
  if (tradeSignal == null) {
    return null;
  }

  const suggestion = { ...tradeSignal };
  suggestion.balance = holdings.balance;
  suggestion.buy.maxAmount = cutoffAmount(suggestion.buy.price, holdings.balance);

  const holding = holdings.stocks.find(stock => stock.stockCode === suggestion.sell.stockCode);
  suggestion.sell.maxAmount = holding ? holding.sellableAmount : 0;
  return suggestion;
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_HOLDINGS') { sendResponse(holdings); }
  if (request.type === 'GET_SUGGESTION') {
    sendResponse(createTradeSuggestion());
  }
});


// chrome.runtime.onConnect.addListener((port) => {
//   console.log(port.name);
//   port.onMessage.addListener((msg) => {
//     console.log(`background received a message ${msg}`);
//   });

//   port.postMessage({ msg: 'I am background' });
// });


// chrome.extension.onConnect.addListener((port) => {
//   console.log('Connected .....');
// port.onMessage.addListener((msg) => {
//   console.log(`message recieved${msg}`);
//   port.postMessage('Hi Popup.js');
// });
// });

// login().then(() => {
//   holdings();
//   // buyStock('sh601988', 3.71, 200); // 中国银行
//   // sellStock('sh601288', 3.91, 200); // 农业银行
// });

