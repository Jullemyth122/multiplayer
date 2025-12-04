const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});
let players = {};
let playerCount = 0;
let nextPlayerId = 1;
const MAX_PLAYERS = 16;
const SPAWN_RADIUS = 7;
io.on('connection', (socket) => {
    console.log('a user connected');
    if (playerCount >= MAX_PLAYERS) {
        socket.emit('serverFull', 'Server is full');
        socket.disconnect(true);
        return;
    }
    const playerId = nextPlayerId++;
    socket.playerId = playerId;
    const angle = ((playerId - 1) / MAX_PLAYERS) * Math.PI * 2;
    const x = SPAWN_RADIUS * Math.cos(angle);
    const z = SPAWN_RADIUS * Math.sin(angle);
    const yaw = Math.atan2(-x, z);
    players[playerId] = {
        id: playerId,
        position: [x, 0, z],
        rotation: [0, yaw, 0],
        moveDir: { f: 0, r: 0 },
        expression: 'neutral'  // neutral, wave
    };
    playerCount++;
    socket.emit('init', { playerId, players });
    socket.broadcast.emit('newPlayer', {
        id: playerId,
        position: players[playerId].position,
        rotation: players[playerId].rotation,
        moveDir: players[playerId].moveDir,
        expression: players[playerId].expression
    });
    socket.on('updatePlayer', (data) => {
        if (socket.playerId) {
            if (data.position) players[socket.playerId].position = data.position;
            if (data.rotation) players[socket.playerId].rotation = data.rotation;
            if (data.moveDir) players[socket.playerId].moveDir = data.moveDir;
            if (data.expression) players[socket.playerId].expression = data.expression;
            socket.broadcast.emit('playerUpdated', {
                playerId: socket.playerId,
                position: players[socket.playerId].position,
                rotation: players[socket.playerId].rotation,
                moveDir: players[socket.playerId].moveDir,
                expression: players[socket.playerId].expression
            });
        }
    });
    socket.on('disconnect', () => {
        if (socket.playerId) {
            delete players[socket.playerId];
            playerCount--;
            io.emit('playerDisconnected', socket.playerId);
        }
        console.log('user disconnected');
    });
});
// Add this to handle Chrome's Private Network Access policy for local dev
io.engine.on("initial_headers", (headers, req) => {
    headers["Access-Control-Allow-Private-Network"] = "true";
});
server.listen(4000, () => {
    console.log('listening on *:4000');
});