var test = require('tap').test;
var pushover = require('../');

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var seq = require('seq');

var sslKey = new Buffer("-----BEGIN RSA PRIVATE KEY-----\n\
MIICXAIBAAKBgQDBBxmcGi/LT4f9oMR04XbM82g3mEGR29aw05evwst9YR22ZM9F\n\
FjPlLCOWJQUthetCeADlLbOIJpXUxCD65YaNhLDa7yNsG88PLWxkq2alCwBT7LLy\n\
nbbVRfwafGCg2n2xsDJBw0TcuRK/kzqlq2/+MlUOhiiumSaP3gCwPhAusQIDAQAB\n\
AoGAMSbNrqI8aVjnF/5ICDshNS8F6qIqkCmakYxPo8HGbza7iiZBYSY2MLT8ms7y\n\
cpUXQuWr1K++d3zbykHm4/xuNknG6HdJBJCrJ+BtX08PeFuznnynjUL/X1OU5sum\n\
cDW3cQHiPk58k+Xlif1LU2oQ7pDMwg/Fvkx6niKuDc2OhsECQQDjL/d6Cnh4GnEU\n\
doHhWqdWEyjVSJ2YRuJTZif4JlRc++Ks2zSuCb6mAQileEO6Tn+oorkLXbhOhWAm\n\
xxwmwDDfAkEA2YIU0dptO2U1HUxJcLkpeFzvcaWT8GFum2M57sss4wEXhZ81kf7y\n\
WOBhtzBU2b8u/KMShrMu9JY5VF5jUI7CbwJAKyl6x/njR1Yms6+MH2dcsVK0iEji\n\
gAK/jv6yi0ek8YF9YD/JM2NwkBNUNDO0ElpFkKFRrKIimPBoAxYC+C29WwJAGDUw\n\
GAMVcSzccnxRGCijgu/k/mMNSg2t/8FVa0xVnJY8hfSoQ616T4X5mifY6bsrgZas\n\
sy0yJqqpishOiWK6JQJBAKSZ3x1Db/hwCre+U9UfY2haCHzDRQV0mBuGkB2VJBf3\n\
Dtx/IrCOZtNbgB+KtjnIwHwpYCHJzCkqMUnwKvlA3vM=\n\
-----END RSA PRIVATE KEY-----");

var sslCert = new Buffer("-----BEGIN CERTIFICATE-----\n\
MIIB4TCCAUoCCQCLuqR3TcdMVjANBgkqhkiG9w0BAQUFADA1MQswCQYDVQQGEwJV\n\
UzETMBEGA1UECBMKU29tZS1TdGF0ZTERMA8GA1UEChMIcHVzaG92ZXIwHhcNMTIw\n\
MzI4MTYxOTQyWhcNMTMwMzI4MTYxOTQyWjA1MQswCQYDVQQGEwJVUzETMBEGA1UE\n\
CBMKU29tZS1TdGF0ZTERMA8GA1UEChMIcHVzaG92ZXIwgZ8wDQYJKoZIhvcNAQEB\n\
BQADgY0AMIGJAoGBAMEHGZwaL8tPh/2gxHThdszzaDeYQZHb1rDTl6/Cy31hHbZk\n\
z0UWM+UsI5YlBS2F60J4AOUts4gmldTEIPrlho2EsNrvI2wbzw8tbGSrZqULAFPs\n\
svKdttVF/Bp8YKDafbGwMkHDRNy5Er+TOqWrb/4yVQ6GKK6ZJo/eALA+EC6xAgMB\n\
AAEwDQYJKoZIhvcNAQEFBQADgYEAEmaoBMJXk71S9q+Jpr9C8lU7F360xW9cArc3\n\
iYZwTmF3TlzQURs43kSKY9Ue0ICza8apCyLyKWC1KYTMdDLw3q3Yk29zU7RMNoV6\n\
agzKLGikSwyvcviTjotbHESbZjFpI8tYkbhAYy+rRlMr50Rw7BoC457CocsmHz9T\n\
DBk9d8Q=\n\
-----END CERTIFICATE-----");

test('create, push to, and clone a repo over https', function (t) {
    t.plan(2);
    
    var repoDir = '/tmp/' + Math.floor(Math.random() * (1<<30)).toString(16);
    var srcDir = '/tmp/' + Math.floor(Math.random() * (1<<30)).toString(16);
    var dstDir = '/tmp/' + Math.floor(Math.random() * (1<<30)).toString(16);
    
    fs.mkdirSync(repoDir, 0700);
    fs.mkdirSync(srcDir, 0700);
    fs.mkdirSync(dstDir, 0700);
    
    var httpsOptions = {
        key: sslKey,
        cert: sslCert
    };
    var repos = pushover(repoDir, { autoCreate : false, httpsOptions: httpsOptions });
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
        .seq(function () {
            spawn('git', [ 'commit', '-am', 'a!!' ]).on('exit', this.ok)
        })
        .seq(function () {
            var ps = spawn('git', [
                'push', 'https://localhost:' + port + '/doom', 'master'
            ], { 
                env: {
                    'GIT_SSL_NO_VERIFY': '1'
                }
            });
            ps.stderr.pipe(process.stderr, { end : false });
            ps.on('exit', this.ok);
        })
        .seq(function () {
            process.chdir(dstDir);
            spawn('git', [ 'clone', 'https://localhost:' + port + '/doom' ], { 
                env: {
                    'GIT_SSL_NO_VERIFY': '1'
                }
            }).on('exit', this.ok)
        })
        .seq_(function (next) {
            path.exists(dstDir + '/doom/a.txt', function (ex) {
                t.ok(ex, 'a.txt exists');
                next();
            })
        })
        .seq(function () {
            server.close();
            t.end();
        })
        .catch(t.fail)
    ;
    
    repos.on('push', function (repo) {
        t.equal(repo, 'doom');
    });
});
