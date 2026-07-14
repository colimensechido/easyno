import { Ban, Crown, EyeOff, Gamepad2, Hash, MessageCircle, Send, ShieldBan, Trophy, UserRound, Users, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

function relationFor(settings, userId) {
  return settings?.relations?.find((item) => Number(item.userId) === Number(userId)) || {
    userId, muted: false, ignored: false, blocked: false
  };
}

export default function SocialPanel({
  open,
  onClose,
  token,
  socket,
  currentUser,
  players,
  world,
  roomMessages = [],
  onSendRoomMessage,
  settings,
  onSettingsChange,
  liveDirectMessages = [],
  initialUserId = null
}) {
  const [activeSection, setActiveSection] = useState("room");
  const [selectedUserId, setSelectedUserId] = useState(initialUserId || null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [directText, setDirectText] = useState("");
  const [roomText, setRoomText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chatRef = useRef(null);

  const people = useMemo(
    () => players.filter((player) => Number(player.userId) !== Number(currentUser.id)),
    [players, currentUser.id]
  );
  const selected = people.find((player) => Number(player.userId) === Number(selectedUserId))
    || settings?.relations?.find((player) => Number(player.userId) === Number(selectedUserId))
    || null;
  const relation = relationFor(settings, selectedUserId);
  const directThread = useMemo(() => {
    const merged = [...history];
    for (const message of liveDirectMessages) {
      const belongs = [message.senderId, message.recipientId].includes(Number(selectedUserId));
      if (belongs && !merged.some((item) => item.id === message.id)) merged.push(message);
    }
    return merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [history, liveDirectMessages, selectedUserId]);

  useEffect(() => {
    if (!open) return;
    if (initialUserId) {
      setSelectedUserId(initialUserId);
      setActiveSection("direct");
    } else {
      setActiveSection("room");
    }
    setError("");
  }, [initialUserId, open]);

  useEffect(() => {
    if (!open || !selectedUserId) return;
    setBusy(true);
    Promise.all([
      api(`/api/users/${selectedUserId}/profile`, { token }),
      api(`/api/direct-messages/${selectedUserId}`, { token }).catch(() => ({ messages: [] }))
    ]).then(([nextProfile, conversation]) => {
      setProfile(nextProfile);
      setHistory(conversation.messages || []);
      setError("");
    }).catch((nextError) => setError(nextError.message)).finally(() => setBusy(false));
  }, [open, selectedUserId, token]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [activeSection, directThread.length, roomMessages.length]);

  function selectPlayer(userId) {
    setSelectedUserId(userId);
    setActiveSection("direct");
  }

  async function toggleChatSound() {
    try {
      const payload = await api("/api/social/settings", {
        method: "PATCH", token, body: { chatMuted: !settings?.chatMuted }
      });
      onSettingsChange(payload);
      setError("");
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function updateRelation(patch) {
    if (!selectedUserId) return;
    try {
      const payload = await api(`/api/social/relations/${selectedUserId}`, {
        method: "PUT", token, body: { ...relation, ...patch }
      });
      onSettingsChange(payload);
      setError("");
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  function sendDirect(event) {
    event.preventDefault();
    const nextText = directText.trim();
    if (!socket || !selectedUserId || !nextText || relation.blocked) return;
    socket.emit("send_direct_message", { recipientId: Number(selectedUserId), text: nextText }, (response) => {
      if (!response?.ok) return setError(response?.error || "No se pudo enviar");
      setDirectText("");
      setError("");
    });
  }

  function sendRoom(event) {
    event.preventDefault();
    const nextText = roomText.trim();
    if (!nextText || !world || !onSendRoomMessage) return;
    onSendRoomMessage(nextText, (response) => {
      if (!response?.ok) return setError(response?.error || "No se pudo enviar al chat de sala");
      setRoomText("");
      setError("");
    });
  }

  if (!open) return null;
  const stats = profile?.stats || {};

  return (
    <div className="social-overlay" data-report-exclude onMouseDown={onClose}>
      <section className="social-panel" role="dialog" aria-modal="true" aria-label="Centro social" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <span><Users size={19} /><i><strong>Centro social</strong><small>{world ? world.name : "EasyNo"}</small></i></span>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="social-layout">
          <aside>
            <div className="social-chat-master">
              <span>{settings?.chatMuted ? <VolumeX size={16} /> : <Volume2 size={16} />} Notificaciones</span>
              <button type="button" onClick={toggleChatSound}>{settings?.chatMuted ? "Activar" : "Silenciar"}</button>
            </div>
            <button type="button" className={`social-room-shortcut ${activeSection === "room" ? "is-active" : ""}`} onClick={() => setActiveSection("room")}>
              <span><Hash size={15} /></span><strong>Chat de sala</strong><em>{roomMessages.length}</em>
            </button>
            <small>Jugadores en esta sala</small>
            {people.map((player) => (
              <button type="button" key={player.userId} className={activeSection === "direct" && Number(selectedUserId) === Number(player.userId) ? "is-active" : ""} onClick={() => selectPlayer(player.userId)}>
                <span>{player.username?.[0]?.toUpperCase()}</span><strong>{player.username}</strong>{player.isVip && <Crown size={13} />}
              </button>
            ))}
            {!people.length && <p>No hay otros jugadores conectados.</p>}
            {!!settings?.relations?.length && <small>Moderados recientemente</small>}
            {settings?.relations?.filter((item) => !people.some((player) => Number(player.userId) === Number(item.userId))).map((player) => (
              <button type="button" key={player.userId} onClick={() => selectPlayer(player.userId)}><span>{player.username?.[0]?.toUpperCase()}</span><strong>{player.username}</strong></button>
            ))}
          </aside>

          <main>
            <nav className="social-section-tabs" aria-label="Tipo de conversación">
              <button type="button" className={activeSection === "room" ? "is-active" : ""} onClick={() => setActiveSection("room")}><Hash size={15} /> Sala</button>
              <button type="button" className={activeSection === "direct" ? "is-active" : ""} onClick={() => setActiveSection("direct")} disabled={!selected}><MessageCircle size={15} /> Directo</button>
            </nav>

            {activeSection === "room" ? (
              <>
                <div className="social-room-heading">
                  <span><Hash size={18} /></span>
                  <div><h2>{world ? `Chat de ${world.name}` : "Chat de sala"}</h2><small>El mismo chat que ves dentro de la mesa, sincronizado en tiempo real.</small></div>
                </div>
                <div className="direct-chat room-chat" ref={chatRef}>
                  {roomMessages.map((message) => {
                    const isMe = Number(message.userId) === Number(currentUser.id);
                    return (
                      <p className={isMe ? "is-me" : ""} key={message.id}>
                        <button type="button" disabled={isMe} onClick={() => selectPlayer(message.userId)}>{message.username}</button>
                        <span>{message.text}</span>
                        <time>{new Date(message.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</time>
                      </p>
                    );
                  })}
                  {!roomMessages.length && <div className="social-empty"><MessageCircle size={24} /><p>Aún no hay mensajes en esta sala.</p></div>}
                </div>
                <form className="direct-chat-form" onSubmit={sendRoom}>
                  <input value={roomText} onChange={(event) => setRoomText(event.target.value)} maxLength={240} disabled={!world || !socket?.connected} placeholder={world ? "Escribe para toda la sala..." : "Entra a una sala para chatear"} />
                  <button type="submit" disabled={!roomText.trim() || !world || !socket?.connected}><Send size={16} /></button>
                </form>
              </>
            ) : !selected ? (
              <div className="social-empty"><MessageCircle size={34} /><p>Selecciona a un jugador para ver su perfil o escribirle.</p></div>
            ) : (
              <>
                <div className="social-profile-head">
                  <div><span>{selected.username?.[0]?.toUpperCase()}</span><h2>{profile?.user?.username || selected.username}</h2>{profile?.user?.isVip && <em><Crown size={12} /> VIP</em>}</div>
                  <div className="social-actions">
                    <button className={relation.muted ? "is-active" : ""} type="button" onClick={() => updateRelation({ muted: !relation.muted })} title="No reproducir sonido de sus mensajes"><VolumeX size={15} /> Mutear</button>
                    <button className={relation.ignored ? "is-active" : ""} type="button" onClick={() => updateRelation({ ignored: !relation.ignored })} title="Ocultar sus mensajes públicos"><EyeOff size={15} /> Ignorar</button>
                    <button className={relation.blocked ? "is-danger" : ""} type="button" onClick={() => updateRelation({ blocked: !relation.blocked })} title="Ocultar e impedir mensajes directos"><ShieldBan size={15} /> Bloquear</button>
                  </div>
                </div>
                {busy ? <div className="social-empty">Cargando perfil...</div> : profile && (
                  <div className="profile-stats">
                    <span><UserRound size={15} /><small>Nivel</small><strong>{stats.level}</strong></span>
                    <span><Gamepad2 size={15} /><small>Partidas</small><strong>{stats.gamesPlayed}</strong></span>
                    <span><Trophy size={15} /><small>Blackjack</small><strong>{stats.blackjackWins}/{stats.blackjackPlayed} · {stats.blackjackWinRate}%</strong></span>
                    <span><Trophy size={15} /><small>BolowPoly</small><strong>{stats.monopolyWins}/{stats.monopolyPlayed} · {stats.monopolyWinRate}%</strong></span>
                  </div>
                )}
                <div className="direct-chat" ref={chatRef}>
                  {directThread.map((message) => <p className={message.senderId === currentUser.id ? "is-me" : ""} key={message.id}><small>{message.senderUsername}</small><span>{message.text}</span></p>)}
                  {!directThread.length && <div className="social-empty"><MessageCircle size={24} /><p>Aún no hay mensajes directos.</p></div>}
                </div>
                <form className="direct-chat-form" onSubmit={sendDirect}>
                  <input value={directText} onChange={(event) => setDirectText(event.target.value)} maxLength={500} disabled={relation.blocked} placeholder={relation.blocked ? "Conversación bloqueada" : `Mensaje para ${selected.username}...`} />
                  <button type="submit" disabled={relation.blocked || !directText.trim()}><Send size={16} /></button>
                </form>
              </>
            )}
            {error && <p className="social-error"><Ban size={14} /> {error}</p>}
          </main>
        </div>
      </section>
    </div>
  );
}
