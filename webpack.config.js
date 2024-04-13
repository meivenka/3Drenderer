const HtmlWebpackPlugin = require('html-webpack-plugin');

const webpack = require('webpack');

const path = require('path');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'development',
    plugins: [
      new HtmlWebpackPlugin({
          template: './src/index.html',
          filename: 'index.html',
      }),
      new webpack.ProvidePlugin({
          $: 'jquery',
          jQuery: 'jquery'
      }),
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: false,
        port: 9000,
        host: 'localhost',
    },
    module: {
        rules: [
          {
              test: /\.glsl$/,
              use: 'webpack-glsl-loader'
          }
        ]
    }
};
