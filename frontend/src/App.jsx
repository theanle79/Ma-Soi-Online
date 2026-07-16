import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { areAllPlayersAssigned, assignPlayerToSlot } from "./assignment-utils.js";
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
  const [assignmentRequest, setAssignmentRequest] = useState(null);

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
    next.on("disconnect", () => setAssignmentRequest(null));
    next.on("room:created", (state) => { applyState(state); setScreen("lobby"); });
    next.on("room:joined", (state) => { applyState(state); setScreen("lobby"); });
    next.on("room:resumed", applyState);
    next.on("room:updated", (state) => {
      applyState(state);
      if (state?.room?.status !== "assigning") setAssignmentRequest(null);
    });
    next.on("room:error", ({ message }) => { setAssignmentRequest(null); setPostGameAction(null); setToast(message); });
    next.on("room:closed", ({ message }) => {
      setToast(message);
      roomRef.current = null;
      setRoom(null);
      setRoleSetup(EMPTY_SETUP);
      setHostAssignments([]);
      setAssignmentRequest(null);
      setPlayerRole(null);
      setScreen("closed");
    });
    next.on("roles:catalog", ({ roles, balanceModes: modes }) => { setRoleCatalog(roles || []); setBalanceModes(modes || []); });
    next.on("roles:host-view", ({ setup, assignments, requestId }) => {
      if (setup) setRoleSetup(setup);
      setHostAssignments(assignments || []);
      setAssignmentRequest((current) => {
        if (current?.type === "generate" && requestId !== current.requestId) return current;
        return null;
      });
    });
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
      setHostAssignments([]); setPlayerRole(null); setFlipped(false); setAssignmentRequest(null); setPostGameAction(null);
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
    setRoom(null); setRoleSetup(EMPTY_SETUP); setHostAssignments([]); setAssignmentRequest(null); setPlayerRole(null); setFlipped(false); setScreen("welcome");
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
    if (assignmentRequest || !guardConnection()) return;
    const catalogRole = roleCatalog.find((role) => role.id === roleId);
    if (!catalogRole) return;
    const quantities = new Map((roleSetup.selectedRoles || []).map((role) => [role.id, role.quantity]));
    const next = Math.max(0, Math.min(catalogRole.max, (quantities.get(roleId) || 0) + delta));
    if (next) quantities.set(roleId, next); else quantities.delete(roleId);
    socket.emit("roles:configure", { balanceMode, selections: [...quantities].map(([id, quantity]) => ({ roleId: id, quantity })) });
  }

  function generateRoles() {
    if (assignmentRequest || !guardConnection()) return;
    const requestId = crypto.randomUUID();
    setAssignmentRequest({ type: "generate", requestId });
    socket.emit("roles:generate", { balanceMode, requestId });
  }

  function assignRolesRandomly() {
    if (assignmentRequest || !guardConnection()) return;
    setAssignmentRequest({ type: "random" });
    socket.emit("roles:assign-random");
  }

  function finalizeAssignment() {
    const currentPlayers = room?.players || [];
    const readyToStart = currentPlayers.length >= 6
      && room.playerCount === currentPlayers.length
      && roleSetup.totalSlots === currentPlayers.length
      && areAllPlayersAssigned(manualSlots, currentPlayers);
    if (!readyToStart) { setToast("Hãy gán đủ vai cho tất cả người chơi trước khi bắt đầu."); return; }
    if (assignmentRequest || !guardConnection()) return;
    setAssignmentRequest({ type: "finalize" });
    socket.emit("roles:finalize", { assignments: manualSlots.map((slot) => ({ playerId: slot.playerId, roleId: slot.roleId })) });
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
    if (screen === "closed") return <PaperShell profileName="Sói Già Làng" onLeave={reset}><section className="ritual-screen"><div className="paper-panel form-panel closed-panel"><span className="ribbon">Phòng đã đóng</span><h2>Bàn chơi đã kết thúc</h2><p>Quan Trò đã rời hoặc giải tán phòng. Mã phòng này không còn dùng để tiếp tục ván chơi.</p><button className="paper-button" type="button" onClick={reset}>Về trang chính</button></div></section></PaperShell>;
    const isCreate = screen === "create";
    return <PaperShell profileName="Sói Già Làng" onLeave={reset}><section className="ritual-screen"><form className="paper-panel form-panel" onSubmit={isCreate ? createRoom : joinRoom}><button className="back-link" type="button" onClick={() => setScreen("welcome")}>Quay lại</button><span className={`ribbon ${isCreate ? "" : "blue"}`}>{isCreate ? "Quan Trò" : "Người chơi"}</span><h2>{isCreate ? "Tạo bàn chơi" : "Vào bàn chơi"}</h2>{isCreate ? <><p className="status-line">Quan Trò không tính là người chơi. Phòng tối đa 24 người và phân vai từ 6 người.</p><label className="field"><span>Tên Quan Trò</span><input value={hostName} onChange={(event) => setHostName(event.target.value)} placeholder="Ví dụ: Minh" maxLength="32" required autoFocus /></label></> : <><label className="field"><span>Mã phòng</span><input className="input-room-code" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABC123" maxLength="6" required autoFocus /></label><label className="field"><span>Tên của bạn</span><input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Ví dụ: Lan" maxLength="32" required /></label></>}<button className={`paper-button full ${isCreate ? "" : "blue"}`} type="submit">{isCreate ? "Tạo phòng" : "Vào phòng"}</button></form></section>{toast && <button className="toast" type="button" onClick={() => setToast(null)}>{toast}</button>}</PaperShell>;
  }

  if (room.status === "waiting") return <Lobby room={room} isHost={isHost} onLeave={leaveRoom} onStart={startAssignment} onNotice={setToast} toast={toast} dismissToast={() => setToast(null)} />;
  if (room.status === "assigning" && isHost) return <Assignment room={room} setup={roleSetup} catalog={roleCatalog} modes={balanceModes} balanceMode={balanceMode} setBalanceMode={setBalanceMode} slots={manualSlots} pendingAction={assignmentRequest?.type || null} onQuantity={changeQuantity} onGenerate={generateRoles} onRandom={assignRolesRandomly} onSlot={(key, playerId) => setManualSlots((current) => assignPlayerToSlot(current, key, playerId))} onFinalize={finalizeAssignment} onLeave={leaveRoom} toast={toast} dismissToast={() => setToast(null)} />;
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
  return <PaperShell profileName={isHost ? room.hostName : "Người chơi"} onLeave={onLeave}>{toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}<section className="lobby"><div className="paper-panel lobby-panel"><div className="lobby-header"><div><span className="ribbon small">Phòng chờ</span><div className="room-code-row"><h2>Phòng <span>{room.code}</span></h2><button className="copy-code-button" type="button" onClick={copyRoomCode}>Sao chép mã</button></div><p>Quan Trò: {room.hostName}</p></div><div className="lobby-actions">{isHost ? <><p className={canStart ? "status-line ready" : "status-line"}>{canStart ? "Đã đủ người chơi để phân vai." : `Cần thêm ${6 - room.playerCount} người chơi.`}</p><button className={`paper-button ${canStart ? "ready" : ""}`} type="button" disabled={!canStart} onClick={onStart}>Bắt đầu phân vai</button></> : <p>Hãy chờ Quan Trò chuẩn bị bộ vai.</p>}</div></div>{isHost && <div className="lobby-invite"><div><strong>Mời người chơi vào phòng</strong><p>Gửi mã phòng <b>{room.code}</b> hoặc chia sẻ đường dẫn vào thẳng biểu mẫu tham gia.</p><a className="invite-link" href={joinUrl}>{joinUrl}</a></div><button className="paper-button blue compact" type="button" onClick={shareRoom}>Chia sẻ đường dẫn</button></div>}<div className="host-card"><span className="player-avatar">{playerInitial(room.hostName)}</span><strong>{room.hostName}</strong><span>Quan Trò</span></div><div className="players-grid">{room.players.map((player, index) => <article className={`player-card ${player.isAlive === false ? "dead" : ""} ${player.pendingDeath ? "pending" : ""}`} key={player.id} style={{ "--i": index }}><span className="player-avatar">{playerInitial(player.name)}</span><p>{player.name}</p><span className="status-label">{player.isAlive === false ? "Đã chết" : player.pendingDeath ? "Đã đánh dấu" : "Đang chơi"}</span></article>)}</div></div></section></PaperShell>;
}

function Assignment({ room, setup, catalog, modes, balanceMode, setBalanceMode, slots, pendingAction, onQuantity, onGenerate, onRandom, onSlot, onFinalize, onLeave, toast, dismissToast }) {
  const selectedRoles = setup.selectedRoles || [];
  const selected = new Map(selectedRoles.map((role) => [role.id, role.quantity]));
  const fullRoleSet = setup.totalSlots === room.playerCount;
  const readyToStart = room.players.length >= 6
    && room.playerCount === room.players.length
    && setup.totalSlots === room.players.length
    && areAllPlayersAssigned(slots, room.players);
  const currentStep = !fullRoleSet ? 1 : readyToStart ? 3 : 2;
  const remainingRoles = Math.max(0, room.playerCount - setup.totalSlots);
  const balanceModeIndex = Math.max(0, modes.findIndex((mode) => mode.id === balanceMode));
  const balanceSliderMax = Math.max(0, modes.length - 1);
  const activeBalanceMode = modes[balanceModeIndex];
  const isPending = Boolean(pendingAction);
  const pendingMessage = pendingAction === "generate"
    ? "Đang tạo bộ vai phù hợp…"
    : pendingAction === "random"
      ? "Đang trộn và chia vai…"
      : pendingAction === "finalize"
        ? "Đang lưu phân vai và bắt đầu đêm 1…"
        : "";
  const balanceStatus = setup.totalSlots === 0
    ? "Chưa có bộ vai — hãy tạo tự động để bắt đầu"
    : setup.balance?.withinTarget
      ? "Đang trong khoảng cân bằng gợi ý"
      : "Bộ vai đang ngoài khoảng cân bằng gợi ý";
  const balanceStatusClass = setup.totalSlots === 0 ? "empty" : setup.balance?.withinTarget ? "within-target" : "outside-target";

  return <PaperShell profileName={room.hostName} onLeave={onLeave} phase={room.gamePhase}>
    {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
    <section className="assignment-screen">
      <header className="assignment-header">
        <div className="assignment-header-copy">
          <span className="ribbon">Bàn điều khiển Quan Trò</span>
          <h2>Tạo và chia bộ vai</h2>
          <p className="assignment-intro">Bắt đầu bằng một bộ vai tự động, xem lại, chia cho {room.playerCount} người chơi rồi bắt đầu đêm 1.</p>
          <div className="assignment-flow" aria-label="Quy trình chuẩn bị ván chơi">
            {["Tạo bộ vai", "Gán người", "Bắt đầu"].map((label, index) => {
              const step = index + 1;
              return <span className={currentStep === step ? "active" : currentStep > step ? "complete" : ""} aria-current={currentStep === step ? "step" : undefined} key={label}><b>{step}</b> {label}</span>;
            })}
          </div>
        </div>
        <div className="assignment-summary" aria-label="Tóm tắt thiết lập ván chơi">
          <div className="assignment-stat"><small>Người chơi</small><strong>{room.playerCount}</strong></div>
          <div className="assignment-stat"><small>Vai đã chọn</small><strong>{setup.totalSlots}<span>/{room.playerCount}</span></strong></div>
          <div className="assignment-stat"><small>Điểm cân bằng</small><strong className="score">{formatScore(setup.balance?.score)}</strong></div>
          <p className={`assignment-balance-status ${balanceStatusClass}`}>{balanceStatus}</p>
        </div>
      </header>

      <div className="assignment-workflow">
        <section className="preset-panel assignment-card" aria-labelledby="preset-title" aria-busy={pendingAction === "generate"}>
          <div className="assignment-panel-heading">
            <span>Bước 1 · Cách nhanh nhất</span>
            <h3 id="preset-title">Tạo bộ vai tự động</h3>
            <p>Chọn mức phù hợp với kinh nghiệm của nhóm. Hệ thống vẫn giữ nguyên mọi quy tắc tạo và cân bằng vai hiện có.</p>
          </div>
          <fieldset className="balance-control">
            <legend className="sr-only">Cân bằng bộ vai</legend>
            <div className="balance-control-heading">
              <label id="balance-slider-label" htmlFor="balance-mode-slider">Mức cân bằng cho nhóm</label>
              <output htmlFor="balance-mode-slider">{activeBalanceMode?.name || "Đang tải"}</output>
            </div>
            <p className="balance-helper">Kéo thanh theo kinh nghiệm của người chơi. Mức này được dùng khi tạo bộ vai tự động.</p>
            <div className="balance-slider-shell">
              <input
                id="balance-mode-slider"
                className="balance-slider"
                type="range"
                min="0"
                max={balanceSliderMax}
                step="1"
                value={balanceModeIndex}
                disabled={isPending || modes.length < 2}
                aria-labelledby="balance-slider-label"
                aria-describedby="balance-slider-guidance"
                aria-valuetext={activeBalanceMode ? `${activeBalanceMode.name}. ${activeBalanceMode.guidance}` : "Đang tải các mức cân bằng"}
                onChange={(event) => setBalanceMode(modes[Number(event.target.value)]?.id || balanceMode)}
              />
              <div className="balance-slider-labels" aria-hidden="true">{modes.map((mode) => <span className={balanceMode === mode.id ? "active" : ""} key={mode.id}>{mode.name}</span>)}</div>
            </div>
            <div className="balance-guidance" id="balance-slider-guidance" aria-live="polite">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 3h2v3.1l5.6 2.1-.7 1.9-1.2-.5 2.5 5.4h.8v2h-7v-2h.8l2.1-4.6-2.9-1.1V19h3v2H8v-2h3V9.3l-2.9 1.1 2.1 4.6h.8v2H4v-2h.8l2.5-5.4-1.2.5-.7-1.9L11 6.1V3Zm-4 8.8L5.5 15h3L7 11.8Zm10 0L15.5 15h3L17 11.8Z" /></svg>
              <div><strong>{activeBalanceMode?.name || "Mức cân bằng"}</strong><span>{activeBalanceMode?.guidance || "Đang tải hướng dẫn cân bằng bộ vai."}</span></div>
            </div>
          </fieldset>
          <button className="paper-button blue full assignment-primary-button" type="button" disabled={isPending || !activeBalanceMode} onClick={onGenerate}>
            {pendingAction === "generate" && <span className="button-spinner" aria-hidden="true" />}
            {pendingAction === "generate" ? "Đang tạo bộ vai…" : "Tạo bộ vai theo mức này"}
          </button>
        </section>

        <section className={`selected-role-panel assignment-card ${fullRoleSet ? "complete" : ""}`} aria-labelledby="selected-role-title" aria-live="polite">
          <div className="selected-role-heading">
            <div className="assignment-panel-heading compact"><span>Bộ vai hiện tại</span><h3 id="selected-role-title">Bộ vai đã chọn</h3></div>
            <strong className="selected-role-count">{setup.totalSlots}/{room.playerCount} vai</strong>
          </div>
          {selectedRoles.length ? <>
            <div className="selected-role-list">{selectedRoles.map((role) => <article className={`selected-role-card team-${role.team}`} key={role.id}><div><strong>{role.name}</strong><small>{TEAM_LABELS[role.team] || role.team}</small></div><span aria-label={`${role.quantity} vai ${role.name}`}>×{role.quantity}</span></article>)}</div>
            <p className={`selection-progress ${fullRoleSet ? "ready" : ""}`}>{fullRoleSet ? "Đủ vai cho mọi người. Bạn có thể chia ngẫu nhiên hoặc gán thủ công bên dưới." : `Cần thêm ${remainingRoles} vai. Tạo lại bộ vai hoặc mở Tùy chỉnh vai nâng cao.`}</p>
          </> : <div className="selected-role-empty"><strong>Chưa có vai nào được chọn</strong><span>Bấm “Tạo bộ vai theo mức này” để nhận một bộ hoàn chỉnh cho {room.playerCount} người chơi.</span></div>}
        </section>

        <section className="deal-panel" aria-labelledby="deal-title" aria-busy={pendingAction === "random" || pendingAction === "finalize"}>
          <div className="deal-panel-head">
            <div className="assignment-panel-heading compact"><span>Bước 2 · Gán người chơi</span><h3 id="deal-title">Chia vai</h3><p>Trộn ngẫu nhiên là cách nhanh nhất. Bạn vẫn có thể đổi từng người bằng danh sách chọn.</p></div>
            <button className="paper-button blue compact" type="button" disabled={!fullRoleSet || isPending} onClick={onRandom}>{pendingAction === "random" && <span className="button-spinner" aria-hidden="true" />}{pendingAction === "random" ? "Đang chia vai…" : "Trộn và chia vai"}</button>
          </div>
          {fullRoleSet ? <div className="assignment-slots">{slots.map((slot) => {
            return <label className="assignment-slot" key={slot.key}><strong>{slot.role.name}</strong><select value={slot.playerId} disabled={isPending} aria-label={`Người chơi nhận vai ${slot.role.name}`} onChange={(event) => onSlot(slot.key, event.target.value)}><option value="">Chọn người chơi</option>{room.players.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}</select></label>;
          })}</div> : <div className="empty-state assignment-empty"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3h14a2 2 0 0 1 2 2v12h-2V5H5v14h12v2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 4h8v2H8V7Zm0 4h8v2H8v-2Zm0 4h5v2H8v-2Z" /></svg><strong>Chưa đủ vai để chia</strong><span>{setup.totalSlots === 0 ? "Tạo một bộ vai tự động ở bước trên." : `Cần thêm ${remainingRoles} vai để khớp với ${room.playerCount} người chơi.`}</span></div>}
          <div className="assignment-actions"><div className="assignment-action-label"><span>Bước 3</span><strong>Hoàn tất và bắt đầu</strong></div><button className="paper-button compact" type="button" disabled={!readyToStart || isPending} onClick={onFinalize}>{pendingAction === "finalize" && <span className="button-spinner" aria-hidden="true" />}{pendingAction === "finalize" ? "Đang bắt đầu…" : "Bắt đầu đêm 1"}</button></div>
          <p className="assignment-note">Nút bắt đầu chỉ mở khi mỗi người chơi có đúng một vai. Phân vai được lưu cùng lúc khi bắt đầu đêm 1.</p>
        </section>

        <details className="role-library-panel advanced-role-library">
          <summary>
            <span><small>Tùy chọn</small><strong>Tùy chỉnh vai nâng cao</strong></span>
            <span className="advanced-summary-meta">{setup.totalSlots}/{room.playerCount} vai<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7.4 8.6 4.6 4.6 4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" /></svg></span>
          </summary>
          <div className="advanced-role-content">
            <div className="assignment-panel-heading">
              <span>Toàn bộ danh mục</span>
              <h3>Điều chỉnh số lượng từng vai</h3>
              <p>Chỉ dùng khi bạn muốn thay đổi bộ vai tự động. Điểm cân bằng và giới hạn số lượng vẫn được tính như trước.</p>
            </div>
            <div className="role-replacement-help" id="role-replacement-help">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 17h2v2h-2v-2Zm1-14a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 2a3.5 3.5 0 0 1 1 6.85V15h-2v-2.75l.75-.2A1.5 1.5 0 1 0 10.5 9.5h-2A3.5 3.5 0 0 1 12 7Z" /></svg>
              <div><strong>Muốn thay vai khi đã đủ {room.playerCount}/{room.playerCount}?</strong><span>Bấm − ở vai muốn bỏ trước, rồi bấm + ở vai mới. Nút + tạm khóa khi đã đủ người để bộ vai không vượt quá số người chơi.</span></div>
            </div>
            {catalog.length ? TEAM_ORDER.map((team) => <div className="role-category" key={team}>
              <h4>{TEAM_LABELS[team]}</h4>
              {catalog.filter((role) => role.team === team).map((role) => {
                const quantity = selected.get(role.id) || 0;
                return <div className="role-row" key={role.id}><div><strong>{role.name}</strong><small>{formatScore(role.value)} điểm {role.recommended ? " · Gợi ý" : ""}</small></div><div className="quantity-stepper"><button type="button" aria-label={`Giảm ${role.name}`} aria-describedby="role-replacement-help" disabled={isPending || !quantity} onClick={() => onQuantity(role.id, -1)}>−</button><span aria-live="polite">{quantity}</span><button type="button" aria-label={`Tăng ${role.name}`} aria-describedby="role-replacement-help" disabled={isPending || setup.totalSlots >= room.playerCount || quantity >= role.max} onClick={() => onQuantity(role.id, 1)}>+</button></div></div>;
              })}
            </div>) : <p className="catalog-loading" role="status">Đang tải danh mục vai…</p>}
          </div>
        </details>
      </div>
      <p className="assignment-request-status" role="status" aria-live="polite">{pendingMessage}</p>
    </section>
  </PaperShell>;
}

function WaitingGlyph() {
  return <span className="waiting-status-mark" aria-hidden="true">
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M42.8 10.4A22.8 22.8 0 1 0 51.6 51 20.7 20.7 0 0 1 42.8 10.4Z" />
      <circle cx="47" cy="17" r="2.5" />
      <circle cx="54" cy="28" r="1.7" />
    </svg>
  </span>;
}

function Waiting({ room, onLeave, toast, dismissToast }) {
  const players = room.players || [];
  const visiblePlayers = players.slice(0, 6);
  const remainingPlayers = Math.max(0, players.length - visiblePlayers.length);

  return <PaperShell profileName="Người chơi" onLeave={onLeave}>
    {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
    <section className="ritual-screen waiting-screen">
      <div className="paper-panel waiting-panel" aria-labelledby="waiting-title">
        <span className="ribbon blue">Đang chuẩn bị</span>
        <WaitingGlyph />
        <p className="waiting-kicker">Bàn chơi đang được chuẩn bị</p>
        <h2 id="waiting-title">Quan Trò đang chia vai</h2>
        <p className="waiting-lead">Bạn đã vào phòng thành công. Hãy ở lại đây — vai bí mật sẽ xuất hiện ngay khi Quan Trò hoàn tất.</p>
        <p className="sr-only" role="status" aria-live="polite">Đang chờ Quan Trò hoàn tất chia vai.</p>

        <ol className="waiting-steps" aria-label="Tiến trình nhận vai">
          <li className="complete"><span>1</span><div><strong>Vào phòng</strong><small>Hoàn tất</small></div></li>
          <li className="active" aria-current="step"><span>2</span><div><strong>Chia vai</strong><small>Đang thực hiện</small></div></li>
          <li><span>3</span><div><strong>Nhận vai</strong><small>Sắp tới</small></div></li>
        </ol>

        <div className="waiting-privacy-note">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 5.5 5.6v5.3c0 4.4 2.7 8.4 6.5 10.1 3.8-1.7 6.5-5.7 6.5-10.1V5.6L12 3Zm0 4.1a2.2 2.2 0 0 1 1.3 4v2.8h-2.6v-2.8a2.2 2.2 0 0 1 1.3-4Z" /></svg>
          <div><strong>Giữ màn hình riêng tư</strong><span>Chỉ bạn nên nhìn thấy vai được tiết lộ trên thiết bị này.</span></div>
        </div>

        <section className="waiting-roster" aria-labelledby="waiting-roster-title">
          <header><h3 id="waiting-roster-title">Người chơi đã sẵn sàng</h3><span>{room.playerCount ?? players.length} người</span></header>
          <div className="waiting-roster-grid">
            {visiblePlayers.map((player) => <article key={player.id}><span className="waiting-player-avatar">{playerInitial(player.name)}</span><strong>{player.name}</strong></article>)}
            {remainingPlayers > 0 && <article className="waiting-roster-more" aria-label={`Và ${remainingPlayers} người chơi khác`}><span>+{remainingPlayers}</span><strong>người khác</strong></article>}
          </div>
        </section>
      </div>
    </section>
  </PaperShell>;
}

function Moderator({ room, roles, assignments, catalog, onLeave, onMark, onDay, onNight, toast, dismissToast }) {
  const night = room.gamePhase === "night";
  const scriptRoles = night
    ? roles.filter((role) => roleWakesTonight(role, room.gameDay)).sort((left, right) => left.nightOrder - right.nightOrder)
    : roles.filter((role) => ["mayor", "hunter", "prince", "tanner"].includes(role.id));
  const [activeView, setActiveView] = useState("script");
  const [dayDeathCandidateId, setDayDeathCandidateId] = useState(null);
  const tabRefs = useRef({});
  useEffect(() => {
    setActiveView("script");
    setDayDeathCandidateId(null);
  }, [room.gamePhase, room.gameDay]);
  const confirmDayDeath = (playerId) => {
    onMark(playerId, true);
    setDayDeathCandidateId(null);
  };
  const selectModeratorView = (view) => setActiveView(view);
  const handleTabKeyDown = (event, currentView) => {
    const views = ["script", "players"];
    const currentIndex = views.indexOf(currentView);
    let nextIndex = currentIndex;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (currentIndex + 1) % views.length;
    else if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (currentIndex - 1 + views.length) % views.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = views.length - 1;
    else return;
    event.preventDefault();
    const nextView = views[nextIndex];
    setActiveView(nextView);
    tabRefs.current[nextView]?.focus();
  };
  // Build a map of playerId -> role object for the role roster
  const roleById = useMemo(() => new Map((catalog || []).map((r) => [r.id, r])), [catalog]);
  const assignmentMap = useMemo(() => new Map((assignments || []).map((a) => [a.playerId, roleById.get(a.roleId)])), [assignments, roleById]);
  return <PaperShell profileName={room.hostName} onLeave={onLeave} phase={room.gamePhase}>
    {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
    <section className="moderator-screen">
      <header className="moderator-command-bar">
        <div className="moderator-phase-row">
          <div className="moderator-phase-title">
            <span>Giai đoạn hiện tại</span>
            <h2>{night ? `Đêm ${room.gameDay}` : `Ngày ${room.gameDay}`}</h2>
          </div>
          <button className="paper-button moderator-phase-action" type="button" onClick={night ? onDay : onNight}>{night ? "Mở ban ngày" : `Bắt đầu đêm ${room.gameDay + 1}`}</button>
        </div>
        <div className="moderator-tabs" role="tablist" aria-label="Chế độ điều khiển Quan Trò">
          <button ref={(node) => { tabRefs.current.script = node; }} id="moderator-tab-script" className={activeView === "script" ? "active" : ""} type="button" role="tab" aria-selected={activeView === "script"} aria-controls="moderator-panel-script" tabIndex={activeView === "script" ? 0 : -1} onClick={() => selectModeratorView("script")} onKeyDown={(event) => handleTabKeyDown(event, "script")}>Kịch bản</button>
          <button ref={(node) => { tabRefs.current.players = node; }} id="moderator-tab-players" className={activeView === "players" ? "active" : ""} type="button" role="tab" aria-selected={activeView === "players"} aria-controls="moderator-panel-players" tabIndex={activeView === "players" ? 0 : -1} onClick={() => selectModeratorView("players")} onKeyDown={(event) => handleTabKeyDown(event, "players")}>Người chơi <span aria-hidden="true">{room.players.length}</span></button>
        </div>
      </header>
      <div id="moderator-panel-script" className="moderator-view-panel" role="tabpanel" aria-labelledby="moderator-tab-script" tabIndex="0" hidden={activeView !== "script"}>
        <div className="script-panel">
          <h3>{night ? "Lời dẫn theo thứ tự" : "Lời dẫn ban ngày"}</h3>
          <p className="moderator-view-note">{night ? "Đọc từng lời dẫn theo thứ tự. Chuyển sang Người chơi bất cứ lúc nào để đánh dấu người sẽ chết khi sáng." : "Cho người chơi thảo luận và biểu quyết. Chuyển sang Người chơi để xác nhận mọi trường hợp tử vong ban ngày."}</p>
          {!night && <article className="script-row featured-script"><span className="script-order">NG</span><div><strong>Mở đầu ban ngày</strong><small>Trời đã sáng, mọi người mở mắt. Những người còn sống bắt đầu thảo luận. Khi kết thúc thảo luận, làng sẽ biểu quyết một người bị nghi ngờ. Quan Trò ghi nhận kết quả trước khi chuyển sang đêm tiếp theo.</small></div></article>}
          {scriptRoles.length ? scriptRoles.map((role) => <article className="script-row" key={role.id}><span className="script-order">{night ? role.nightOrder : "!"}</span><div><strong>{role.name}{role.quantity > 1 ? ` × ${role.quantity}` : ""}</strong><small>{scriptForRole(role, room)}</small></div></article>) : night ? <p className="status-line">Đêm này không có vai nào cần thức dậy.</p> : <p className="status-line">Không có vai đặc biệt cần nhắc trong ban ngày.</p>}
        </div>
      </div>
      <div id="moderator-panel-players" className="moderator-view-panel" role="tabpanel" aria-labelledby="moderator-tab-players" tabIndex="-1" hidden={activeView !== "players"}>
        <div className="death-panel"><div className="death-panel-heading"><div><h3>{night ? "Ghi nhận trong đêm" : "Ghi nhận ban ngày"}</h3><p className="death-panel-note">{night ? "Đánh dấu có thể đảo ngược cho đến khi mở ban ngày." : "Tử vong ban ngày chỉ được gửi sau bước xác nhận."}</p></div><span>{room.players.filter((player) => player.isAlive !== false).length} còn sống</span></div><div className="death-roster moderator-roster">{room.players.map((player) => {
          const role = assignmentMap.get(player.id);
          const alive = player.isAlive !== false;
          const stateLabel = !alive ? "Đã chết" : player.pendingDeath ? "Chờ chết khi sáng" : "Còn sống";
          return <article className={`player-card moderator-player ${!alive ? "dead" : ""} ${player.pendingDeath ? "pending" : ""} team-${role?.team || "unknown"}`} key={player.id}><span className="player-avatar" aria-hidden="true">{playerInitial(player.name)}</span><div className="player-info-col"><p title={player.name}>{player.name}</p>{role ? <div className="player-card-role"><span className="roster-role-name" title={role.name}>{role.name}</span><span className={`roster-team-badge team-${role.team}`}>{TEAM_LABELS[role.team] || role.team}</span></div> : <span className="roster-role-name muted">Chưa có vai</span>}<span className="status-label" aria-live="polite">{stateLabel}</span></div>{night && alive && <button className={`mark-death ${player.pendingDeath ? "marked" : ""}`} type="button" aria-label={`${player.pendingDeath ? "Bỏ đánh dấu chết khi sáng cho" : "Đánh dấu chết khi sáng cho"} ${player.name}`} aria-pressed={Boolean(player.pendingDeath)} onClick={() => onMark(player.id, !player.pendingDeath)}>{player.pendingDeath ? "Bỏ đánh dấu" : "Chết khi sáng"}</button>}{!night && alive && (dayDeathCandidateId === player.id ? <span className="day-death-confirm" role="group" aria-label={`Xác nhận ${player.name} đã chết`}><span>Xác nhận đã chết?</span><button className="mark-death marked" type="button" onClick={() => confirmDayDeath(player.id)}>Xác nhận</button><button className="mark-death" type="button" onClick={() => setDayDeathCandidateId(null)}>Hủy</button></span> : <button className="mark-death day" type="button" aria-label={`Ghi nhận ${player.name} đã chết`} onClick={() => setDayDeathCandidateId(player.id)}>Ghi nhận chết</button>)}</article>
        })}</div></div>
      </div>
    </section>
  </PaperShell>;
}

function GameEnded({ room, summary, isHost, onLeave, onContinue, onDisband, processing, toast, dismissToast }) {
  return <PaperShell profileName={isHost ? room.hostName : "Người chơi"} onLeave={onLeave}>
    {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
    <section className="ritual-screen"><div className="paper-panel game-ended-panel"><span className="ribbon">Ván chơi kết thúc</span><p className="game-ended-kicker">Kết quả chung cuộc</p><h2>{WINNER_LABELS[room.winner] || "Ván chơi kết thúc"}</h2><p>{room.endReason}</p><div className="game-ended-count"><strong>{room.players.filter((player) => player.isAlive).length}</strong><span>người còn sống</span></div><section className="post-game-summary" aria-labelledby="post-game-summary-title"><h3 id="post-game-summary-title">Tất cả vai trò</h3>{summary.length ? <div className="post-game-summary-list">{summary.map((player) => <article className={`post-game-player ${player.isAlive ? "survived" : "dead"}`} key={player.playerId}><span className="player-avatar">{playerInitial(player.name)}</span><div><strong>{player.name}</strong><span className="post-game-role">{player.role?.name || "Vai trò không có dữ liệu"}</span></div><span className="post-game-status">{player.isAlive ? "Còn sống" : player.deathNight ? `Đã chết · Đêm ${player.deathNight}` : "Đã chết (không rõ đêm)"}</span></article>)}</div> : <p className="post-game-empty">Đang tải kết quả vai trò. Nếu dữ liệu cũ không đầy đủ, hãy hỏi Quan Trò.</p>}</section>{isHost ? <div className="post-game-actions"><p>Ván chơi đã kết thúc. Hãy chọn tiếp tục với đội hình hiện tại hoặc giải tán phòng.</p><button className="paper-button" type="button" disabled={Boolean(processing)} onClick={onContinue}>Tiếp tục với đội hình hiện tại</button><button className="paper-button destructive" type="button" disabled={Boolean(processing)} onClick={onDisband}>Giải tán phòng</button></div> : <p className="post-game-wait">Ván chơi đã kết thúc. Đang chờ Quan Trò quyết định tiếp tục hoặc giải tán phòng.</p>}</div></section>
  </PaperShell>;
}

function PlayerRole({ room, player, role, flipped, setFlipped, toast, dismissToast }) {
  const dead = player?.isAlive === false;
  if (!role) {
    return <PaperShell profileName={player?.name || "Người chơi"} phase={room.gamePhase}>
      {toast && <button className="toast" type="button" onClick={dismissToast}>{toast}</button>}
      <section className="player-board-screen">
        <div className="paper-panel waiting-panel waiting-panel-compact">
          <WaitingGlyph />
          <p className="waiting-kicker">Đang bảo mật thông tin</p>
          <h2>Đang nhận vai</h2>
          <p className="waiting-lead">Quan Trò đã bắt đầu ván chơi. Vai của bạn sẽ hiện ngay khi hệ thống hoàn tất bảo mật.</p>
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
