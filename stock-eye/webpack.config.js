// const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    background: './src/background.js',
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: '[name].js',
  },
};
