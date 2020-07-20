const fs = require('fs');
const path = require('path');

const ts = require('typescript');
const uglify = require("uglify-js");
const sass = require('node-sass');

function walk(dir) {
    fs.readdir(dir, (err, filenames) => {
        filenames.forEach((filename) => {
            fs.stat(path.join(dir, filename), (err, stat) => {
                if(stat.isDirectory()) {
                    walk(path.join(dir, filename));
                } else {
                    const filePath = path.join(dir, filename);
                    const ext = filePath.split('.').slice(-1).toString();
                    if(ext === 'ts') {
                        fs.readFile(filePath, 'utf8', (err, source) => {
                            const result = ts.transpileModule(source, {
                                compilerOptions:{
                                    module: ts.ModuleKind.CommonJS
                                }
                            });
                            const minifyResult = uglify.minify(result.outputText)
                            fs.writeFile(filePath.slice(0, -2) + 'js', minifyResult.code, (err) => {
                                err && console.log(err);
                            });
                        });
                    } else if(ext === 'scss' || ext === 'sass') {
                        fs.readFile(filePath, 'utf8', (err, source) => {
                            const result = sass.renderSync({
                                data: source,
                                outputStyle: 'compressed'
                            });
                            fs.writeFile(filePath.slice(0, -4) + 'css', result.css, (err) => {
                                err && console.log(err);
                            });
                        });
                    }
                }
            });
        });
    });
}

const targetDrectory = './assets';
walk(targetDrectory);