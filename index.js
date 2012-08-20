var fs = require('fs');
var url = require('url');
var qs = require('querystring');
var path = require('path');
var http = require('http');

var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var EventEmitter = require('events').EventEmitter;

module.exports = function (repoDir, opts) {
    if (!opts) opts = {};
    return new Git(repoDir, opts);
};

function Git (repoDir, opts) {
    this.repoDir = repoDir;
    this.autoCreate = opts.autoCreate === false ? false : true;
    this.write_messages = opts.write_messages;
    this.checkout = opts.checkout;
}

Git.prototype = new EventEmitter();

Git.prototype.listen = function () {
    var self = this;
    var server = http.createServer(this.handle.bind(this));
    server.on('listening', function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('listening');
        self.emit.apply(self, args);
    });
    server.listen.apply(server, arguments);
    return server;
};

Git.prototype.list = function (cb) {
    fs.readdir(this.repoDir, cb);
};

Git.prototype.exists = function (repo, cb) {
    (fs.exists || path.exists)(path.join(this.repoDir, repo), cb);
};

Git.prototype.create = function (repo, cb) {
    var cwd = process.cwd();
    var dir = path.join(this.repoDir, repo);
    var ps;
    if (this.checkout) {
        ps = spawn('git', [ 'init', dir ]);
    } else {
        ps = spawn('git', [ 'init', '--bare', dir ]);
    }
    
    var err = '';
    ps.stderr.on('data', function (buf) { err += buf; });
    
    onexit(ps, function (code) {
        if (!cb) {}
        else if (code) cb(err || true);
        else cb(null);
    });
};

var services = [ 'upload-pack', 'receive-pack' ];

Git.prototype.handle = function (req, res, next) {
    var self = this;
    var repoDir = self.repoDir;
    var u = url.parse(req.url);
    var params = qs.parse(u.query);
    
    function noCache () {
        res.setHeader('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
        res.setHeader('pragma', 'no-cache');
        res.setHeader('cache-control', 'no-cache, max-age=0, must-revalidate');
    }
    
    var m;
    if (req.method === 'GET'
    && (m = u.pathname.match(/\/([^\/]+)\/info\/refs$/))) {
        var repo = m[1];
        var repopath = self.checkout
            ? path.join(repoDir, repo, '.git')
            : path.join(repoDir, repo)
        ;
        
        if (!params.service) {
            res.statusCode = 400;
            res.end('service parameter required');
            return;
        }
        
        var service = params.service.replace(/^git-/, '');
        if (services.indexOf(service) < 0) {
            res.statusCode = 405;
            res.end('service not available');
            return;
        }
        
        next = function () {
            res.setHeader('content-type',
                'application/x-git-' + service + '-advertisement'
            );
            noCache();
            serviceRespond(service, repopath, res);
        };
        
        self.exists(repo, function (ex) {
            if (!ex && self.autoCreate) self.create(repo, next);
            else if (!ex) {
                res.statusCode = 404;
                res.setHeader('content-type', 'text/plain');
                res.end('repository not found');
            }
            else next();
        });
    }
    else if (req.method === 'GET'
    && (m = u.pathname.match(/^\/([^\/]+)\/HEAD$/))) {
        var repo = m[1];
        var repopath = self.checkout
            ? path.join(repoDir, repo, '.git')
            : path.join(repoDir, repo)
        ;
        
        next = function () {
            var file = path.join(repopath, 'HEAD');
            (fs.exists || path.exists)(file, function (ex) {
                if (ex) fs.createReadStream(file).pipe(res);
                else {
                    res.statusCode = 404;
                    res.end('not found');
                }
            });
        };
        
        self.exists(repo, function (ex) {
            if (!ex && self.autoCreate) self.create(repo, next);
            else if (!ex) {
                res.statusCode = 404;
                res.setHeader('content-type', 'text/plain');
                res.end('repository not found');
            }
            else next();
        });
    }
    else if (req.method === 'POST'
    && (m = req.url.match(/\/([^\/]+)\/git-(.+)/))) {
        var repo = m[1], service = m[2];
        var repopath = self.checkout
            ? path.join(repoDir, repo, '.git')
            : path.join(repoDir, repo)
        ;
        
        if (services.indexOf(service) < 0) {
            res.statusCode = 405;
            res.end('service not available');
            return;
        }
        
        res.setHeader('content-type',
            'application/x-git-' + service + '-result'
        );
        noCache();
        
        var ps = spawn('git-' + service, [
            '--stateless-rpc',
            repopath
        ]);

        //this.writePacket("-->| Pushover power!!", res);
        if (!self.write_messages) {
            ps.stdout.pipe(res,{ end : !self.write_messages });
        }else{
            var _GitMessage = new GitMessage(res);
            ps.stdout.on("data",function(data) {

                // end of transmission(git flush command)
                // could also be data[0]!== 48 && data[1]!== 48 && data[2]!== 48 && data[3]
                if (data.length != 4) {
                    res.write(data);
                }
            });
        }
        
        onexit(ps, function (code) {
            if (service === 'receive-pack') {

                var _repo = {
                    name: repo,
                    commit: commit,
                    branch: branch
                };

                if (self.checkout) {
                    var opts = { cwd : path.join(repoDir, repo) };
                    exec('git reset --hard', opts, function () {
                        self.emit('push', _repo, _GitMessage);
                    });
                }
                else self.emit('push', _repo, _GitMessage);
            }
        });
        
        var commit = null, branch = null;
        (function () {
            var data = '';
            req.on('data', function ondata (buf) {
                data += buf;
                var m = data.match(
                    /^[0-9a-fA-F]+ ([0-9a-fA-F]+) refs\/heads\/([^\s\0]+)/
                );
                if (m) {
                    commit = m[1];
                    branch = m[2];
                    req.removeListener('data', ondata);
                }
            });
        })();
        
        req.pipe(ps.stdin);
        ps.stderr.pipe(process.stderr, { end : false });
    }
    else if (typeof next === 'function') {
        next();
    }
    else if (req.method !== 'GET' && req.method !== 'POST') {
        res.statusCode = 405;
        res.end('method not supported');
    }
    else {
        res.statusCode = 404;
        res.end('not found');
    }
};


function GitMessage(stream) {
    this.stream = stream;
}

GitMessage.prototype._pack = function(type, msg) {
    var length;
    msg = type + msg;

    // rpc messange consists of each line preceded by its length (including the header) as a 4-byte hex number.
    length = (msg.length + 4 + 0x10000).toString(16).substr(-4).toUpperCase();
    return length + msg;
};

GitMessage.prototype.end = function(msg) {
    // must be called on the end
    if (msg) {
      this.write(msg);
    }
    return this.stream.end("00000000");
};

GitMessage.prototype.write = function(msg) {
    // \2 is verbose messange defined by git protocol
    return this.stream.write(this._pack("\u0002", msg));
};

GitMessage.prototype.error = function(msg) {
    // \3 is error message defined by git protocol
    this.stream.write(this._pack("\u0003", msg));
    return this.end;
};

function serviceRespond (service, file, res) {
    function pack (s) {
        var n = (4 + s.length).toString(16);
        return Array(4 - n.length + 1).join('0') + n + s;
    }
    res.write(pack('# service=git-' + service + '\n'));
    res.write('0000');
    
    var ps = spawn('git-' + service, [
        '--stateless-rpc',
        '--advertise-refs',
        file
    ]);
    ps.stdout.pipe(res, { end : false });
    ps.stderr.pipe(res, { end : false });
    
    onexit(ps, function () { res.end(); });
}

function onexit (ps, cb) {
    var pending = 3;
    var code, sig;
    
    function onend () {
        if (--pending === 0) cb(code, sig);
    }
    ps.on('exit', function (c, s) {
        code = c;
        sig = s;
    });
    ps.on('exit', onend);
    ps.stdout.on('end', onend);
    ps.stderr.on('end', onend);
}
