const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: "production",
    entry: {
        background: path.resolve(__dirname, "..", "src", "DevToolsPlugin.ts"),
    },
    output: {
        path: path.join(__dirname, "../build"),
        filename: "DevToolsPlugin.js"
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    devtool: 'source-map',
    // externals: {
    //     typescript: 'typescript'
    // },
    module : {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    }, 
    plugins: [
        new CopyPlugin({
            patterns: [
                {from: ".", to: ".",context: "public"}
            ]
        })
    ]
}