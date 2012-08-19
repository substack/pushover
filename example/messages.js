var pushover = require('pushover');
var connect = require('connect');
var repos = pushover(__dirname + '/repos');

var app = connect();

app.use(connect.basicAuth("username", "password"));
app.use(function(req, res, next) {
  if (req.headers["user-agent"].indexOf("git") != -1){
    repos.handle(req, res, next, true);
  }
  else{
    next();
  }
});

repos.on('push', function (repo, commit, branch, res) {
    repos.writeMessage("--> | Pushover in power!" ,res);
    // meanwhile in git console
    // remote: --> | Pushover in power!
    repos.closeStream(res);
});

app.listen(7000);
