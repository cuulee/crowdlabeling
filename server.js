// Init everything
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var express = require('express');
var app = express();
var fs = require('fs');
// Start the server
var server = app.listen(8080);
// Init socket.io
var io = require('socket.io')(server);

app.use('/styles', express.static(__dirname + '/styles'));
app.use('/scripts', express.static(__dirname + '/scripts'));
app.use('/bower_components', express.static(__dirname + '/bower_components'));
app.use('/fonts', express.static(__dirname + '/bower_components/bootstrap/fonts'));

// Root renders the layout
app.get('/', function(req, res) {
    res.render('layout.ejs', {content: "hello"});
});

// Renders the room
app.get('/room/:room/:image', function(req, res) {
    var data = { 
        room : req.params.room, 
        image_path : 'images/' + req.params.image, 
        content : 'room', 
        base_path : "http://" + req.headers.host + "/" 
    };
    res.render('layout.ejs', data);
});

// Renders the image
app.get('/images/:image', function(req, res) {
    res.setHeader('Content-Type', 'image/png');
    var img = fs.readFileSync('images/' + req.params.image + '.png');
    res.end(img, 'binary');
});

// Else, send a 404 not found error
app.use(function(req, res, next){
    res.setHeader('Content-Type', 'text/html');
    res.send(404, 'Page not found');
});

var numberOfClientsInRooms = [];
var numberOfConfirmationsInRooms = [];

// Broadcast chat messages
io.sockets.on('connection', function(socket) {
    socket.room = "lobby";

    socket.on('chat_message', function(message) {
        socket.broadcast.to(socket.room).emit('chat_message', message);
        console.log('[' + socket.room + '] A client sent the following message : ' + message);
    });

    socket.on('join_room', function(room) {
        numberOfClientsInRooms[room] = numberOfClientsInRooms[room] ? numberOfClientsInRooms[room] + 1 : 1;

        socket.room = room;
        socket.join(socket.room);
        socket.broadcast.to(socket.room).emit('user_enter', 'A user entered the room');

        console.log('[' + socket.room + '] A client entered the room.');
        console.log('[' + socket.room + '] Number of clients : ' + numberOfClientsInRooms[room]);
    });

    socket.on('tag_intent', function(tag) {
        numberOfConfirmationsInRooms[socket.room] = 1;
        socket.broadcast.to(socket.room).emit('tag_intent', tag);
        console.log('[' + socket.room + '] A client wants to insert a new tag : ' + tag.label);

        // send confirmation of the user who wants to create the tag
        var data = {
            tag: tag,
            nConfirms: numberOfConfirmationsInRooms[socket.room],
            nClients: numberOfClientsInRooms[socket.room]
        };
        io.sockets.in(socket.room).emit('tag_confirm', data);

        if (numberOfConfirmationsInRooms[socket.room] == numberOfClientsInRooms[socket.room]) {
            console.log('[' + socket.room + '] Tag creation : ' + tag.label);
            io.sockets.in(socket.room).emit('tag_creation', tag);
        }
    });

    socket.on('tag_confirm', function(tag) {
        numberOfConfirmationsInRooms[socket.room]++;

        console.log('[' + socket.room + '] A client confirmed the tag : ' + tag.label);
        console.log('[' + socket.room + '] Number of confirmations : ' + numberOfConfirmationsInRooms[socket.room]);
        console.log('[' + socket.room + '] Number of clients : ' + numberOfClientsInRooms[socket.room]);

        var data = {
            tag: tag,
            nConfirms: numberOfConfirmationsInRooms[socket.room],
            nClients: numberOfClientsInRooms[socket.room]
        };
        io.sockets.in(socket.room).emit('tag_confirm', data);

        if (numberOfConfirmationsInRooms[socket.room] == numberOfClientsInRooms[socket.room]) {
            console.log('[' + socket.room + '] Tag creation : ' + tag.label);
            io.sockets.in(socket.room).emit('tag_creation', tag);
        }
    });

    socket.on('tag_cancel', function(tag) {
        numberOfConfirmationsInRooms[socket.room] = 0;

        console.log('[' + socket.room + '] A client canceled the tag : ' + tag.label);
        socket.broadcast.to(socket.room).emit('tag_cancel', tag);
    });

    socket.on('tag_delete', function(tag) {
        console.log('[' + socket.room + '] A client deleted the tag : ' + tag);
        socket.broadcast.to(socket.room).emit('tag_delete', tag);
    });

    socket.on('disconnect', function() {
        numberOfClientsInRooms[socket.room]--;
        console.log('[' + socket.room + '] A client disconnected');
        console.log('[' + socket.room + '] Number of clients : ' + numberOfClientsInRooms[socket.room]);
    });

    // console.log('A new client has connected !');
});


