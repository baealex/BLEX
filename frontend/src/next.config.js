const path = require('path');
const withTM = require('next-transpile-modules')(['frappe-charts']);
const Config = require('./modules/config.json');

module.exports = withTM({
    experimental: {
        scrollRestoration: true,
    },
    sassOptions: {
        includePaths: [path.join(__dirname, 'styles')],
    },
    images: {
        domains: [Config.STATIC_SERVER, 'localhost']
    },
});