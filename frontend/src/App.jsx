import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const PLAYER_COUNTS = [6, 7, 8, 9, 10, 11, 12];

const FACTION_COLORS = {
  werewolf: "var(--role-werewolf)",
  village: "var(--role-village)",
};

function App() {
  const [view, setView] = useState("welcome");
  const [socket, setSocket] = useState(null);
  const [playerType, setPlayerType] = useState(null);
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [playerCount, setPlayerCount] = useState(8);
  const [roleConfig, setRoleConfig] = useState([]);
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [hostName, setHostName] = useState("Nguoi dan lang");
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const lobbyRef = useRef(null);

  useEffect(() => {
    const s = io(API_URL, { transports: ["websocket", "polling"] });
    setSocket(s);

    s.on("connect", () => setConnecting(false));
    s.on("connect_error", () => setConnecting(false));

    return () => { s.disconnect(); };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!socket) return;
    socket.on("room:created", (data) => {
      setPlayerId(socket.id);
      setPlayerType("host");
      setRoom({ ...data.room, id: data.room?.id || data.id });
      setView("lobby");
    });
    socket.on("room:joined", (data) => {
      setPlayerId(data.playerId || socket.id);
      setPlayerType("player");
      setRoom(data.room);
      setView("lobby");
    });
    socket.on("room:updated", (data) => {
      setRoom(data);
    });
    socket.on("role:assigned", (data) => {
      setMyRole(data.role);
      setRevealed(false);
      setView("role");
    });
    socket.on("room:error", (data) => {
      setError(data.message);
    });
    return () => {
      socket.off("room:created");
      socket.off("room:joined");
      socket.off("room:updated");
      socket.off("role:assigned");
      socket.off("room:error");
    };
  }, [socket]);

  useEffect(() => {
    if (playerCount < 6 || playerCount > 12) return;
    fetch(`${API_URL}/roles/config/${playerCount}`)
      .then((r) => r.json())
      .then((data) => setRoleConfig(data.config || []))
      .catch(() => {});
  }, [playerCount]);

  async function handleCreateRoom(e) {
    e.preventDefault();
    clearError();
    if (!socket?.connected) { setError("Mat ket noi voi may chu."); return; }
    socket.emit("room:create", { hostName, playerCount });
  }

  function handleJoinRoom(e) {
    e.preventDefault();
    clearError();
    if (!socket?.connected) { setError("Mat ket noi voi may chu."); return; }
    if (!roomCode.trim()) { setError("Vui long nhap ma phong."); return; }
    if (!displayName.trim()) { setError("Vui long nhap ten cua ban."); return; }
    socket.emit("room:join", { roomCode: roomCode.trim().toUpperCase(), playerName: displayName.trim() });
  }

  function handleDeal() {
    if (!room) return;
    socket.emit("room:deal", { roomId: room.id });
  }

  function handleReset() {
    if (!room) return;
    socket.emit("room:reset", { roomId: room.id });
  }

  function handleLeave() {
    if (!room) return;
    socket.emit("room:leave", { roomId: room.id });
    setView("welcome");
    setRoom(null);
    setMyRole(null);
    setPlayerType(null);
    setRevealed(false);
  }

  function handleBackFromRole() {
    if (playerType === "host") {
      setView("lobby");
    } else {
      handleLeave();
    }
  }

  function handleReveal() {
    setRevealed(true);
  }

  const roomURL = room?.code ? `${window.location.origin}/join/${room.code}` : "";

  const roleLabels = {
    werewolf: "Ma Soi",
    villager: "Dan Lang",
    seer: "Tien Tri",
    guard: "Bao Ve",
    witch: "Phu Thuy",
    hunter: "Tho San",
  };

  if (connecting) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Dang ket noi...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-brand">Ma Soi Online</div>
        <div className="nav-links">
          {view !== "welcome" && room && (
            <span className="nav-room-code" onClick={handleLeave}>
              Phong: {room.code}
            </span>
          )}
        </div>
      </nav>

      {/* ERROR */}
      {error && (
        <div className="toast toast-error" onClick={clearError}>
          {error}
        </div>
      )}

      {/* WELCOME */}
      {view === "welcome" && (
        <section className="welcome">
          <div className="welcome-bg" />
          <div className="welcome-content">
            <p className="welcome-sub">Chia vai bi mat cho ban cung ban be</p>
            <h1 className="welcome-title">
              Ma Soi
              <span className="title-accent"> Online</span>
            </h1>
            <p className="welcome-desc">
              Tao phong, moi ban be bang ma QR, va de he thong tu dong chia vai
              mot cach ngau nhien va bao mat.
            </p>
            <div className="welcome-cta-group">
              <button className="btn btn-primary btn-lg" onClick={() => setView("create")}>
                Tao phong moi
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => setView("join")}>
                Tham gia phong
              </button>
            </div>
          </div>
        </section>
      )}

      {/* CREATE ROOM */}
      {view === "create" && (
        <section className="create-room">
          <div className="create-room-card">
            <button className="btn-back" onClick={() => setView("welcome")}>
              ← Quay lai
            </button>
            <h2>Tao phong moi</h2>

            <label className="field">
              <span>Ten cua ban</span>
              <input value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Nhap ten..." />
            </label>

            <label className="field">
              <span>So luong nguoi choi</span>
              <div className="count-selector">
                {PLAYER_COUNTS.map((n) => (
                  <button
                    key={n}
                    className={`count-btn ${n === playerCount ? "active" : ""}`}
                    onClick={() => setPlayerCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>

            <div className="role-preview">
              <p>Cau hinh vai mac dinh:</p>
              <div className="role-chips">
                {roleConfig.map((r) => (
                  <span key={r.id} className="role-chip" data-role={r.id}>
                    {roleLabels[r.id] || r.id} x{r.count}
                  </span>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={handleCreateRoom}>
              Tao phong
            </button>
          </div>
        </section>
      )}

      {/* JOIN ROOM */}
      {view === "join" && (
        <section className="join-room">
          <div className="join-room-card">
            <button className="btn-back" onClick={() => setView("welcome")}>
              ← Quay lai
            </button>
            <h2>Tham gia phong</h2>

            <label className="field">
              <span>Ma phong</span>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="VD: ABC123"
                maxLength={6}
                className="input-room-code"
              />
            </label>

            <label className="field">
              <span>Ten cua ban</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhap ten hien thi..."
              />
            </label>

            <button className="btn btn-primary btn-full" onClick={handleJoinRoom}>
              Tham gia
            </button>
          </div>
        </section>
      )}

      {/* LOBBY */}
      {view === "lobby" && room && (
        <section className="lobby">
          <div className="lobby-header">
            <div className="lobby-info">
              <p className="lobby-room-code">Ma phong: <strong>{room.code}</strong></p>
              <p className="lobby-players-count">
                {room.playerCount || room.players?.length || 0} / {room.maxPlayers} nguoi choi
              </p>
            </div>
            {playerType === "host" && (
              <div className="lobby-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleDeal}
                  disabled={(room.playerCount || room.players?.length || 0) < room.maxPlayers}
                >
                  Chia bai
                </button>
                {room.hasAssignments && (
                  <button className="btn btn-secondary" onClick={handleReset}>
                    Dat lai
                  </button>
                )}
              </div>
            )}
            {playerType === "player" && (
              <div className="lobby-actions">
                <p className="waiting-msg">Dang cho Host chia bai...</p>
                <button className="btn btn-ghost" onClick={handleLeave}>Roi phong</button>
              </div>
            )}
          </div>

          {playerType === "host" && room.code && (
            <div className="lobby-qr">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(roomURL || `${window.location.origin}/join/${room.code}`)}`}
                alt="QR code"
                className="qr-img"
              />
              <p className="qr-hint">Quet QR hoac gui ma phong cho ban be</p>
            </div>
          )}

          <div className="lobby-players" ref={lobbyRef}>
            {(!room.players || room.players.length === 0) ? (
              <p className="empty-state">Dang cho nguoi choi tham gia...</p>
            ) : (
              <div className="players-grid">
                {room.players.map((p, i) => (
                  <div
                    key={p.id}
                    className="player-card"
                    style={{ "--i": i }}
                  >
                    <div className="player-avatar">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="player-name">{p.name}</p>
                    {p.id === room.hostId && <span className="player-host-badge">Host</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ROLE REVEAL */}
      {view === "role" && myRole && (
        <section className="role-reveal">
          <div className="role-scene">
            <div className={`role-card-wrapper ${revealed ? "flipped" : ""}`}>
              <div className="role-card-inner">
                <div className="role-card-front" onClick={handleReveal}>
                  <div className="card-back-pattern" />
                  <p className="card-tap-hint">Cham de lat bai</p>
                </div>
                <div className="role-card-back">
                  <div
                    className="role-card-glow"
                    style={{
                      background: `radial-gradient(ellipse at center, rgba(${myRole.glow || "200,200,200"}, 0.3), transparent 70%)`,
                    }}
                  />
                  <div className="role-card-icon">{myRole.icon || "?"}</div>
                  <h2 className="role-card-name">{myRole.name}</h2>
                  <p
                    className="role-card-faction"
                    style={{ color: FACTION_COLORS[myRole.faction] || "var(--color-text-secondary)" }}
                  >
                    {myRole.faction === "werewolf" ? "Phe Soi" : "Phe Dan"}
                  </p>
                  <p className="role-card-desc">{myRole.description}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="role-actions">
            <button className="btn btn-ghost" onClick={handleBackFromRole}>
              {playerType === "host" ? "Quay ve lobby" : "Thoat"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
