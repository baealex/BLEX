const withTM = require("next-transpile-modules")(["frappe-charts"]);

module.exports = withTM({
    experimental: {
        scrollRestoration: true,
    },
});