// VideoTracker.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/*
  Complete Video Tracker with:
  - YouTube IFrame API player
  - Accurate play-time counting (counts played seconds; rewinds + rewatch counted)
  - Tab-switch counting (viewsTaken) while playing
  - Focus-timer popup (on load) — while focus timer active, tab-switch deducts coins
  - Coin system:
      * start with 50 coins
      * -5 coins per tab-switch during active focus timer (cannot go negative)
      * if coins == 0 => player locked, must "Purchase Premium" (dummy)
      * daily +1 coin for watching at least one session per day; if streak maintained, +5 extra
  - Notes per video (saved to localStorage)
  - Weekly stats and last 5 days list
  - Persist everything to localStorage (single object key)
*/

const STORAGE_KEY = "video_tracker_v3";
const INITIAL_COINS = 50;
const TAB_SWITCH_COST = 5;
const DAILY_BONUS = 1;
const STREAK_BONUS = 5;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        history: [],
        notes: {}, // videoId -> text
        stats: {}, // videoId -> { totalSeconds, totalViews }
        coins: INITIAL_COINS,
        streak: 0,
        lastDayWatched: null, // ISO date string
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    return {
      history: [],
      notes: {},
      stats: {},
      coins: INITIAL_COINS,
      streak: 0,
      lastDayWatched: null,
    };
  }
}
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function extractYouTubeId(urlOrId) {
  if (!urlOrId) return null;
  if (/^[0-9A-Za-z_-]{11}$/.test(urlOrId)) return urlOrId;
  const regex =
    /(?:youtube\.com\/.*(?:v=|embed\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/;
  const m = urlOrId.match(regex);
  return m ? m[1] : null;
}

export default function VideoTracker() {
  // App state
  const [appState, setAppState] = useState(() => loadState());
  const [inputUrl, setInputUrl] = useState("");
  const [videoId, setVideoId] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionPlayedSeconds, setSessionPlayedSeconds] = useState(0);
  const [sessionViewsTaken, setSessionViewsTaken] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [tagText, setTagText] = useState("");
  const [weeklyStats, setWeeklyStats] = useState({});
  const [lastFiveDays, setLastFiveDays] = useState([]);
  const [showTimerPopup, setShowTimerPopup] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [focusRemaining, setFocusRemaining] = useState(null); // seconds or null
  const [isPlayerMaximized, setIsPlayerMaximized] = useState(false);
  const [player, setPlayer] = useState(null);
  const [earnedThisSessionCoins, setEarnedThisSessionCoins] = useState(false);

  // refs
  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const lastSampleRef = useRef(0);

  // load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  }, []);

  // persist overall state when appState changes
  useEffect(() => {
    saveState(appState);
    // recompute weekly stats & last 5 days view
    computeWeeklyStats(appState.history);
    computeLastFiveDays(appState.history);
  }, [appState]);

  // Focus timer countdown
  useEffect(() => {
    if (focusRemaining === null) return;
    if (focusRemaining <= 0) {
      setFocusRemaining(null);
      // When focus timer ends, session continues but tab-switches no longer cost
      return;
    }
    const t = setTimeout(() => setFocusRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [focusRemaining]);

  // Initialize YT player when videoId is set
  useEffect(() => {
    if (!videoId) return;

    function createPlayer() {
      if (!window.YT || !window.YT.Player) {
        setTimeout(createPlayer, 300);
        return;
      }
      // Destroy old player
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }

      const p = new window.YT.Player("vt-player", {
        videoId,
        playerVars: {
          controls: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (e) => {
            setPlayerReady(true);
            setPlayer(p);
            lastSampleRef.current = p.getCurrentTime() || 0;
            setSessionPlayedSeconds(0);
            setSessionViewsTaken(0);
            setEarnedThisSessionCoins(false);
            // load note if exists
            setNoteText(appState.notes?.[videoId] || "");
            setTagText("");
          },
          onStateChange: (e) => {
            const state = e.data;
            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              startPolling();
            } else {
              setIsPlaying(false);
              stopPolling();
              if (state === window.YT.PlayerState.ENDED) {
                // finalize session on end
                finalizeSession(true);
              }
            }
          },
        },
      });
      playerRef.current = p;
    }

    createPlayer();
    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Polling to sample currentTime and accumulate played seconds
  const startPolling = () => {
    if (!playerRef.current || pollRef.current) return;
    lastSampleRef.current = playerRef.current.getCurrentTime() || 0;
    pollRef.current = setInterval(() => {
      if (!playerRef.current) return;
      const now = playerRef.current.getCurrentTime() || 0;
      const last = lastSampleRef.current || 0;
      // If advanced forward or small buffer increase count positive deltas.
      if (now >= last) {
        const delta = now - last;
        if (delta > 0 && delta < 60) {
          setSessionPlayedSeconds((s) => s + delta);
        }
      } else {
        // rewind occurred: don't subtract. When they rewatch, positive deltas will be added.
      }
      lastSampleRef.current = now;
      setCurrentTime(now);
    }, 800);
  };
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Tab switch handling: count views and deduct coins if focusRemaining active
  useEffect(() => {
    const onVisibility = () => {
      if (!playerRef.current) return;
      if (document.visibilityState === "hidden" && isPlaying) {
        setSessionViewsTaken((v) => v + 1);
        if (focusRemaining && focusRemaining > 0) {
          // Deduct TAB_SWITCH_COST but not below 0
          setAppState((prev) => {
            const newCoins = Math.max(0, (prev.coins || 0) - TAB_SWITCH_COST);
            const updated = { ...prev, coins: newCoins };
            // If coins became 0, lock prevention is handled on load time
            return updated;
          });
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isPlaying, focusRemaining]);

  // finalize session: call when user stops manually or video ends
  const finalizeSession = (ended = false) => {
    if (!videoId) return;
    const secondsWatched = Math.floor(sessionPlayedSeconds);
    if (secondsWatched <= 0 && sessionViewsTaken === 0) {
      // nothing to save
      cleanupAfterSession();
      return;
    }

    const now = new Date();
    const newHistoryEntry = {
      videoId,
      url: `https://youtu.be/${videoId}`,
      watchedAt: now.toISOString(),
      seconds: secondsWatched,
      viewsTaken: sessionViewsTaken,
      notes: noteText || appState.notes?.[videoId] || "",
      tag: tagText || "",
    };

    setAppState((prev) => {
      // update stats for the video
      const stats = { ...(prev.stats || {}) };
      const prevStat = stats[videoId] || { totalSeconds: 0, totalViews: 0 };
      stats[videoId] = {
        totalSeconds: prevStat.totalSeconds + secondsWatched,
        totalViews: prevStat.totalViews + sessionViewsTaken,
      };

      // Daily bonus and streak logic:
      let coins = prev.coins ?? INITIAL_COINS;
      let streak = prev.streak ?? 0;
      let lastDay = prev.lastDayWatched ? new Date(prev.lastDayWatched) : null;
      const todayStr = now.toISOString().split("T")[0];

      // If lastDay is different day than today, award daily bonus
      const lastDayStr = lastDay ? lastDay.toISOString().split("T")[0] : null;
      if (lastDayStr !== todayStr) {
        // award daily coin
        coins += DAILY_BONUS;
        // streak continuation check: if lastDay was yesterday -> continue, else reset
        if (lastDay) {
          const diff = (now - lastDay) / (1000 * 60 * 60 * 24);
          if (diff <= 1.5) {
            streak = (streak || 0) + 1;
            // if streak continues (>=2) award streak bonus once
            if (streak > 1) {
              coins += STREAK_BONUS;
            }
          } else {
            streak = 1;
          }
        } else {
          streak = 1;
        }
        lastDay = new Date(now.toISOString().split("T")[0]); // set to today's date
      }

      // Save notes if present
      const notes = { ...(prev.notes || {}) };
      if (noteText) notes[videoId] = noteText;

      // Push history
      const history = [...(prev.history || []), newHistoryEntry];

      const updated = {
        ...prev,
        history,
        stats,
        notes,
        coins,
        streak,
        lastDayWatched: lastDay ? lastDay.toISOString() : prev.lastDayWatched,
      };
      return updated;
    });

    setEarnedThisSessionCoins(true);
    cleanupAfterSession(ended);
  };

  // cleanup after session (stop player, reset session variables)
  const cleanupAfterSession = (ended = false) => {
    try {
      if (playerRef.current) {
        playerRef.current.pauseVideo();
        // Optionally destroy if ended
        if (ended) {
          playerRef.current.stopVideo();
          playerRef.current.destroy();
          playerRef.current = null;
        }
      }
    } catch (e) {}
    setVideoId(ended ? null : videoId); // if ended, clear videoId to unmount
    setPlayer(null);
    setIsPlaying(false);
    setSessionPlayedSeconds(0);
    setSessionViewsTaken(0);
    setCurrentTime(0);
    setFocusRemaining(null);
    stopPolling();
  };

  // Load video flow: show timer popup first
  const handleLoadClick = () => {
    if (appState.coins <= 0) {
      alert("You have 0 coins. Please purchase Premium to continue watching videos.");
      return;
    }
    const id = extractYouTubeId(inputUrl.trim());
    if (!id) {
      alert("Please paste a valid YouTube URL or ID.");
      return;
    }
    setVideoId(id);
    setShowTimerPopup(true);
    setInputUrl("");
  };

  const confirmStartFocus = () => {
    setFocusRemaining(focusMinutes * 60);
    setShowTimerPopup(false);
    // player will initialize via useEffect on videoId
  };

  // Manual Stop & Save
  const handleStopSave = () => {
    finalizeSession(false);
  };

  // Save notes manually without stopping
  const handleSaveNotes = () => {
    if (!videoId) {
      alert("Load a video first");
      return;
    }
    setAppState((prev) => {
      const notes = { ...(prev.notes || {}) };
      notes[videoId] = noteText;
      return { ...prev, notes };
    });
    alert("Notes saved locally");
  };

  // Purchase premium (dummy) - adds coins
  const purchasePremium = () => {
    if (!window.confirm("Purchase Premium (demo): add 100 coins?")) return;
    setAppState((prev) => {
      const coins = (prev.coins || 0) + 100;
      return { ...prev, coins };
    });
    alert("Premium purchase successful (demo). 100 coins added.");
  };

  // compute weekly stats (aggregate by weekday or date)
  const computeWeeklyStats = (history) => {
    const stats = {};
    history.forEach((h) => {
      const d = new Date(h.watchedAt);
      const key = d.toLocaleDateString();
      stats[key] = (stats[key] || 0) + Math.floor(h.seconds / 60); // minutes
    });
    setWeeklyStats(stats);
  };

  // compute last 5 days history list
  const computeLastFiveDays = (history) => {
    const fiveDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 5;
    const recent = history.filter((h) => new Date(h.watchedAt).getTime() >= fiveDaysAgo);
    recent.sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
    setLastFiveDays(recent);
  };

  useEffect(() => {
    computeWeeklyStats(appState.history);
    computeLastFiveDays(appState.history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // format time
  const niceTime = (s) => {
    s = Math.floor(s);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h) return `${h}h ${m}m ${sec}s`;
    if (m) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  // quick clear history (dev)
  const clearHistory = () => {
    if (!window.confirm("Clear all history, stats, notes?")) return;
    setAppState({
      history: [],
      notes: {},
      stats: {},
      coins: INITIAL_COINS,
      streak: 0,
      lastDayWatched: null,
    });
    setLastFiveDays([]);
  };

  // beforeunload save (ensure session not lost) — finalize automatically if playing
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isPlaying && (sessionPlayedSeconds > 0 || sessionViewsTaken > 0)) {
        // Save minimal info (do a finalize)
        finalizeSession(false);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, sessionPlayedSeconds, sessionViewsTaken, videoId]);

  // render
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎥 Study Video Tracker</h1>
        <div style={styles.wallet}>
          <span style={styles.coin}>🪙 {appState.coins}</span>
          <span style={styles.streak}>🔥 {appState.streak} day streak</span>
          <button style={styles.premiumBtn} onClick={purchasePremium}>
            Buy Premium
          </button>
        </div>
      </div>

      {/* Input + Load */}
      <div style={styles.panel}>
        <input
          placeholder="Paste YouTube URL or id..."
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          style={styles.input}
          disabled={appState.coins <= 0}
        />
        <button onClick={handleLoadClick} style={styles.button} disabled={appState.coins <= 0}>
          {appState.coins <= 0 ? "Locked (Buy Premium)" : "Load Video"}
        </button>
        <button onClick={clearHistory} style={{ ...styles.button, background: "#e55353" }}>
          Clear All (dev)
        </button>
      </div>

      {/* Focus Timer Popup */}
      {showTimerPopup && (
        <div style={styles.popup}>
          <div style={styles.popupInner}>
            <h3>Set Focus Timer</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
              <input
                type="number"
                min={1}
                max={180}
                value={focusMinutes}
                onChange={(e) => setFocusMinutes(Number(e.target.value))}
                style={{ width: 80, padding: 8 }}
              />
              <div>minutes</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button onClick={confirmStartFocus} style={styles.button}>
                Start Focus ({focusMinutes} min)
              </button>
              <button onClick={() => { setShowTimerPopup(false); setVideoId(null); }} style={{ ...styles.button, background: "#aaa", marginLeft: 8 }}>
                Cancel
              </button>
            </div>
            <p style={{ marginTop: 12, color: "#444", fontSize: 13 }}>
              During active focus timer, each tab switch deducts {TAB_SWITCH_COST} coins.
            </p>
          </div>
        </div>
      )}

      {/* Player area */}
      <div style={styles.panel}>
        {focusRemaining !== null && (
          <div style={styles.focusBar}>
            ⏱ Focus left: <strong>{Math.floor(focusRemaining / 60)}:{String(focusRemaining % 60).padStart(2, "0")}</strong>
          </div>
        )}

        {videoId ? (
          <>
            <div style={isPlayerMaximized ? styles.playerMax : styles.player}>
              <div id="vt-player" style={{ width: "100%", height: "100%", background: "#000" }} />
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <button onClick={() => setIsPlayerMaximized((s) => !s)} style={styles.smallBtn}>
                  {isPlayerMaximized ? "Minimize" : "Maximize"}
                </button>
                <button onClick={handleStopSave} style={{ ...styles.smallBtn, background: "#e55353", marginLeft: 8 }}>
                  Stop & Save
                </button>
              </div>

              <div style={{ textAlign: "right" }}>
                <div>Current Time: {currentTime ? currentTime.toFixed(1) + "s" : "0s"}</div>
                <div>Session Watched: {niceTime(sessionPlayedSeconds)}</div>
                <div>Tab Switches this session: {sessionViewsTaken}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <textarea
                placeholder="Notes for this video..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                style={{ width: "100%", minHeight: 90, padding: 8 }}
              />
              <input
                placeholder="Tag (optional)"
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
                style={{ marginTop: 8, padding: 8, width: 240 }}
              />
              <div style={{ marginTop: 8 }}>
                <button onClick={handleSaveNotes} style={styles.button}>
                  Save Notes
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={styles.placeholder}>Paste a YouTube link and click Load to start.</div>
        )}
      </div>

      {/* Weekly Stats (BarChart) */}
      <div style={styles.panel}>
        <h3>📊 Weekly Study Performance (minutes)</h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={Object.keys(weeklyStats).map((k) => ({ date: k, mins: weeklyStats[k] }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="mins" fill="#6366F1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Last 5 Days */}
      <div style={styles.panel}>
        <h3>📅 Last 5 Days History</h3>
        {lastFiveDays.length === 0 ? (
          <p style={{ color: "#666" }}>No activity in the last 5 days.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {lastFiveDays.map((h, idx) => (
              <div key={idx} style={styles.historyCard}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <a href={h.url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>{h.url}</a>
                    <div style={{ color: "#666", fontSize: 13 }}>{new Date(h.watchedAt).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>{niceTime(h.seconds)}</div>
                    <div style={{ color: "#666" }}>{h.viewsTaken} views</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong>Notes:</strong> {h.notes || <span style={{ color: "#999" }}>No notes</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All-time summary */}
      <div style={styles.panel}>
        <h3>🏆 All Videos Summary</h3>
        {Object.keys(appState.stats || {}).length === 0 ? (
          <p style={{ color: "#666" }}>No stats yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(appState.stats).map(([vid, s]) => (
              <div key={vid} style={styles.historyCard}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <a href={`https://youtu.be/${vid}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>{vid}</a>
                    <div style={{ color: "#666", fontSize: 13 }}>{(appState.notes && appState.notes[vid]) ? appState.notes[vid].slice(0, 80) : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>{niceTime(s.totalSeconds)}</div>
                    <div style={{ color: "#666" }}>{s.totalViews} views</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 60 }} />
      <style>{`
        @media (max-width: 760px) {
          #vt-player { height: 220px !important; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Inline styles ---------- */
const styles = {
  page: {
    maxWidth: 980,
    margin: "28px auto",
    padding: 16,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial",
    color: "#111",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  title: { fontSize: 26, margin: 0 },
  wallet: { display: "flex", gap: 12, alignItems: "center" },
  coin: { background: "#FFFBEB", padding: "6px 12px", borderRadius: 8 },
  streak: { background: "#EFF6FF", padding: "6px 12px", borderRadius: 8 },
  premiumBtn: { padding: "8px 10px", borderRadius: 8, background: "#2b6ef7", color: "#fff", border: "none", cursor: "pointer" },

  panel: {
    background: "#fff",
    borderRadius: 10,
    padding: 14,
    boxShadow: "0 6px 20px rgba(17,24,39,0.06)",
    marginTop: 14,
  },
  input: { width: "65%", padding: 10, borderRadius: 8, border: "1px solid #ddd" },
  button: { marginLeft: 8, padding: "10px 14px", borderRadius: 8, background: "#2b6ef7", color: "#fff", border: "none", cursor: "pointer" },

  popup: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
  },
  popupInner: { background: "#fff", padding: 18, borderRadius: 10, width: 360, textAlign: "center" },

  focusBar: { marginBottom: 8, padding: 8, background: "#f0f9ff", borderRadius: 8 },

  player: { width: "100%", height: 360, borderRadius: 8, overflow: "hidden", background: "#000" },
  playerMax: { position: "fixed", inset: 0, background: "#000", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" },

  smallBtn: { padding: "6px 10px", borderRadius: 8, border: "none", background: "#6b7280", color: "#fff", cursor: "pointer" },

  placeholder: { padding: 28, border: "2px dashed #eee", borderRadius: 8, textAlign: "center", color: "#666" },

  historyCard: { padding: 12, borderRadius: 8, background: "#fafafa", border: "1px solid #eee" },
};
