import { useEffect, useRef, useState } from "react";

const SMOOTHING = 12;

export function useInterpolatedAvatars(users) {
  const [displayUsers, setDisplayUsers] = useState(users);
  const targetsRef = useRef(new Map());
  const currentRef = useRef(new Map());

  useEffect(() => {
    const activeIds = new Set();

    for (const user of users) {
      activeIds.add(user.id);

      const target = {
        x: user.x ?? 100,
        y: user.y ?? 100,
      };

      targetsRef.current.set(user.id, target);

      if (!currentRef.current.has(user.id)) {
        currentRef.current.set(user.id, { ...target });
      }
    }

    for (const id of currentRef.current.keys()) {
      if (!activeIds.has(id)) {
        currentRef.current.delete(id);
        targetsRef.current.delete(id);
      }
    }
  }, [users]);

  useEffect(() => {
    let frameId;
    let previousTime = 0;

    function animate(time) {
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
      previousTime = time;

      const factor = 1 - Math.exp(-SMOOTHING * delta);

      for (const [id, target] of targetsRef.current) {
        const current = currentRef.current.get(id);
        if (!current) continue;

        current.x += (target.x - current.x) * factor;
        current.y += (target.y - current.y) * factor;
      }

      setDisplayUsers((previousUsers) =>
        users.map((user) => {
          const current = currentRef.current.get(user.id);

          return current
            ? { ...user, x: current.x, y: current.y }
            : user;
        })
      );

      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [users]);

  return displayUsers;
}