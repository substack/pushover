var pushover = require('pushover');
var repos = pushover(__dirname + '/repos');

repos.on('push', function (repo) {
    console.log(
        'received a push to ' + repo.name + '/' + repo.commit
        + ' (' + repo.branch + ')'
    );
});

repos.listen(7005);
