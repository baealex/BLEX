export function Http404(res) {
    res.statusCode = 404;
    res.end(require('fs').readFileSync('./public/404.html'));
    return;
}

export function auto(status, res) {
    if(status == 404) {
        Http404(res);
    }
}