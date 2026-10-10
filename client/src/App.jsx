
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const WIDTH = 720;
const HEIGHT = 420;
const RADIUS = 16;
const SPEED = 180;

const socket = io("http://localhost:5000", {
  autoConnect: false,
});

function drawOffice(ctx, users, myId) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Office background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Grid
  ctx.strokeStyle = "#edf1f7";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Team area
  ctx.fillStyle = "#eef2fa";
  ctx.strokeStyle = "#d6deef";
  ctx.beginPath();
  ctx.roundRect(390, 38, 240, 100, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 12px Arial";
  ctx.fillText("TEAM AREA", 408, 60);

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "#dbe5f5";
    ctx.fillRect(408 + i * 70, 74, 62, 22);
  }

  // Meeting area
  ctx.fillStyle = "#f5f0ff";
  ctx.strokeStyle = "#e7dafa";
  ctx.beginPath();
  ctx.roundRect(390, 175, 240, 90, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.fillText("MEETING SPACE", 408, 198);

  ctx.fillStyle = "#e6def8";
  ctx.beginPath();
  ctx.roundRect(430, 215, 160, 24, 12);
  ctx.fill();

  // Avatars
  users.forEach((user, index) => {
    const isMe = user.id === myId;

    ctx.beginPath();
    ctx.arc(user.x, user.y, RADIUS + 4, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? "#c7d2fe" : "#cbd5e1";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(user.x, user.y, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? "#635bdb" : "#64748b";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isMe ? "YOU" : `P${index + 1}`, user.x, user.y);
  });

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

export default function App() {
  const canvasRef = useRef(null);
  const positionRef = useRef({ x: 100, y: 100 });
  const targetRef = useRef({ x: 100, y: 100 });
  const usersRef = useRef([]);
  const keysRef = useRef(new Set());
  const lastSentRef = useRef(0);
  const myIdRef = useRef("");

  const [users, setUsers] = useState([]);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [connected, setConnected] = useState(false);

  const updateUsers = useCallback((nextUsers) => {
    usersRef.current = nextUsers;
    setUsers(nextUsers);

    const me = nextUsers.find((user) => user.id === socket.id);
    if (me) {
      myIdRef.current = socket.id;
      positionRef.current = { x: me.x, y: me.y };
      targetRef.current = { x: me.x, y: me.y };
      setPosition({ x: me.x, y: me.y });
    }
  }, []);

  useEffect(() => {
    const onConnect = () => {
      myIdRef.current = socket.id;
      setConnected(true);
    };

    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("users:update", updateUsers);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("users:update", updateUsers);
      socket.disconnect();
    };
  }, [updateUsers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frameId;
    let previousTime = 0;
    let lastUiUpdate = 0;

    function animate(time) {
      const dt = previousTime
        ? Math.min((time - previousTime) / 1000, 0.05)
        : 0;

      previousTime = time;

      const current = positionRef.current;
      const keys = keysRef.current;

      let dx = 0;
      let dy = 0;

      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        targetRef.current = {
          x: current.x + (dx / length) * SPEED * dt,
          y: current.y + (dy / length) * SPEED * dt,
        };
      }

      const target = targetRef.current;
      const next = {
        x: Math.max(RADIUS, Math.min(WIDTH - RADIUS, target.x)),
        y: Math.max(RADIUS, Math.min(HEIGHT - RADIUS, target.y)),
      };

      // Smoothly approach the target position.
      const factor = 1 - Math.exp(-14 * dt);
      current.x += (next.x - current.x) * factor;
      current.y += (next.y - current.y) * factor;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawOffice(ctx, usersRef.current, myIdRef.current);
      }

      // Send local coordinates at most 20 times per second.
      if (connected && time - lastSentRef.current >= 50) {
        const me = usersRef.current.find(
          (user) => user.id === socket.id
        );

        if (
          me &&
          (Math.abs(me.x - current.x) > 0.5 ||
            Math.abs(me.y - current.y) > 0.5)
        ) {
          socket.emit("position:update", {
            x: current.x,
            y: current.y,
          });
          lastSentRef.current = time;
        }
      }

      if (time - lastUiUpdate >= 100) {
        setPosition({
          x: Math.round(current.x),
          y: Math.round(current.y),
        });
        lastUiUpdate = time;
      }

      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [connected]);

  useEffect(() => {
    function onKeyDown(event) {
      const key = event.key.toLowerCase();
      if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        return;
      }

      event.preventDefault();
      keysRef.current.add(key);
    }

    function onKeyUp(event) {
      keysRef.current.delete(event.key.toLowerCase());
    }

    function clearKeys() {
      keysRef.current.clear();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, []);

  function handleCanvasClick(event) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Convert displayed coordinates into canvas coordinates.
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;

    targetRef.current = {
      x: Math.max(
        RADIUS,
        Math.min(WIDTH - RADIUS, (event.clientX - rect.left) * scaleX)
      ),
      y: Math.max(
        RADIUS,
        Math.min(HEIGHT - RADIUS, (event.clientY - rect.top) * scaleY)
      ),
    };
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">SPATIAL COLLABORATION</p>
          <h1>ProxiSpeak</h1>
          <p>Your virtual office, where conversations happen naturally.</p>
        </div>

        <span className={`status ${connected ? "online" : ""}`}>
          {connected ? "● Connected" : "○ Connecting..."}
        </span>
      </header>

      <section className="office">
        <div className="office-title">
          <div>
            <h2>Virtual Office</h2>
            <p>Move around to explore the shared space.</p>
          </div>
          <span className="online-count">
            <strong>{users.length}</strong> online
          </span>
        </div>

        <canvas
          ref={canvasRef}
          className="office-canvas"
          width={WIDTH}
          height={HEIGHT}
          onClick={handleCanvasClick}
          aria-label="Virtual office. Use keyboard controls or click a destination to move."
        />

        <div className="controls">
          <span>W A S D</span>
          <span>or arrow keys to move</span>
          <span>Click office to move</span>
          <span className="coordinates">
            Position: {position.x}, {position.y}
          </span>
        </div>
      </section>
    </main>
  );
}
