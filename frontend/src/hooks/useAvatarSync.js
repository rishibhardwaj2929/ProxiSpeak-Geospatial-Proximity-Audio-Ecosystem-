import { useEffect, useRef } from "react";
import { socket } from "../network/socket";

const UPDATE_INTERVAL = 50;

export function useAvatarSync(position, userId) {
  const latestPosition = useRef(position);
  const lastSentAt = useRef(0);

  useEffect(() => {
    latestPosition.current = position;

    if (!userId || !socket.connected) {
      return;
    }

    const elapsed = Date.now() - lastSentAt.current;
    const delay = Math.max(0, UPDATE_INTERVAL - elapsed);

    const timer = setTimeout(() => {
      if (!socket.connected) return;

      socket.emit("avatar:move", latestPosition.current);
      lastSentAt.current = Date.now();
    }, delay);

    return () => clearTimeout(timer);
  }, [position, userId]);
}
