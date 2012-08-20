# pushover

Serve up git repositories over http and accept git pushes.

[![build status](https://secure.travis-ci.org/substack/pushover.png)](http://travis-ci.org/substack/pushover)

This library makes it super easy to set up custom git push deploy logic.

# example

``` js
var pushover = require('pushover');
var repos = pushover(__dirname + '/repos');

repos.on('push', function (repo) {
    console.log(
        'received a push to ' + repo.name + '/' + repo.commit
        + ' (' + repo.branch + ')'
    );
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
received a push to beep/d5013a53a0e139804e729a12107fc212f11e64c3 (master)
```

# methods

    var pushover = require('pushover')

## var repos = pushover(repoDir, opts={autoCreate:true})

Create a new repository collection from the directory `repoDir`.
`repoDir` should be entirely empty except for git repo directories.

`repos` is an EventEmitter that emits the events listed below in the events
section.

By default, repository targets will be created if they don't exist. You can
disable that behavior with `opts.autoCreate`.

If `opts.checkout` is true, create and expected checked-out repos instead of
bare repos.

If `opts.write_messages` is true, you can write messages to git client.

## repos.handle(req, res, next)

Handle incoming HTTP requests with a connect-style middleware.

Everything is admin-party by default.
Check the credentials further up the stack using basic auth or whatevs.

## repos.listen(...)

Create and return a new http server using `repos.handle`.

Any arguments will be passed to `server.listen()`.

## repos.create(repoName, cb)

Create a new bare repository `repoName` in the instance repository directory.

Optionally get a callback `cb(err)` to be notified when the repository was
created.

## repos.list(cb) 

Get a list of all the repositories in the callback `cb(err, repos)`.

## repos.exists(repoName, cb)

Find out whether `repoName` exists in the callback `cb(exists)`.

# events

## repos.on('push', function (repo, res) { ... }

Emitted when somebody does a `git push` to the repo.

`repo` is object with `name, commit, branch`

`res` can be used to write custom messages with `res.write(string)`, `res.error(string)`, `res.end(string|undefined)`, but only if you enabled it with `opts.write_messages`.

# install

With [npm](http://npmjs.org) do:

    npm install pushover

# license

MIT

# kudos

Reading through
[grack](https://github.com/schacon/grack/blob/master/lib/git_http.rb)
was super handy.
