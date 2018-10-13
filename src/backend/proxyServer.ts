import * as http from 'http';
import * as request from 'request'
import * as express from 'express'
import * as Agent from 'socks5-http-client/lib/Agent'
import * as fs from 'fs'
import * as zlib from 'zlib'
import { parseAL, AL } from 'aigis-fuel'
import * as path from 'path'

function parse(buffer) {
    const result = parseAL(buffer);
    return result;
}


function mkdir(dirArray, max) {
    if (max === undefined) {
        max = dirArray.length;
    }
    if (typeof dirArray === 'string') {
        fs.mkdirSync(dirArray);
    } else {
        let nowDir = '.';
        for (let i = 0; i < max; i++) {
            nowDir += '/' + dirArray[i];
            if (!fs.existsSync(nowDir)) {
                fs.mkdirSync(nowDir);
            }
        }
    }

}

export class ProxyServer {
    FileList = {};
    ProxyHost = '127.0.0.1'
    ProxyPort = 1080;
    ProxyEnable = false;
    ProxyIsSocks5 = false;
    createServer(userDataPath: string) {
        const app = express();
        app.use(function (req, res, next) {
            // res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'max-age=6048000');
            next();
        })
        app.use((req, res) => {
            const headers = req.headers;
            headers.host = 'assets.millennium-war.net';
            // 设置代理
            const options: any = {
                url: 'http://assets.millennium-war.net' + req.path,
                headers: headers,
                encoding: null,
            };
            if (this.ProxyEnable === true && this.ProxyIsSocks5 === true) {
                options.agentClass = Agent;
                options.agentOptions = {
                    socksHost: this.ProxyHost,
                    socksPort: this.ProxyPort
                }
            }
            if (this.ProxyEnable === true && this.ProxyIsSocks5 === false) {
                options.proxy = `http://${this.ProxyHost}:${this.ProxyPort}`
            }
            let requestFileName = this.FileList[req.path];
            if (req.path.indexOf('1fd726969acf636b52a911152c088f8d') !== -1) {
                requestFileName = 'MainFont.aft';
            }
            let modifyFileName = '';
            if (requestFileName) {
                switch (path.extname(requestFileName)) {
                    case 'aft':
                    case 'png':
                        modifyFileName = requestFileName;
                        break;
                    case 'atb':
                        modifyFileName = requestFileName.replace('.atb', '.txt');
                        break;
                    case 'aar':
                        modifyFileName = requestFileName.replace('.aar', '');
                        break;
                    default:
                        modifyFileName = '';
                }
            }
            // 文件热封装
            const protoablePath = process.env.PORTABLE_EXECUTABLE_DIR;
            const modPath = protoablePath ? protoablePath + '/mods' : path.join(userDataPath, 'mods');
            if (!fs.existsSync(modPath)) {
                fs.mkdirSync(modPath);
            }
            const modifyFilePath = path.join(modPath, modifyFileName);
            if (modifyFileName !== '' && fs.existsSync(modifyFilePath)) {
                console.log(requestFileName, 'modify by Server');
                // AFT和PNG文件直接回传
                if (modifyFileName === 'MainFont.aft' || path.extname(modifyFileName) === 'png') {
                    fs.createReadStream(modifyFilePath).pipe(res);
                    return;
                }
                // 其他文件
                let result: AL;
                options.gzip = true;
                request(options, (err, response, body) => {
                    result = parse(body);
                    // 这边也需要添加一个任务队列，不然会爆炸
                    res.send(result.Package(modifyFilePath));
                    // res.send(body);
                })
            } else {
                request(options, (err, res, body) => {
                    if (body === undefined) {
                        console.log('Error on ' + req.path);
                    }
                }).pipe(res);
            }
        });
        const server = http.createServer(app);
        server.on('error', (e) => {
            console.log(e);
        });
        server.listen('19980', function () {
            console.log('listen at 19980');
        });
    }
    setFileList(fileList) {
        this.FileList = fileList;
    }
    setProxy(enable, isSocks5, host, port) {
        this.ProxyEnable = enable;
        this.ProxyIsSocks5 = isSocks5;
        if (enable) {
            this.ProxyHost = host;
            this.ProxyPort = port;
        }
    }
}

