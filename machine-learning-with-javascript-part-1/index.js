const csv = require('csvtojson');
const ml = require('ml-regression');
const readline = require('readline');

class AdvertisingLinearModel {
  constructor() {
    this.csvFilePath = 'advertising.csv';
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.x = [];
    this.y = [];
  }

  performRegression() {
    const model = new ml.SLR(this.x, this.y); // simple linear regression
    console.log(model.toString(3)); // print the linear formula
    return model;
  }

  predictOutout(model) {
    this.rl.question('Enter input X for prediction: ', (input) => {
      const result = model.predict(parseFloat(input));
      console.log(`At x = ${input}, y = ${result}`);
      this.predictOutout(model);
    });
  }

  run() {
    csv()
      .fromFile(this.csvFilePath)
      .on('json', (data) => {
        this.x.push(parseFloat(data.Radio));
        this.y.push(parseFloat(data.Sales));
      })
      .on('done', () => {
        const model = this.performRegression();
        this.predictOutout(model);
      });
  }
}

const model = new AdvertisingLinearModel();
model.run();
