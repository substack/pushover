var pushover = require('pushover');
var connect = require('connect');
var repos = pushover(__dirname + '/repos', {write_messages:true});

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

repos.on('push', function (repo, res) {
    res.write("--> | Pushover in power!");
    // meanwhile in git console
    // remote: --> | Pushover in power!
    res.end("End me! " + repo.name);
});

app.listen(7000);
