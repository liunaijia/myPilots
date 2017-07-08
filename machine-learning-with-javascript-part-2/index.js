const KNN = require('ml-knn');
const csv = require('csvtojson');
const prompt = require('prompt');

class IrisModel {
  constructor() {
    this.csvFilePath = 'iris.csv';
  }

  run() {
    const data = [];

    csv({ noheader: true, headers: ['sepalLength', 'sepalWidth', 'petalLength', 'petalWidth', 'type'] })
      .fromFile(this.csvFilePath)
      .on('json', json => data.push(json))
      .on('done', (error) => {
        this.shuffleArray(data);
        const { trainSetX, trainSetY, testSetX, testSetY } = this.createDataSets(data);

        const knn = new KNN(trainSetX, trainSetY, { k: 7 });
        const errors = this.test(knn, testSetX, testSetY);
        console.log(`Test Set Size = ${trainSetX.length} and number of Misclassifications = ${errors}`);
      });
  }

  createDataSets(data) {
    const x = [];
    const y = [];
    const types = [];
    data.forEach((row) => {
      x.push(
        [row.sepalLength, row.sepalWidth, row.petalLength, row.petalWidth]
          .map(parseFloat),
      );
      let typeIndex = types.indexOf(row.type);
      if (typeIndex < 0) {
        typeIndex = types.length;
        types.push(row.type);
      }
      y.push(typeIndex);
    });

    const separationSize = 0.7 * data.length;
    return {
      trainSetX: x.slice(0, separationSize),
      trainSetY: y.slice(0, separationSize),
      testSetX: x.slice(separationSize),
      testSetY: y.slice(separationSize),
    };
  }

  test(knn, x, y) {
    let errors = 0;
    const results = knn.predict(x);
    results.forEach((result, i) => {
      if (result !== y[i]) {
        errors++;
      }
    });
    return errors;
  }

  shuffleArray(array) {
    for (let i = array.length; i; i--) {
      const j = Math.floor(Math.random() * i);
      [array[i - 1], array[j]] = [array[j], array[i - 1]];
    }
  }
}

new IrisModel().run();
