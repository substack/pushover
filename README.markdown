pushover
========

Serve up git repositories over http and accept git pushes.

[![build status](https://secure.travis-ci.org/substack/pushover.png)](http://travis-ci.org/substack/pushover)

This library makes it super easy to set up custom git push deploy logic.

example
=======

simple.js
---------

``` js
var pushover = require('pushover');
var repos = pushover(__dirname + '/repos');

repos.on('push', function (repo) {
    console.log('received a push to ' + repo);
});

repos.listen(7000);
```

then start up the pushover server...

```
$ node example/simple.js 
```

meanwhile...

```
$ git push http://localhost:7000/beep master
Counting objects: 356, done.
Delta compression using up to 2 threads.
Compressing objects: 100% (133/133), done.
Writing objects: 100% (356/356), 46.20 KiB, done.
Total 356 (delta 210), reused 355 (delta 210)
To http://localhost:7000/beep
 * [new branch]      master -> master

```

and then...

```
$ node example/simple.js 
received a push to beep
```

methods
=======

var pushover = require('pushover')

var repos = pushover(repoDir, opts={autoCreate:true})
-----------------------------------------------------

Create a new repository collection from the directory `repoDir`.
`repoDir` should be entirely empty except for git repo directories.

`repos` is an EventEmitter. Right now it only emits "push" events with the repo
name as the only argument.

By default, repository targets will be created if they don't exist. You can
disable that behavior with `opts.autoCreate`.

If `opts.checkout` is true, create and expected checked-out repos instead of
bare repos.

If `opts.httpsOptions` is defined, create an https server instead. These options
are a passthru to the options passed to node core 
[`https.createServer`](http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener). 
To use a self-signed cert or to ignore CA verification, you need to set `GIT_SSL_NO_VERIFY=1`
in the shell where the `git push` will occur.

repos.handle(req, res, next)
----------------------------

Handle incoming HTTP requests with a connect-style middleware.

Everything is admin-party by default.
Check the credentials further up the stack using basic auth or whatevs.

repos.listen(...)
-----------------

Create and return a new http server using `repos.handle`.

Any arguments will be passed to `server.listen()`.

repos.create(repoName, cb)
--------------------------

Create a new bare repository `repoName` in the instance repository directory.

Optionally get a callback `cb(err)` to be notified when the repository was
created.

repos.list(cb) 
--------------

Get a list of all the repositories in the callback `cb(err, repos)`.

repos.exists(repoName, cb)
--------------------------

Find out whether `repoName` exists in the callback `cb(exists)`.

install
=======

With [npm](http://npmjs.org) do:

    npm install pushover

license
=======

MIT/X11

kudos
=====

Reading through
[grack](https://github.com/schacon/grack/blob/master/lib/git_http.rb)
was super handy.
