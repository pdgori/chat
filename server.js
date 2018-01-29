// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var bodyParser   = require('body-parser');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var fs = require('fs');
var hbs = require('hbs');
var ntlm = require('express-ntlm');

hbs.registerPartials(__dirname + '/views/partials');

app.set('view engine', 'hbs');

app.use(express.static(__dirname + '/public'));

app.use(ntlm({
    debug: function() {
        //var args = Array.prototype.slice.apply(arguments);
        //console.log.apply(null, args);
    },
    domain: 'CONTINUUM.IE',
    domaincontroller: 'ldap://goliath.continuum.ie',
}));

app.get('/', (req, res) =>{
  res.render('index.hbs', {
    userName: req.ntlm.UserName
  });
});

app.use((req, res, next) => {
  var now = new Date().toString();
  var log = `${now}: ${req.method} ${req.url}`;

  console.log(log);
  fs.appendFile('server.log', log + '\n');
  next();
});


server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Chatroom

var numUsers = 0;
var userList = [];
io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    userList.push(username);

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers,
      userList: userList
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {

    if (addedUser) {
      console.log(socket.username);
      --numUsers;
      userList.splice(socket.username, 1);

      console.log(userList);

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

});
