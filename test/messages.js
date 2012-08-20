var test = require('tap').test;
var pushover = require('../');

var fs = require('fs');
var path = require('path');
var exists = fs.exists || path.exists;

var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

var seq = require('seq');

test('create, adn push to a repo with custom messages', function (t) {
    t.plan(6);
    
    var repoDir = '/tmp/' + Math.floor(Math.random() * (1<<30)).toString(16);
    var srcDir = '/tmp/' + Math.floor(Math.random() * (1<<30)).toString(16);
    var dstDir = '/tmp/' + Math.floor(Math.random() * (1<<30)).toString(16);
    var lastCommit;
    
    fs.mkdirSync(repoDir, 0700);
    fs.mkdirSync(srcDir, 0700);
    fs.mkdirSync(dstDir, 0700);
    
    var repos = pushover(repoDir, { autoCreate : false, write_messages: true  });
    var port = Math.floor(Math.random() * ((1<<16) - 1e4)) + 1e4;
    var server = repos.listen(port);
    
    process.chdir(srcDir);
    seq()
        .seq(function () { repos.create('doom', this) })
        .seq(function () {
            var ps = spawn('git', [ 'init' ]);
            ps.stderr.pipe(process.stderr, { end : false });
            ps.on('exit', this.ok);
        })
        .seq(function () {
            fs.writeFile(srcDir + '/a.txt', 'abcd', this);
        })
        .seq(function () {
            spawn('git', [ 'add', 'a.txt' ]).on('exit', this.ok)
        })
        .seq_(function (next) {
            var ps = spawn('git', [ 'commit', '-am', 'a!!' ]);
            ps.on('exit', function () {
                exec('git log | head -n1', function (err, stdout) {
                    lastCommit = stdout.split(/\s+/)[1];
                    next();
                });
            });
            ps.stdout.pipe(process.stdout, { end : false });
        })
        .seq(function () {
            var ps = spawn('git', [
                'push', 'http://localhost:' + port + '/doom', 'master'
            ]);
            ps.stderr.pipe(process.stderr, { end : false });
            ps.stderr.on("data", function(data) {
                if (data.toString().indexOf("!!Pushover power!!") !== -1) {
                    t.ok(true, "!!Pushover power!! was found!");
                }
                if (data.toString().indexOf("!!ZERG!!") !== -1) {
                    t.ok(true, "!!ZERG!! was found!");
                }
            });
            ps.on('exit', this.ok);
        })
        .seq(function () {
            server.close();
            t.end();
        })
        .catch(t.fail)
    ;
    
    repos.on('push', function (repo, res) {
        t.type(res.end, "function", "messages enabled");
        t.equal(repo.name, 'doom', "repo name");
        t.equal(repo.commit, lastCommit, "commit");
        t.equal(repo.branch, 'master', "branch");
        res.write("!!ZERG!!\r\n");
        res.end("!!Pushover power!!\r\n");
    });
});
