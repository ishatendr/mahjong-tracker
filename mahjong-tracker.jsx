import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, Users, ListPlus, History, BarChart3, Settings2, Check } from "lucide-react";

// ---------- helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (s) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
};
const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
const fmt = (n) => {
  const v = Math.round(n);
  return v < 0 ? `▲${Math.abs(v).toLocaleString()}` : v.toLocaleString();
};
const colorFor = (n) => (n < 0 ? "#d64545" : n > 0 ? "#2a6fb0" : "#555");

const DEFAULT_PLAYERS = ["あなた", "はんや", "あきみち", "おおうち"];
const AVATAR_COLORS = ["#7fd17f", "#7fc8e8", "#f0c46a", "#e89bbf", "#b79ee8", "#f0a06a"];

function emptyGame() {
  const count = 4;
  return {
    id: uid(),
    date: todayStr(),
    rate: 50,
    chipValue: 100,
    baba: 0,
    playerCount: count,
    players: Array(count).fill(""),
    rounds: [],
    chips: Array(count).fill(""),
  };
}

// Resolves a row of n cells where some may be "" (blank).
// If exactly one cell is blank, it is auto-computed so the row sums to 0.
function resolveRow(raw, n) {
  const blanks = [];
  const nums = raw.map((v, i) => {
    if (v === "" || v === null || v === undefined) { blanks.push(i); return null; }
    return Number(v) || 0;
  });
  if (blanks.length === 1) {
    const autoIdx = blanks[0];
    const known = sum(nums.filter((v, i) => i !== autoIdx));
    nums[autoIdx] = -known;
    return { values: nums.map((v) => v ?? 0), autoIdx };
  }
  return { values: nums.map((v) => v ?? 0), autoIdx: -1 };
}

// ---------- storage ----------
async function loadAll() {
  try {
    const g = await window.storage.get("games", false);
    const games = g ? JSON.parse(g.value) : [];
    const r = await window.storage.get("roster", false);
    const roster = r ? JSON.parse(r.value) : DEFAULT_PLAYERS;
    return { games, roster };
  } catch {
    return { games: [], roster: DEFAULT_PLAYERS };
  }
}
async function saveGames(games) {
  try { await window.storage.set("games", JSON.stringify(games), false); } catch {}
}
async function saveRoster(roster) {
  try { await window.storage.set("roster", JSON.stringify(roster), false); } catch {}
}

// ---------- main ----------
export default function MahjongApp() {
  const [loaded, setLoaded] = useState(false);
  const [games, setGames] = useState([]);
  const [roster, setRoster] = useState(DEFAULT_PLAYERS);
  const [tab, setTab] = useState("input"); // input | history | stats | settings
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAll().then(({ games, roster }) => {
      setGames(games);
      setRoster(roster);
      setLoaded(true);
    });
  }, []);

  useEffect(() => { if (loaded) saveGames(games); }, [games, loaded]);
  useEffect(() => { if (loaded) saveRoster(roster); }, [roster, loaded]);

  const startNewGame = useCallback(() => {
    setDraft(emptyGame());
    setEditingId(null);
    setTab("input");
  }, []);

  useEffect(() => {
    if (loaded && !draft) startNewGame();
  }, [loaded]); // eslint-disable-line

  const editGame = (g) => {
    setDraft(JSON.parse(JSON.stringify(g)));
    setEditingId(g.id);
    setTab("input");
  };

  const saveDraft = (finalGame) => {
    const g = finalGame || draft;
    if (!g) return;
    if (g.players.some((p) => !p.trim())) {
      setError("プレイヤー名を入力してください");
      return;
    }
    setError("");
    setGames((prev) => {
      const exists = prev.some((x) => x.id === g.id);
      if (exists) return prev.map((x) => (x.id === g.id ? g : x));
      return [g, ...prev];
    });
    // merge new player names into roster
    setRoster((prev) => {
      const next = [...prev];
      g.players.forEach((p) => {
        if (p && !next.includes(p)) next.push(p);
      });
      return next;
    });
    startNewGame();
  };

  const deleteGame = (id) => {
    setGames((prev) => prev.filter((g) => g.id !== id));
  };

  if (!loaded || !draft) {
    return (
      <div style={S.appLoading}>
        <div style={S.loadingDot} />
        対局データを読み込み中…
      </div>
    );
  }

  return (
    <div style={S.app}>
      <div style={S.header}>
        <span style={S.headerTitle}>雀記 — Mahjong Score</span>
      </div>

      <div style={S.body}>
        {tab === "input" && (
          <GameInput
            draft={draft}
            setDraft={setDraft}
            roster={roster}
            setRoster={setRoster}
            onSave={saveDraft}
            onCancel={startNewGame}
            isEditing={!!editingId}
            error={error}
          />
        )}
        {tab === "history" && (
          <History_
            games={games}
            onEdit={editGame}
            onDelete={deleteGame}
            onNew={startNewGame}
          />
        )}
        {tab === "stats" && <Stats games={games} roster={roster} />}
        {tab === "settings" && <SettingsPanel roster={roster} setRoster={setRoster} />}
      </div>

      <div style={S.tabbar}>
        <TabBtn icon={<BarChart3 size={20} />} label="成績" active={tab === "stats"} onClick={() => setTab("stats")} />
        <TabBtn icon={<History size={20} />} label="履歴" active={tab === "history"} onClick={() => setTab("history")} />
        <TabBtn icon={<ListPlus size={20} />} label="入力" active={tab === "input"} onClick={() => setTab("input")} highlight />
        <TabBtn icon={<Users size={20} />} label="メンバー" active={tab === "settings"} onClick={() => setTab("settings")} />
      </div>
    </div>
  );
}

function TabBtn({ icon, label, active, onClick, highlight }) {
  return (
    <button onClick={onClick} style={{ ...S.tabBtn, color: active ? "#1f7a4d" : "#888" }}>
      <div style={{ ...S.tabIcon, background: active && highlight ? "#e5f5ec" : "transparent" }}>{icon}</div>
      <span style={{ fontSize: 11, marginTop: 2 }}>{label}</span>
    </button>
  );
}

// ---------- Game Input ----------
function GameInput({ draft, setDraft, roster, setRoster, onSave, onCancel, isEditing, error }) {
  const n = draft.playerCount;

  const setPlayerCount = (count) => {
    setDraft((d) => {
      const players = d.players.slice(0, count);
      while (players.length < count) players.push("");
      const rounds = d.rounds.map((r) => {
        const scores = r.scores.slice(0, count);
        while (scores.length < count) scores.push("");
        return { scores };
      });
      const chips = d.chips.slice(0, count);
      while (chips.length < count) chips.push("");
      return { ...d, playerCount: count, players, rounds, chips };
    });
  };

  const setPlayerName = (i, name) => {
    setDraft((d) => {
      const players = [...d.players];
      players[i] = name;
      return { ...d, players };
    });
  };

  const addRound = () => {
    setDraft((d) => ({ ...d, rounds: [...d.rounds, { scores: Array(n).fill("") }] }));
  };
  const removeRound = (idx) => {
    setDraft((d) => ({ ...d, rounds: d.rounds.filter((_, i) => i !== idx) }));
  };
  const setScore = (roundIdx, playerIdx, val) => {
    setDraft((d) => {
      const rounds = d.rounds.map((r, i) => {
        if (i !== roundIdx) return r;
        const scores = [...r.scores];
        scores[playerIdx] = val;
        return { scores };
      });
      return { ...d, rounds };
    });
  };
  const setChip = (playerIdx, val) => {
    setDraft((d) => {
      const chips = [...d.chips];
      chips[playerIdx] = val;
      return { ...d, chips };
    });
  };

  // each round: whichever single cell is left blank gets the auto-computed value
  const resolvedRounds = draft.rounds.map((r) => resolveRow(r.scores, n));
  const computedRounds = resolvedRounds.map((r) => r.values);
  const totals = Array(n).fill(0).map((_, p) => sum(computedRounds.map((r) => r[p])));

  const resolvedChips = resolveRow(draft.chips, n);
  const chipsFull = resolvedChips.values;

  const settle = totals.map((t, i) => t * (Number(draft.rate) || 0) / 1000 + chipsFull[i] * (Number(draft.chipValue) || 0));
  const babaShare = (Number(draft.baba) || 0) / n;
  const settleFull = settle.map((s) => s - babaShare);

  const handleSave = () => {
    const finalRounds = draft.rounds.map((r) => ({ scores: resolveRow(r.scores, n).values }));
    const finalChips = resolveRow(draft.chips, n).values;
    onSave({ ...draft, rounds: finalRounds, chips: finalChips });
  };

  return (
    <div style={S.section}>
      <div style={S.formCard}>
        <Field label="対局日">
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={S.input} />
        </Field>
        <div style={S.row2}>
          <Field label="レート（円/千点）">
            <input type="number" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} style={S.input} />
          </Field>
          <Field label="チップ（円/枚）">
            <input type="number" value={draft.chipValue} onChange={(e) => setDraft({ ...draft, chipValue: e.target.value })} style={S.input} />
          </Field>
        </div>
        <Field label="場代（円・全体）">
          <input type="number" value={draft.baba} onChange={(e) => setDraft({ ...draft, baba: e.target.value })} style={S.input} />
        </Field>
        <Field label="人数">
          <div style={S.segment}>
            {[3, 4].map((c) => (
              <button
                key={c}
                onClick={() => setPlayerCount(c)}
                style={{ ...S.segmentBtn, ...(n === c ? S.segmentBtnActive : {}) }}
              >
                {c}人打ち
              </button>
            ))}
          </div>
        </Field>
      </div>

      <datalist id="roster-suggest">
        {roster.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div style={{ ...S.playerHeaderRow, gridTemplateColumns: `48px repeat(${n}, 1fr)` }}>
        <div />
        {draft.players.map((p, i) => (
          <input
            key={i}
            value={p}
            list="roster-suggest"
            onChange={(e) => setPlayerName(i, e.target.value)}
            style={{ ...S.playerNameInput, color: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
            placeholder={`P${i + 1}`}
          />
        ))}
      </div>
      <div style={S.hint}>※ 1人だけ点数を空欄にすると、その人の点数が残り全員の合計から自動計算されます（合計0）</div>

      <div style={S.scoreTable}>
        {draft.rounds.map((r, ri) => {
          const { autoIdx, values } = resolvedRounds[ri];
          return (
            <div key={ri} style={{ ...S.scoreRow, gridTemplateColumns: `24px 20px repeat(${n}, 1fr)` }}>
              <button onClick={() => removeRound(ri)} style={S.removeBtn}><X size={14} /></button>
              <div style={S.roundLabel}>{ri + 1}</div>
              {Array.from({ length: n }).map((_, pi) => {
                const isAuto = pi === autoIdx;
                return (
                  <input
                    key={pi}
                    type="number"
                    value={r.scores[pi]}
                    placeholder={isAuto ? String(values[pi]) : "—"}
                    onChange={(e) => setScore(ri, pi, e.target.value)}
                    style={{
                      ...S.scoreInput,
                      color: isAuto ? colorFor(values[pi]) : colorFor(Number(r.scores[pi]) || 0),
                      ...(isAuto ? S.scoreInputAuto : {}),
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <button onClick={addRound} style={S.addRoundBtn}>
        <Plus size={18} style={{ marginRight: 6 }} /> 行を追加
      </button>

      <div style={S.summaryTable}>
        <SummaryRow label="計" values={totals} render={fmt} colorize n={n} />
        <div style={{ ...S.chipRow, gridTemplateColumns: `44px repeat(${n}, 1fr)` }}>
          <div style={S.summaryLabel}>チップ</div>
          {Array.from({ length: n }).map((_, pi) => {
            const isAuto = pi === resolvedChips.autoIdx;
            return (
              <input
                key={pi}
                type="number"
                value={draft.chips[pi]}
                placeholder={isAuto ? String(chipsFull[pi]) : "—"}
                onChange={(e) => setChip(pi, e.target.value)}
                style={{
                  ...S.chipInput,
                  color: isAuto ? colorFor(chipsFull[pi]) : colorFor(Number(draft.chips[pi]) || 0),
                  ...(isAuto ? S.scoreInputAuto : {}),
                }}
              />
            );
          })}
        </div>
        <SummaryRow label="収支" values={settle} render={(v) => fmt(v) + "円"} colorize n={n} />
        <SummaryRow label="場代込" values={settleFull} render={(v) => fmt(v) + "円"} colorize emphasize n={n} />
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      <div style={S.actionRow}>
        {isEditing && (
          <button onClick={onCancel} style={S.cancelBtn}>キャンセル</button>
        )}
        <button onClick={handleSave} style={S.saveBtn}>
          <Check size={18} style={{ marginRight: 6 }} />{isEditing ? "更新する" : "保存する"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={S.field}>
      <div style={S.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function SummaryRow({ label, values, render, colorize, emphasize, n }) {
  return (
    <div style={{ ...S.summaryRowBase, ...(emphasize ? S.summaryRowEmph : {}), gridTemplateColumns: `44px repeat(${n}, 1fr)` }}>
      <div style={S.summaryLabel}>{label}</div>
      {values.map((v, i) => (
        <div key={i} style={{ ...S.summaryCell, color: colorize ? colorFor(v) : "#222" }}>{render(v)}</div>
      ))}
    </div>
  );
}

// ---------- History ----------
function History_({ games, onEdit, onDelete, onNew }) {
  if (games.length === 0) {
    return (
      <div style={S.section}>
        <div style={S.emptyState}>
          まだ対局が記録されていません。<br />「入力」タブから対局を登録しましょう。
        </div>
      </div>
    );
  }
  const sorted = [...games].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div style={S.section}>
      {sorted.map((g) => {
        const n = g.playerCount;
        const totals = Array(n).fill(0).map((_, p) => sum(g.rounds.map((r) => Number(r.scores[p]) || 0)));
        return (
          <div key={g.id} style={S.historyCard} onClick={() => onEdit(g)}>
            <div style={S.historyCardTop}>
              <span style={S.historyDate}>{fmtDate(g.date)}</span>
              <button
                style={S.trashBtn}
                onClick={(e) => { e.stopPropagation(); if (confirm("この対局を削除しますか？")) onDelete(g.id); }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div style={S.historyPlayers}>
              {g.players.map((p, i) => (
                <div key={i} style={S.historyPlayerChip}>
                  <span>{p}</span>
                  <span style={{ color: colorFor(totals[i]), fontWeight: 700 }}>{fmt(totals[i])}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Stats ----------
function Stats({ games, roster }) {
  if (games.length === 0) {
    return (
      <div style={S.section}>
        <div style={S.emptyState}>対局を記録すると通算成績がここに表示されます。</div>
      </div>
    );
  }
  const totalsByPlayer = {};
  games.forEach((g) => {
    const n = g.playerCount;
    const totals = Array(n).fill(0).map((_, p) => sum(g.rounds.map((r) => Number(r.scores[p]) || 0)));
    const chipsFull = g.chips.map((v) => Number(v) || 0);
    const settle = totals.map((t, i) => t * (Number(g.rate) || 0) / 1000 + chipsFull[i] * (Number(g.chipValue) || 0) - (Number(g.baba) || 0) / n);

    g.players.forEach((name, i) => {
      if (!totalsByPlayer[name]) totalsByPlayer[name] = { games: 0, score: 0, money: 0 };
      totalsByPlayer[name].games += 1;
      totalsByPlayer[name].score += totals[i];
      totalsByPlayer[name].money += settle[i];
    });
  });

  const rows = Object.entries(totalsByPlayer).sort((a, b) => b[1].money - a[1].money);

  return (
    <div style={S.section}>
      <div style={S.statsHeader}>通算成績（全{games.length}局）</div>
      {rows.map(([name, d], idx) => (
        <div key={name} style={S.statRow}>
          <div style={S.statRank}>{idx + 1}</div>
          <div style={S.statName}>{name}</div>
          <div style={S.statGames}>{d.games}局</div>
          <div style={{ ...S.statMoney, color: colorFor(d.money) }}>{fmt(d.money)}円</div>
        </div>
      ))}
    </div>
  );
}

// ---------- Settings ----------
function SettingsPanel({ roster, setRoster }) {
  const [newName, setNewName] = useState("");
  const addPlayer = () => {
    const name = newName.trim();
    if (!name || roster.includes(name)) return;
    setRoster([...roster, name]);
    setNewName("");
  };
  const removePlayer = (name) => {
    setRoster(roster.filter((p) => p !== name));
  };
  return (
    <div style={S.section}>
      <div style={S.statsHeader}>メンバー一覧</div>
      <div style={S.rosterList}>
        {roster.map((p) => (
          <div key={p} style={S.rosterChip}>
            <span>{p}</span>
            <button onClick={() => removePlayer(p)} style={S.rosterRemove}><X size={14} /></button>
          </div>
        ))}
      </div>
      <div style={S.addRosterRow}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新しいメンバー名"
          style={S.input}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
        />
        <button onClick={addPlayer} style={S.addRosterBtn}><Plus size={18} /></button>
      </div>
      <div style={S.hint}>※ 対局を保存すると、入力したプレイヤー名は自動的にここへ追加されます。</div>
    </div>
  );
}

// ---------- styles ----------
const S = {
  app: { fontFamily: "'Hiragino Sans','Helvetica Neue',sans-serif", background: "#f4f5f3", minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", color: "#222" },
  appLoading: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#888", gap: 8, fontFamily: "'Hiragino Sans',sans-serif" },
  loadingDot: { width: 8, height: 8, borderRadius: 8, background: "#1f7a4d" },
  header: { background: "#fff", padding: "16px 20px 12px", borderBottom: "1px solid #e7e7e3" },
  headerTitle: { fontSize: 18, fontWeight: 700, letterSpacing: 1, color: "#1f7a4d" },
  body: { flex: 1, overflowY: "auto", paddingBottom: 90 },
  section: { padding: 16 },
  formCard: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  input: { width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 15, boxSizing: "border-box", background: "#fafafa" },
  segment: { display: "flex", gap: 8 },
  segmentBtn: { flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #ddd", background: "#fafafa", fontSize: 14, color: "#666" },
  segmentBtnActive: { background: "#1f7a4d", color: "#fff", borderColor: "#1f7a4d", fontWeight: 700 },
  playerHeaderRow: { display: "grid", gridTemplateColumns: "44px repeat(4, 1fr)", gap: 4, marginBottom: 6, padding: "0 8px", boxSizing: "border-box" },
  playerNameInput: { width: "100%", minWidth: 0, boxSizing: "border-box", gridColumn: "span 1", border: "none", background: "transparent", fontWeight: 700, fontSize: 14, textAlign: "center", borderBottom: "2px solid currentColor", paddingBottom: 4 },
  hint: { fontSize: 11, color: "#999", marginBottom: 10 },
  scoreTable: { background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  scoreRow: { display: "grid", gridTemplateColumns: "24px 20px repeat(4, 1fr)", alignItems: "center", padding: "8px 8px", borderBottom: "1px solid #f0f0ed", gap: 4 },
  removeBtn: { background: "none", border: "none", color: "#bbb", padding: 2, cursor: "pointer" },
  roundLabel: { fontSize: 12, color: "#aaa", textAlign: "center" },
  scoreInput: { width: "100%", minWidth: 0, boxSizing: "border-box", border: "none", borderBottom: "1px solid #eee", textAlign: "center", fontSize: 17, fontWeight: 700, padding: "6px 0", background: "transparent" },
  scoreInputAuto: { borderBottom: "1px dashed #bbb", background: "#fafbf8" },
  scoreCellAuto: { textAlign: "center", fontSize: 17, fontWeight: 700, opacity: 0.75 },
  addRoundBtn: { width: "100%", background: "#1f7a4d", color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 700, margin: "12px 0 18px", display: "flex", alignItems: "center", justifyContent: "center" },
  summaryTable: { background: "#fff", borderRadius: 12, padding: "4px 8px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  summaryRowBase: { display: "grid", gridTemplateColumns: "44px repeat(4, 1fr)", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0ed" },
  summaryRowEmph: { borderBottom: "none" },
  summaryLabel: { fontSize: 13, color: "#888", fontWeight: 700 },
  summaryCell: { textAlign: "center", fontSize: 15, fontWeight: 700 },
  summaryCellAuto: { textAlign: "center", fontSize: 15, fontWeight: 700, opacity: 0.75 },
  chipRow: { display: "grid", gridTemplateColumns: "44px repeat(4, 1fr)", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0ed" },
  chipInput: { width: "100%", border: "none", borderBottom: "1px solid #eee", textAlign: "center", fontSize: 15, fontWeight: 700, padding: "4px 0", background: "transparent", boxSizing: "border-box" },
  errorBox: { color: "#d64545", fontSize: 13, marginTop: 12, textAlign: "center" },
  actionRow: { display: "flex", gap: 10, marginTop: 18 },
  saveBtn: { flex: 1, background: "#1f7a4d", color: "#fff", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  cancelBtn: { flex: 0.6, background: "#fff", color: "#888", border: "1px solid #ddd", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 700 },
  emptyState: { textAlign: "center", color: "#999", padding: "60px 20px", fontSize: 14, lineHeight: 1.8 },
  historyCard: { background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", cursor: "pointer" },
  historyCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  historyDate: { fontSize: 14, fontWeight: 700, color: "#333" },
  trashBtn: { background: "none", border: "none", color: "#ccc", padding: 4 },
  historyPlayers: { display: "flex", flexWrap: "wrap", gap: 8 },
  historyPlayerChip: { display: "flex", flexDirection: "column", alignItems: "center", background: "#f7f7f5", borderRadius: 8, padding: "6px 10px", fontSize: 12, minWidth: 64 },
  statsHeader: { fontSize: 14, fontWeight: 700, color: "#555", marginBottom: 12 },
  statRow: { display: "flex", alignItems: "center", background: "#fff", borderRadius: 10, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  statRank: { width: 24, fontSize: 13, color: "#aaa", fontWeight: 700 },
  statName: { flex: 1, fontSize: 15, fontWeight: 700 },
  statGames: { fontSize: 12, color: "#999", marginRight: 14 },
  statMoney: { fontSize: 16, fontWeight: 700 },
  rosterList: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  rosterChip: { display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 20, padding: "8px 12px", fontSize: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  rosterRemove: { background: "none", border: "none", color: "#ccc", padding: 0, display: "flex" },
  addRosterRow: { display: "flex", gap: 8, marginBottom: 8 },
  addRosterBtn: { background: "#1f7a4d", color: "#fff", border: "none", borderRadius: 8, width: 44, display: "flex", alignItems: "center", justifyContent: "center" },
  tabbar: { display: "flex", justifyContent: "space-around", background: "#fff", borderTop: "1px solid #e7e7e3", padding: "8px 0 16px", position: "sticky", bottom: 0 },
  tabBtn: { background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", flex: 1 },
  tabIcon: { padding: 6, borderRadius: 10 },
};
