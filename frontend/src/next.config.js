const path = require('path');
const withTM = require('next-transpile-modules')(
    ['react-frappe-charts', 'frappe-charts']
);

module.exports = withTM({
    experimental: {
        scrollRestoration: true,
    },
    sassOptions: {
        includePaths: [path.join(__dirname, 'styles')],
    },
});
