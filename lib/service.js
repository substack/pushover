var HttpDuplex = require('http-duplex');
var inherits = require('inherits');
var spawn = require('child_process').spawn;

module.exports = function (opts, req, res) {
    var service = new Service(opts, req, res);
    
    Object.keys(opts).forEach(function (key) {
        service[key] = opts[key];
    });
    return service;
};

var headerRE = {
    'receive-pack' : '([0-9a-fA-F]+) ([0-9a-fA-F]+) refs\/(heads|tags)\/(.*?)( |00|\u0000)',
    'upload-pack' : '^\\S+ ([0-9a-fA-F]+)'
};

function Service (opts, req, res) {
    var self = this;
    HttpDuplex.call(self, req, res);
    
    self.status = 'pending';
    self.repo = opts.repo;
    self.service = opts.service;
    self.cwd = opts.cwd;
    
    var piped = false;
    self.on('pipe', function () {
        piped = true;
    });
    
    var buffered = [];
    var data = '';
    self.on('data', function ondata (buf) {
        buffered.push(buf);
        data += buf;
        
        var ops = data.match(new RegExp(headerRE[self.service], 'gi'));
        if (!ops) return;
        data = undefined;
       
        ops.forEach(function(op) {
            var m = op.match(new RegExp(headerRE[self.service]));
            if (self.service === 'receive-pack') {
                self.last = m[1];
                self.commit = m[2];

                if (m[3] == 'heads') {
                    var type = 'branch';
                    self.evName = 'push';
                } else {
                    var type = 'version';
                    self.evName = 'tag';
                }

                var headers = {
                    last: self.last,
                    commit : self.commit
                };
                headers[type] = self[type] = m[4];
                self.emit('header', headers);
            }
            else if (self.service === 'upload-pack') {
                self.commit = m[1];
                self.evName = 'fetch';
                self.emit('header', { commit : self.commit });
            }
        });
    });
    
    self.once('accept', function () {
        process.nextTick(function () {
            var ps = spawn('git-' + opts.service, [
                '--stateless-rpc',
                opts.cwd
            ]);
            self.emit('service', ps);
            ps.stdout.pipe(self, { end : !piped });
            
            buffered.forEach(function (buf) {
                ps.stdin.write(buf);
            });
            buffered = undefined;
            
            self.pipe(ps.stdin);
            ps.on('exit', self.emit.bind(self, 'exit'));
        });
    });
}

inherits(Service, HttpDuplex);

Service.prototype.accept = function () {
    if (this.status !== 'pending') return;
    
    this.status = 'accepted';
    this.emit('accept');
};

Service.prototype.reject = function (code, msg) {
    if (this.status !== 'pending') return;
    
    if (msg === undefined && typeof code === 'string') {
        msg = code;
        code = 500;
    }
    this.statusCode = code || 500;
    if (msg) this.write(msg);
    
    this.status = 'rejected';
    this.emit('reject');
};
