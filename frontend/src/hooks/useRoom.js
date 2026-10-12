import { useEffect, useState } from "react";
import { socket } from "../network/socket";

export function useRoom() {
  const [userId, setUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [roomError, setRoomError] = useState("");

  useEffect(() => {
    function handleRoomJoined(data) {
      setUserId(data.id);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setRoomError("");
    }

    function handleRoomError(data) {
      setRoomError(data?.message || "Unable to join the office.");
    }

    function handleAvatarMove(data) {
      setUsers((currentUsers) => {
        const existing = currentUsers.find((user) => user.id === data.id);

        if (existing) {
          return currentUsers.map((user) =>
            user.id === data.id ? { ...user, ...data } : user
          );
        }

        return [...currentUsers, data];
      });
    }

    function handleAvatarLeft(data) {
      setUsers((currentUsers) =>
        currentUsers.filter((user) => user.id !== data.id)
      );
    }

    socket.on("room:joined", handleRoomJoined);
    socket.on("room:error", handleRoomError);
    socket.on("avatar:move", handleAvatarMove);
    socket.on("avatar:left", handleAvatarLeft);

    return () => {
      socket.off("room:joined", handleRoomJoined);
      socket.off("room:error", handleRoomError);
      socket.off("avatar:move", handleAvatarMove);
      socket.off("avatar:left", handleAvatarLeft);
    };
  }, []);

  function joinRoom(name, roomId) {
    if (!socket.connected) {
      setRoomError("Not connected to the server yet.");
      return;
    }

    setRoomError("");
    socket.emit("room:join", {
      name: name.trim(),
      roomId: roomId.trim(),
    });
  }

  return {
    userId,
    users,
    roomError,
    joinRoom,
  };
}