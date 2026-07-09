import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function App() {
  const [status, setStatus] = useState("checking");
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("Ma Soi Night");
  const [hostName, setHostName] = useState("Host");
  const socket = useMemo(() => io(API_URL), []);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((response) => response.json())
      .then(() => setStatus("connected"))
      .catch(() => setStatus("offline"));

    fetch(`${API_URL}/rooms`)
      .then((response) => response.json())
      .then((data) => setRooms(data.rooms || []))
      .catch(() => setRooms([]));

    socket.on("rooms:updated", setRooms);

    return () => {
      socket.off("rooms:updated", setRooms);
      socket.disconnect();
    };
  }, [socket]);

  async function handleCreateRoom(event) {
    event.preventDefault();

    await fetch(`${API_URL}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: roomName, hostName })
    });
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Ma Soi Online MVP</p>
        <h1>Local room lobby</h1>
        <p className="intro">
          A working React, Express, and Socket.io skeleton. Game phases and role
          actions will come later.
        </p>

        <div className="status-row">
          <span className={`status-dot status-${status}`} />
          <span>Backend: {status}</span>
        </div>

        <form className="room-form" onSubmit={handleCreateRoom}>
          <label>
            Room name
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="Room name"
            />
          </label>

          <label>
            Host name
            <input
              value={hostName}
              onChange={(event) => setHostName(event.target.value)}
              placeholder="Host name"
            />
          </label>

          <button type="submit">Create room</button>
        </form>
      </section>

      <section className="rooms-list" aria-label="Rooms">
        <h2>Rooms</h2>
        {rooms.length === 0 ? (
          <p className="empty-state">No rooms yet. Create the first lobby.</p>
        ) : (
          <ul>
            {rooms.map((room) => (
              <li key={room.id}>
                <strong>{room.name}</strong>
                <span>Host: {room.hostName}</span>
                <span>{room.players.length} players</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
