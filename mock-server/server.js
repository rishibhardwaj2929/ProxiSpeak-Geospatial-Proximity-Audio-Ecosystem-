const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const AVATAR_COLORS = [
    "#6366f1",
    "#22c55e",
    "#f97316",
    "#ec4899",
    "#06b6d4",
    "#a855f7",
    "#eab308",
];

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

app.get("/", (req, res) => {
  res.send("ProxiSpeak mock server is running.");
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("room:join", ({ name, roomId } = {}) => {
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof roomId !== "string" ||
      !roomId.trim()
    ) {
      socket.emit("room:error", {
        message: "Please provide a valid name and room ID.",
      });
      return;
    }

    const cleanName = name.trim();
    const cleanRoomId = roomId.trim();
    const previousRoom = socket.data.roomId;

    if (previousRoom) {
      socket.leave(previousRoom);
      socket.to(previousRoom).emit("avatar:left", {
        id: socket.id,
      });
    }

    socket.join(cleanRoomId);
    socket.data.roomId = cleanRoomId;
    socket.data.name = cleanName;
    socket.data.color = getAvatarColor(socket.id);
    socket.data.x = 100;
    socket.data.y = 100;

    const users = [];

    for (const id of io.sockets.adapter.rooms.get(cleanRoomId) || []) {
      if (id === socket.id) continue;

      const other = io.sockets.sockets.get(id);

      if (other) {
        users.push({
          id,
          name: other.data.name || "Guest",
          color: other.data.color || "#6366f1",
          x: other.data.x ?? 100,
          y: other.data.y ?? 100,
        });
      }
    }

    socket.emit("room:joined", {
      id: socket.id,
      users,
    });

    socket.to(cleanRoomId).emit("avatar:move", {
      id: socket.id,
      name: cleanName,
      color: socket.data.color,
      x: socket.data.x,
      y: socket.data.y,
    });

    console.log(`${cleanName} joined room "${cleanRoomId}"`);
  });

  socket.on("avatar:move", ({ x, y } = {}) => {
    const roomId = socket.data.roomId;

    if (
      !roomId ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    socket.data.x = Math.max(0, Math.min(2000, x));
    socket.data.y = Math.max(0, Math.min(1200, y));

    socket.to(roomId).emit("avatar:move", {
      id: socket.id,
      name: socket.data.name,
      x: socket.data.x,
      y: socket.data.y,
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;

    if (roomId) {
      socket.to(roomId).emit("avatar:left", {
        id: socket.id,
      });
    }

    console.log("Client disconnected:", socket.id);
  });
});

const PORT = 3000;

httpServer.listen(PORT, () => {
  console.log(`ProxiSpeak mock server running at http://localhost:${PORT}`);
});

function getAvatarColor(socketId) {
    let hash=0;
    for (const char of socketId){
        hash=(hash*31 +char.charCodeAt(0)) >>> 0;
    }

    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}