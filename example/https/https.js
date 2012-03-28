var fs = require('fs');
var pushover = require('pushover');
var options = {
    httpsOptions: {
      key: fs.readFileSync(__dirname + '/server.key'),
      cert: fs.readFileSync(__dirname + '/server.crt')
    }
};

var repos = pushover(__dirname + '/repos', options);

repos.on('push', function (repo) {
    console.log('received a push to ' + repo);
});

repos.listen(7000);
