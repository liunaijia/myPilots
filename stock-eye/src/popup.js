const fillForm = (tradeType = '', { stockName, price, maxAmount } = {}) => {
  const form = document.querySelector(`form.${tradeType}`);
  form.querySelector('.stock').innerText = `${stockName} ${price}`;
  form.querySelector('.price').value = price;
  form.querySelector('.amount').value = maxAmount;
  form.querySelector('.maxAmount').innerText = maxAmount;
};

chrome.runtime.sendMessage({ type: 'GET_SUGGESTION' }, (response) => {
  document.getElementById('debugWindow').innerText = JSON.stringify(response);
  fillForm('buy', response.buy);
  fillForm('sell', response.sell);
});
