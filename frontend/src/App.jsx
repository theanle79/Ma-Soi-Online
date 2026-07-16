import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { assignPlayerToSlot } from "./assignment-utils.js";
import {
  API_URL,
  buildSlots,
  EMPTY_SETUP,
  formatScore,
  getDeviceId,
  hydrateSlots,
  joinCodeFromPath,
  playerInitial,
  roleWakesTonight,
  scriptForRole,
  TEAM_LABELS,
  TEAM_ORDER,
  WINNER_LABELS,
} from "./game-utils.js";
import "./styles.css";

function PaperShell({ children, profileName, onLeave, showHeader = true, phase }) {
  const profile = <><span className="profile-avatar">{playerInitial(profileName || "S")}</span><span><strong>{profileName || "Sói Già Làng"}</strong><small>{onLeave ? "Rời bàn chơi" : "Vai kín"}</small></span></>;
  const atmospherePhase = phase === "night" ? "night" : "day";
  return <div className="app paper-app"><main className={`game-board phase-${atmospherePhase}`} data-game-phase={atmospherePhase}>
    <div className="game-atmosphere" aria-hidden="true">
      <span className="night-village" />
      <span className="night-wash" />
      <span className="night-mist" />
    </div>
    <div className="side-deck left-deck" aria-hidden="true" />
    <div className="side-deck right-deck" aria-hidden="true" />
    {showHeader && <header className="paper-topbar">{onLeave ? <button className="profile-card" type="button" onClick={onLeave}>{profile}</button> : <div className="profile-card static-profile">{profile}</div>}</header>}
    {children}
  </main></div>;
}

export default function App() {
  const actorId = useRef(getDeviceId());
  const roomRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [screen, setScreen] = useState(joinCodeFromPath() ? "join" : "welcome");
  const [hostName, setHostName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState(joinCodeFromPath());
  const [toast, setToast] = useState(null);
  const [roleSetup, setRoleSetup] = useState(EMPTY_SETUP);
  const [roleCatalog, setRoleCatalog] = useState([]);
  const [balanceModes, setBalanceModes] = useState([]);
  const [balanceMode, setBalanceMode] = useState("new_players");
  const [hostAssignments, setHostAssignments] = useState([]);
  const [manualSlots, setManualSlots] = useState([]);
  const [playerRole, setPlayerRole] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [postGameAction, setPostGameAction] = useState(null);
  const [postGameSummary, setPostGameSummary] = useState([]);

  const applyState = useCallback((state) => {
    if (state?.room) {
      roomRef.current = state.room;
      setRoom(state.room);
    }
    if (state?.roleSetup) setRoleSetup(state.roleSetup);
    setPostGameSummary(state?.postGameSummary || []);
  }, []);

  useEffect(() => {
    const next = io(API_URL, { transports: ["websocket", "polling"] });
    setSocket(next);
    next.on("connect", () => {
      const activeRoom = roomRef.current;
      if (activeRoom) next.emit("room:resume", { roomId: activeRoom.id, actorId: actorId.current });
    });
    next.on("room:created", (state) => { applyState(state); setScreen("lobby"); });
    next.on("room:joined", (state) => { applyState(state); setScreen("lobby"); });
    next.on("room:resumed", applyState);
    next.on("room:updated", applyState);
    next.on("room:error", ({ message }) => { setPostGameAction(null); setToast(message); });
    next.on("room:closed", ({ message }) => {
      setToast(message);
      roomRef.current = null;
      setRoom(null);
      setRoleSetup(EMPTY_SETUP);
      setHostAssignments([]);
      setPlayerRole(null);
      setScreen("closed");
    });
    next.on("roles:catalog", ({ roles, balanceModes: modes }) => { setRoleCatalog(roles || []); setBalanceModes(modes || []); });
    next.on("roles:host-view", ({ setup, assignments }) => { if (setup) setRoleSetup(setup); setHostAssignments(assignments || []); });
    next.on("player:state", (state) => { applyState(state); setPlayerRole(state.role || null); });
    return () => next.disconnect();
  }, [applyState]);

  useEffect(() => { if (roleSetup?.balanceMode) setBalanceMode(roleSetup.balanceMode); }, [roleSetup?.balanceMode]);
  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);
  useEffect(() => {
    if (room?.status === "waiting") {
      setHostAssignments([]); setPlayerRole(null); setFlipped(false); setPostGameAction(null);
    }
  }, [room?.status]);

  const isHost = room?.hostId === actorId.current;
  const playerCount = room?.players?.length || 0;
  const slots = useMemo(() => buildSlots(roleSetup.selectedRoles || []), [roleSetup.selectedRoles]);
  const slotSignature = slots.map((slot) => slot.key).join("|");
  const assignmentSignature = hostAssignments.map((assignment) => `${assignment.playerId}:${assignment.roleId}`).sort().join("|");
  const self = room?.players?.find((player) => player.id === actorId.current);

  useEffect(() => { setManualSlots(hydrateSlots(slots, hostAssignments)); }, [slotSignature, assignmentSignature]);
  useEffect(() => { if (isHost && room?.status === "assigning") socket?.emit("roles:catalog"); }, [isHost, room?.status, socket]);

  function guardConnection() {
    if (!socket?.connected) { setToast("Mất kết nối với bàn điều khiển."); return false; }
    return true;
  }

  function reset() {
    roomRef.current = null;
    setRoom(null); setRoleSetup(EMPTY_SETUP); setHostAssignments([]); setPlayerRole(null); setFlipped(false); setScreen("welcome");
    window.history.replaceState({}, "", "/");
  }

  function createRoom(event) {
    event.preventDefault();
    if (guardConnection()) socket.emit("room:create", { hostName: hostName.trim(), hostId: actorId.current });
  }

  function joinRoom(event) {
    event.preventDefault();
    if (guardConnection()) socket.emit("room:join", { roomCode: roomCode.trim().toUpperCase(), playerName: playerName.trim(), playerId: actorId.current });
  }

  function leaveRoom() {
    socket?.emit("room:leave");
    if (!isHost) reset();
  }

  function startAssignment() {
    if (playerCount >= 6 && guardConnection()) { socket.emit("room:start"); socket.emit("roles:catalog"); }
  }

  function changeQuantity(roleId, delta) {
    const catalogRole = roleCatalog.find((role) => role.id === roleId);
    if (!catalogRole) return;
    const quantities = new Map((roleSetup.selectedRoles || []).map((role) => [role.id, role.quantity]));
    const next = Math.max(0, Math.min(catalogRole.max, (quantities.get(roleId) || 0) + delta));
    if (next) quantities.set(roleId, next); else quantities.delete(roleId);
    socket.emit("roles:configure", { balanceMode, selections: [...quantities].map(([id, quantity]) => ({ roleId: id, quantity })) });
  }

  function saveManual() {
    if (manualSlots.some((slot) => !slot.playerId)) { setToast("Hãy chọn người chơi cho từng vai."); return; }
    socket.emit("roles:assign-manual", { assignments: manualSlots.map((slot) => ({ playerId: slot.playerId, roleId: slot.roleId })) });
  }

  function continueSameSquad() {
    if (!guardConnection() || postGameAction) return;
    setPostGameAction("continue");
    socket.emit("game:continue");
  }

  function disbandRoom() {
    if (!guardConnection() || postGameAction) return;
    if (!window.confirm("Bạn có chắc muốn giải tán phòng? Tất cả người chơi sẽ rời phòng và không thể tiếp tục với mã phòng này.")) return;
    setPostGameAction("disband");
    socket.emit("room:disband");
  }

  function renderWelcome() {
    return <PaperShell showHeader={false}>
      {toast && <button className="toast" type="button" onClick={() => setToast(null)}>{toast}</button>}
      <section className="home-screen home-plain">
        <div className="title-lockup"><div className="night-mark">☾</div><h1>Ma Sói</h1><span className="online-ribbon">Bàn điều khiển Quan Trò</span><p>Thay lá bài và sổ ghi chép, vẫn giữ nguyên cuộc chơi trực tiếp.</p></div>
        <div className="action-panels">
          <article className="paper-panel create-panel"><span className="ribbon">Tạo bàn chơi</span><div className="village-doodle"><span>◒</span><span>⌂</span><span>◓</span></div><p>Bạn là Quan Trò. Tạo phòng để mời bạn bè cùng ngồi chơi.</p><button className="paper-button" type="button" onClick={() => setScreen("create")}>Tạo phòng</button></article>
          <article className="paper-panel join-panel"><span className="ribbon blue">Vào phòng</span><div className="eye-mark">◉</div><p>Nhập mã phòng của Quan Trò để nhận vai kín trên thiết bị của bạn.</p><button className="paper-button blue" type="button" onClick={() => setScreen("join")}>Vào phòng</button></article>
        </div>
        <section className="about-strip"><span className="wolf-seal">☾</span><p>Quan Trò chọn bộ vai, chia vai bí mật và theo dõi trạng thái. Người chơi chỉ cần cầm thiết bị của mình.</p><div className="player-guide"><strong>Cách chơi</strong><div><span>1<small>Vào phòng</small></span><span>2<small>Nhận vai</small></span><span>3<small>Chơi trực tiếp</small></span></div></div></section>
      </section>
    </PaperShell>;
  }

  if (!room) {
    if (screen === "welcome") return renderWelcome();
    if (screen === "closed") return <PaperShell profileName="Sói Già Làng" onLeave={reset}><section className="ritual-screen"><div className="paper-panel form-panel closed-panel"><span className="ribbon">Phòng đã đóng</span><h2>Bàn chơi đã kết thúc</h2><p>Quan Trò ngắt kết nối nên phòng được đóng để mọi vai và ghi chú không được dùng tiếp.</p><button className="paper-button" type="button" onClick={reset}>Về trang chính</button></div></section></PaperShell>;
    const isCreate = screen === "create";
    return <PaperShell profileName="Sói Già Làng" onLeave={reset}><section className="ritual-screen"><form className="paper-panel form-panel" onSubmit={isCreate ? createRoom : joinRoom}><button className="back-link" type="button" onClick={() => setScreen("welcome")}>Quay lại</button><span className={`ribbon ${isCreate ? "" : "blue"}`}>{isCreate ? "Quan Trò" : "Người chơi"}</span><h2>{isCreate ? "Tạo bàn chơi" : "Vào bàn chơi"}</h2>{isCreate ? <><p className="status-line">Quan Trò không tính là người chơi. Phòng tối đa 24 người và phân vai từ 6 người.</p><label className="field"><span>Tên Quan Trò</span><input value={hostName} onChange={(event) => setHostName(event.target.value)} placeholder="Ví dụ: Minh" maxLength="32" required autoFocus /></label></> : <><label className="field"><span>Mã phòng</span><input className="input-room-code" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABC123" maxLength="6" required autoFocus /></label><label className="field"><span>Tên của bạn</span><input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Ví dụ: Lan" maxLength="32" required /></label></>}<button className={`paper-button full ${isCreate ? "" : "blue"}`} type="submit">{isCreate ? "Tạo phòng" : "Vào phòng"}</button></form></section>{toast && <button className="toast" type="button" onClick={() => setToast(null)}>{toast}</button>}</PaperShell>;
  }

  if (room.status === "waiting") return <Lobby room={room} isHost={isHost} onLeave={leaveRoom} onStart={startAssignment} onNotice={setToast} toast={toast} dismissToast={() => setToast(null)} />;
  if (room.status === "assigning" && isHost) return <Assignment room={room} setup={roleSetup} catalog={roleCatalog} modes={balanceModes} balanceMode={balanceMode} setBalanceMode={setBalanceMode} slots={manualSlots} assignments={hostAssignments} onQuantity={changeQuantity} onGenerate={() => socket.emit("roles:generate", { balanceMode, requestId: crypto.randomUUID() })} onRandom={() => socket.emit("roles:assign-random")} onSlot={(key, playerId) => setManualSlots((current) => assignPlayerToSlot(current, key, playerId))} onSave={saveManual} onFinalize={() => socket.emit("roles:finalize")} onLeave={leaveRoom} toast={toast} dismissToast={() => setToast(null)} />;
  if (room.status === "assigning") return <Waiting room={room} onLeave={leaveRoom} toast={toast} dismissToast={() => setToast(null)} />;
  if (room.status === "ended") return <GameEnded room={room} summary={postGameSummary} isHost={isHost} onLeave={leaveRoom} onContinue={continueSameSquad} onDisband={disbandRoom} processing={postGameAction} toast={toast} dismissToast={() => setToast(null)} />;
  if (room.status === "playing" && isHost) return <Moderator room={room} roles={roleSetup.selectedRoles || []} assignments={hostAssignments} catalog={roleCatalog} onLeave={leaveRoom} onMark={(playerId, markDead) => socket.emit("game:mark-death", { playerId, markDead })} onDay={() => socket.emit("game:begin-day")} onNight={() => socket.emit("game:begin-night")} toast={toast} dismissToast={() => setToast(null)} />;
  return <PlayerRole room={room} player={self} role={playerRole} flipped={flipped} setFlipped={setFlipped} toast={toast} dismissToast={() => setToast(null)} />;
}

function Lobby({ room, isHost, onLeave, onStart, onNotice, toast, dismissToast }) {
  const canStart = isHost && room.playerCount >= 6;
  const joinUrl = `${window.location.origin}/join/${room.code}`;
  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      onNotice("Đã sao chép mã phòng.");
    } catch {
      onNotice(`Không thể sao chép tự động. Mã phòng là ${room.code}.`);
    }
  }
  async function shareRoom() {
    const shareData = { title: "Mời vào bàn Ma Sói", text: `Vào phòng ${room.code} để nhận vai.`, url: joinUrl };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        onNotice("Đã mở bảng chia sẻ.");
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${joinUrl}`);
        onNotice("Thiết bị chưa hỗ trợ chia sẻ. Đã sao chép lời mời.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") onNotice("Chưa thể chia sẻ lời mời trên thiết bị này.");
    }
  }
  return <PaperShell profileName={isHost ? room.hostName : "Người chơi"} onLeave={onLeave}>{toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}<section className="lobby"><div className="paper-panel lobby-panel"><div className="lobby-header"><div><span className="ribbon small">Phòng chờ</span><div className="room-code-row"><h2>Phòng <span>{room.code}</span></h2><button className="copy-code-button" type="button" onClick={copyRoomCode}>Sao chép mã</button></div><p>Quan Trò: {room.hostName}</p></div><div className="lobby-actions">{isHost ? <><p className={canStart ? "status-line ready" : "status-line"}>{canStart ? "Đã đủ người chơi để phân vai." : `Cần thêm ${6 - room.playerCount} người chơi.`}</p><button className={`paper-button ${canStart ? "ready" : ""}`} type="button" disabled={!canStart} onClick={onStart}>Bắt đầu phân vai</button></> : <p>Hãy chờ Quan Trò chuẩn bị bộ vai.</p>}</div></div>{isHost && <div className="lobby-qr"><div className="qr-placeholder" aria-label="Mã QR sẽ được bổ sung sau"><strong>QR</strong><small>Sắp có</small></div><div><strong>Mời bạn bè vào phòng</strong><p>Chia sẻ đường dẫn hoặc gửi mã {room.code}. Tính năng quét QR sẽ được bổ sung sau.</p><button className="paper-button blue compact" type="button" onClick={shareRoom}>Chia sẻ lời mời</button></div></div>}<div className="host-card"><span className="player-avatar">{playerInitial(room.hostName)}</span><strong>{room.hostName}</strong><span>Quan Trò</span></div><div className="players-grid">{room.players.map((player, index) => <article className={`player-card ${player.isAlive === false ? "dead" : ""} ${player.pendingDeath ? "pending" : ""}`} key={player.id} style={{ "--i": index }}><span className="player-avatar">{playerInitial(player.name)}</span><p>{player.name}</p><span className="status-label">{player.isAlive === false ? "Đã chết" : player.pendingDeath ? "Đã đánh dấu" : "Đang chơi"}</span></article>)}</div></div></section></PaperShell>;
}

function Assignment({ room, setup, catalog, modes, balanceMode, setBalanceMode, slots, assignments, onQuantity, onGenerate, onRandom, onSlot, onSave, onFinalize, onLeave, toast, dismissToast }) {
  const selected = new Map((setup.selectedRoles || []).map((role) => [role.id, role.quantity]));
  const fullRoleSet = setup.totalSlots === room.playerCount;
  const saved = assignments.length === room.playerCount;
  return <PaperShell profileName={room.hostName} onLeave={onLeave} phase={room.gamePhase}>
    {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
    <section className="assignment-screen">
      <header className="assignment-header">
        <div>
          <span className="ribbon">Bàn điều khiển Quan Trò</span>
          <h2>Chọn và chia vai</h2>
          <p className="assignment-intro">Có {room.playerCount} người chơi. Quan Trò không nằm trong danh sách phân vai.</p>
        </div>
        <div className="assignment-summary">
          <div><small>Vai đã chọn</small><strong>{setup.totalSlots} / {room.playerCount}</strong></div>
          <div><small>Điểm cân bằng</small><strong className="score">{formatScore(setup.balance?.score)}</strong></div>
          <small>{setup.balance?.withinTarget ? "Đúng khoảng gợi ý" : "Bộ vai thủ công có thể nằm ngoài khoảng gợi ý"}</small>
        </div>
      </header>
      <div className="assignment-controls">
        <aside className="role-library-panel">
          <h3>Thư viện vai</h3>
          <div className="balance-choices">{modes.map((mode) => <button className={`balance-choice ${balanceMode === mode.id ? "active" : ""}`} key={mode.id} type="button" onClick={() => setBalanceMode(mode.id)}>{mode.name}</button>)}</div>
          <button className="paper-button blue full compact" type="button" onClick={onGenerate}>Rút bộ vai cân bằng</button>
          {TEAM_ORDER.map((team) => <div className="role-category" key={team}>
            <h4>{TEAM_LABELS[team]}</h4>
            {catalog.filter((role) => role.team === team).map((role) => {
              const quantity = selected.get(role.id) || 0;
              return <div className="role-row" key={role.id}><div><strong>{role.name}</strong><small>{formatScore(role.value)} điểm {role.recommended ? " · Gợi ý" : ""}</small></div><div className="quantity-stepper"><button type="button" aria-label={`Giảm ${role.name}`} disabled={!quantity} onClick={() => onQuantity(role.id, -1)}>−</button><span>{quantity}</span><button type="button" aria-label={`Tăng ${role.name}`} disabled={setup.totalSlots >= room.playerCount || quantity >= role.max} onClick={() => onQuantity(role.id, 1)}>+</button></div></div>;
            })}
          </div>)}
        </aside>
        <section className="deal-panel">
          <div className="deal-panel-head"><div><h3>Gán vai</h3><p>Chia ngẫu nhiên hoặc chọn từng người.</p></div><button className="paper-button blue compact" type="button" disabled={!fullRoleSet} onClick={onRandom}>Trộn và chia vai</button></div>
          {slots.length ? <div className="assignment-slots">{slots.map((slot) => {
            return <label className="assignment-slot" key={slot.key}><strong>{slot.role.name}</strong><select value={slot.playerId} onChange={(event) => onSlot(slot.key, event.target.value)}><option value="">Chọn người chơi</option>{room.players.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}</select></label>;
          })}</div> : <div className="empty-state">Chọn đủ số vai bằng số người chơi để mở bàn phân vai.</div>}
          <div className="assignment-actions"><button className="paper-button neutral compact" type="button" disabled={!slots.length || slots.some((slot) => !slot.playerId)} onClick={onSave}>Lưu gán thủ công</button><button className="paper-button compact" type="button" disabled={!saved} onClick={onFinalize}>Bắt đầu đêm 1</button></div>
          <p className="assignment-note">Trộn và chia vai tạo một lượt phân vai ngẫu nhiên. Bấm lại để trộn lượt mới.</p>
        </section>
      </div>
    </section>
  </PaperShell>;
}

function Waiting({ room, onLeave, toast, dismissToast }) {
  return <PaperShell profileName="Người chơi" onLeave={onLeave}>{toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}<section className="ritual-screen"><div className="paper-panel waiting-panel"><div className="night-mark">☾</div><span className="ribbon blue">Đang chuẩn bị</span><h2>Quan Trò đang phân vai</h2><p>Hãy giữ thiết bị này riêng tư. Vai của bạn sẽ chỉ xuất hiện tại đây sau khi Quan Trò hoàn tất.</p><div className="role-chips">{room.players.map((player) => <span key={player.id}>{player.name}</span>)}</div></div></section></PaperShell>;
}

function Moderator({ room, roles, assignments, catalog, onLeave, onMark, onDay, onNight, toast, dismissToast }) {
  const night = room.gamePhase === "night";
  const scriptRoles = night
    ? roles.filter((role) => roleWakesTonight(role, room.gameDay)).sort((left, right) => left.nightOrder - right.nightOrder)
    : roles.filter((role) => ["mayor", "hunter", "prince", "tanner"].includes(role.id));
  const [dayDeathCandidateId, setDayDeathCandidateId] = useState(null);
  const confirmDayDeath = (playerId) => {
    onMark(playerId, true);
    setDayDeathCandidateId(null);
  };
  // Build a map of playerId -> role object for the role roster
  const roleById = useMemo(() => new Map((catalog || []).map((r) => [r.id, r])), [catalog]);
  const assignmentMap = useMemo(() => new Map((assignments || []).map((a) => [a.playerId, roleById.get(a.roleId)])), [assignments, roleById]);
  return <PaperShell profileName={room.hostName} onLeave={onLeave} phase={room.gamePhase}>
    {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
    <section className="moderator-screen">
      <span className="ribbon">Kịch bản Quan Trò</span>
      <div className="moderator-top"><div><h2>{night ? `Đêm ${room.gameDay}` : `Ngày ${room.gameDay}`}</h2><p>{night ? "Đọc từng lời dẫn theo thứ tự và đánh dấu người sẽ chết khi sáng." : "Cho người chơi thảo luận, biểu quyết và ghi nhận ngay mọi trường hợp tử vong ban ngày."}</p></div><button className="paper-button" type="button" onClick={night ? onDay : onNight}>{night ? "Mở ban ngày" : `Bắt đầu đêm ${room.gameDay + 1}`}</button></div>
      <div className="moderator-grid">
        <div className="script-panel">
          <h3>{night ? "Lời dẫn theo thứ tự" : "Lời dẫn ban ngày"}</h3>
          {!night && <article className="script-row featured-script"><span className="script-order">NG</span><div><strong>Mở đầu ban ngày</strong><small>Trời đã sáng, mọi người mở mắt. Những người còn sống bắt đầu thảo luận. Khi kết thúc thảo luận, làng sẽ biểu quyết một người bị nghi ngờ. Quan Trò ghi nhận kết quả trước khi chuyển sang đêm tiếp theo.</small></div></article>}
          {scriptRoles.length ? scriptRoles.map((role) => <article className="script-row" key={role.id}><span className="script-order">{night ? role.nightOrder : "!"}</span><div><strong>{role.name}{role.quantity > 1 ? ` × ${role.quantity}` : ""}</strong><small>{scriptForRole(role, room)}</small></div></article>) : night ? <p className="status-line">Đêm này không có vai nào cần thức dậy.</p> : <p className="status-line">Không có vai đặc biệt cần nhắc trong ban ngày.</p>}

        </div>
        <div className="death-panel"><h3>{night ? "Ghi nhận trong đêm" : "Ghi nhận ban ngày"}</h3><p className="death-panel-note">{night ? "Các đánh dấu này sẽ được công bố khi mở ban ngày." : "Dùng sau bỏ phiếu hoặc năng lực ban ngày. Xác nhận sẽ cập nhật ngay trên thiết bị của người chơi."}</p><div className="death-roster">{room.players.map((player) => {
          const role = assignmentMap.get(player.id);
          return <article className={`player-card ${player.isAlive === false ? "dead" : ""} team-${role?.team || "unknown"}`} key={player.id}><span className="player-avatar">{playerInitial(player.name)}</span><div className="player-info-col"><p>{player.name}</p>{role ? <div className="player-card-role"><span className="roster-role-name">{role.name}</span><span className={`roster-team-badge team-${role.team}`}>{TEAM_LABELS[role.team] || role.team}</span></div> : <span className="roster-role-name muted">Chưa có vai</span>}<span className="status-label">{player.isAlive === false ? "Đã chết" : player.pendingDeath ? "Đã đánh dấu" : "Đang chơi"}</span></div>{night && player.isAlive && <button className={`mark-death ${player.pendingDeath ? "marked" : ""}`} type="button" onClick={() => onMark(player.id, !player.pendingDeath)}>{player.pendingDeath ? "Bỏ đánh dấu" : "Chết khi sáng"}</button>}{!night && player.isAlive && (dayDeathCandidateId === player.id ? <span className="day-death-confirm"><span>Xác nhận đã chết?</span><button className="mark-death marked" type="button" onClick={() => confirmDayDeath(player.id)}>Xác nhận</button><button className="mark-death" type="button" onClick={() => setDayDeathCandidateId(null)}>Hủy</button></span> : <button className="mark-death day" type="button" onClick={() => setDayDeathCandidateId(player.id)}>Ghi nhận đã chết</button>)}</article>
        })}</div></div>
      </div>
    </section>
  </PaperShell>;
}

function GameEnded({ room, summary, isHost, onLeave, onContinue, onDisband, processing, toast, dismissToast }) {
  return <PaperShell profileName={isHost ? room.hostName : "Người chơi"} onLeave={onLeave}>
    {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
    <section className="ritual-screen"><div className="paper-panel game-ended-panel"><span className="ribbon">Ván chơi kết thúc</span><p className="game-ended-kicker">Kết quả chung cuộc</p><h2>{WINNER_LABELS[room.winner] || "Ván chơi kết thúc"}</h2><p>{room.endReason}</p><div className="game-ended-count"><strong>{room.players.filter((player) => player.isAlive).length}</strong><span>người còn sống</span></div><section className="post-game-summary" aria-labelledby="post-game-summary-title"><h3 id="post-game-summary-title">Tất cả vai trò</h3>{summary.length ? <div className="post-game-summary-list">{summary.map((player) => <article className={`post-game-player ${player.isAlive ? "survived" : "dead"}`} key={player.playerId}><span className="player-avatar">{playerInitial(player.name)}</span><div><strong>{player.name}</strong><span className="post-game-role">{player.role?.name || "Vai trò không có dữ liệu"}</span></div><span className="post-game-status">{player.isAlive ? "Còn sống" : player.deathNight ? `Đã chết · Đêm ${player.deathNight}` : "Đã chết (không rõ đêm)"}</span></article>)}</div> : <p className="post-game-empty">Đang tải kết quả vai trò. Nếu dữ liệu cũ không đầy đủ, hãy hỏi Quản Trò.</p>}</section>{isHost ? <div className="post-game-actions"><p>Ván chơi đã kết thúc. Hãy chọn tiếp tục với đội hình hiện tại hoặc giải tán phòng.</p><button className="paper-button" type="button" disabled={Boolean(processing)} onClick={onContinue}>Tiếp tục với đội hình hiện tại</button><button className="paper-button destructive" type="button" disabled={Boolean(processing)} onClick={onDisband}>Giải tán phòng</button></div> : <p className="post-game-wait">Ván chơi đã kết thúc. Đang chờ Quản Trò quyết định tiếp tục hoặc giải tán phòng.</p>}</div></section>
  </PaperShell>;
}

function PlayerRole({ room, player, role, flipped, setFlipped, toast, dismissToast }) {
  const dead = player?.isAlive === false;
  if (!role) {
    return <PaperShell profileName={player?.name || "Người chơi"} phase={room.gamePhase}>
      {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
      <section className="player-board-screen">
        <div className="paper-panel waiting-panel">
          <div className="night-mark">☾</div>
          <h2>Đang nhận vai</h2>
          <p>Quan Trò đã bắt đầu ván chơi. Vai của bạn sẽ hiện ngay khi hệ thống hoàn tất bảo mật.</p>
        </div>
      </section>
    </PaperShell>;
  }
  return <PaperShell profileName={player?.name || "Người chơi"} phase={room.gamePhase}>
    {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
    <section className="player-board-screen">
      <div className="paper-panel board-panel">
        <div className="board-panel-header">
          <div>
            <h3>Bàn chơi</h3>
            <p className="board-panel-note">
              {room.gamePhase === "day" ? `Ngày ${room.gameDay}` : `Đêm ${room.gameDay}`} · Bạn là {role.name}.
            </p>
          </div>
          {dead && <span className="death-notice inline">Bạn đã chết.</span>}
        </div>
        <div className="death-roster player-view-roster">
          {room.players.map((p) => {
            const isSelf = p.id === player?.id;
            const isDead = p.isAlive === false;
            return (
              <article className={`player-card ${isDead ? "dead" : ""} ${isSelf ? `team-${role.team}` : ""}`} key={p.id}>
                <span className="player-avatar">{playerInitial(p.name)}</span>
                <div className="player-info-col">
                  <p>{p.name}{isSelf ? " (Bạn)" : ""}</p>
                  {isSelf && !flipped && (
                    <div className="player-card-role"><span className="roster-role-name">{role.name}</span><span className={`roster-team-badge team-${role.team}`}>{TEAM_LABELS[role.team] || role.team}</span></div>
                  )}
                  {isSelf && !flipped && role.ability && (
                    <span className="roster-ability small-ability">{role.ability}</span>
                  )}
                  {isSelf && flipped && (
                    <span className="roster-role-name muted">Vai đã được ẩn</span>
                  )}
                  <span className="status-label">{isDead ? "Đã chết" : "Đang chơi"}</span>
                </div>
                {isSelf && (
                  <button className="reveal-toggle inline-toggle" type="button" onClick={() => setFlipped(!flipped)}>
                    {flipped ? "Hiện" : "Ẩn"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  </PaperShell>;
}
