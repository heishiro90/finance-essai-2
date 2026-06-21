import { useState, useEffect } from "react";
import Papa from "papaparse";
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";

// ─── Google Sheet Config ─────────────────────────────────────────────
const SHEET_ID = "103L2tbh4k-dO4ErocdcmdB-AYHawn1eP";
const sheetURL = (gid) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

const GIDS = {
  patrimoine: 1268865620,
  allocation: 1405080811,
  performance: 505917293,
  budget: 1356346616,
  taux_epargne: 1358448140,
  fire: 421404807,
  kpis: 519558224,
};

// ─── Couleurs ────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0a0e17", card: "#111827", border: "#1e293b",
  accent: "#22d3ee", accentDim: "rgba(34,211,238,0.15)",
  green: "#10b981", greenDim: "rgba(16,185,129,0.15)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.15)",
  orange: "#f59e0b", orangeDim: "rgba(245,158,11,0.15)",
  purple: "#a78bfa", purpleDim: "rgba(167,139,250,0.15)",
  text: "#e2e8f0", textDim: "#64748b", textMuted: "#475569",
};
const pieColors = ["#22d3ee", "#10b981", "#f59e0b", "#a78bfa", "#ec4899", "#6366f1"];

// ─── Number parsing ──────────────────────────────────────────────────
// Handles every numeric format that can come out of Google Sheets,
// whether US-style ("1,000.00") or French-style ("1 000,00" / "0,31").
function parseLocaleNumber(str) {
  let s = String(str).trim().replace(/\s/g, ""); // drop spaces (incl. nbsp)
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Both separators present → the LAST one is the decimal separator.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // French: "1.000,00" → dot = thousands, comma = decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: "1,000.00" → comma = thousands, dot = decimal
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only a comma. "1,000" (groups of 3 digits) → thousands; "0,31" → decimal.
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
  }
  // Only a dot, or a plain integer → parseFloat handles it directly.
  return parseFloat(s);
}

// ─── Fetch helper ────────────────────────────────────────────────────
async function fetchSheet(gid) {
  const res = await fetch(sheetURL(gid));
  const csv = await res.text();
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  // Post-process: turn numeric-looking strings into real numbers.
  return data.map(row => {
    const cleaned = {};
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === "string") {
        const s = val.trim();
        // Percentages: "31,0%", "24%", "8.4%" → fraction (0.31, 0.24, 0.084)
        const pctMatch = s.match(/^(-?[\d.,\s]+)\s*%$/);
        if (pctMatch) {
          const n = parseLocaleNumber(pctMatch[1]);
          if (!Number.isNaN(n)) { cleaned[key] = n / 100; continue; }
        }
        // Any other number: thousands separators and/or decimals, either convention.
        // Must be made only of digits / separators (so dates like "2020-07-01"
        // and labels like "Jan 20" or hex colors are left untouched).
        if (/^-?[\d.,\s]+$/.test(s) && /\d/.test(s)) {
          const n = parseLocaleNumber(s);
          if (!Number.isNaN(n)) { cleaned[key] = n; continue; }
        }
      }
      cleaned[key] = val;
    }
    return cleaned;
  });
}

// ─── Sub-components ──────────────────────────────────────────────────
const KPI = ({ label, value, sub, trend, color }) => (
  <div style={{
    background: COLORS.card, border: `1px solid ${COLORS.border}`,
    borderRadius: 16, padding: "22px 24px", flex: 1, minWidth: 180,
    position: "relative", overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 3,
      background: color || COLORS.accent, borderRadius: "16px 16px 0 0",
    }} />
    <div style={{ fontSize: 12, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
      {label}
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.1 }}>
      {value}
    </div>
    {sub && (
      <div style={{
        marginTop: 8, fontSize: 13,
        color: trend === "up" ? COLORS.green : trend === "down" ? COLORS.red : COLORS.textDim,
        display: "flex", alignItems: "center", gap: 4,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {trend === "up" && "▲"}{trend === "down" && "▼"} {sub}
      </div>
    )}
  </div>
);

const SectionTitle = ({ children, icon }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
    paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}`,
  }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <span style={{
      fontSize: 15, fontWeight: 600, color: COLORS.text,
      letterSpacing: 0.5, textTransform: "uppercase",
      fontFamily: "'JetBrains Mono', monospace",
    }}>{children}</span>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: "#1a2332", border: `1px solid ${COLORS.border}`,
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ color: COLORS.textDim, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("fr-FR") + " €" : p.value}
        </div>
      ))}
    </div>
  );
};

const LoadingScreen = () => (
  <div style={{
    background: COLORS.bg, minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
  }}>
    <div style={{
      width: 40, height: 40, border: `3px solid ${COLORS.border}`,
      borderTopColor: COLORS.accent, borderRadius: "50%",
      animation: "spin 1s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{ color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
      Chargement des données...
    </div>
  </div>
);

const ErrorScreen = ({ error, onRetry }) => (
  <div style={{
    background: COLORS.bg, minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
    padding: 32,
  }}>
    <div style={{ fontSize: 48 }}>⚠️</div>
    <div style={{ color: COLORS.red, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, textAlign: "center", maxWidth: 500 }}>
      Erreur de chargement des données
    </div>
    <div style={{ color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textAlign: "center", maxWidth: 500 }}>
      {error}
    </div>
    <div style={{ color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textAlign: "center", maxWidth: 500, marginTop: 8 }}>
      Vérifie que ton Google Sheet est publié :<br/>
      Fichier → Partager → Publier sur le Web → Publier
    </div>
    <button onClick={onRetry} style={{
      marginTop: 12, padding: "10px 24px", background: COLORS.accent,
      color: COLORS.bg, border: "none", borderRadius: 8, cursor: "pointer",
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
    }}>
      Réessayer
    </button>
  </div>
);

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredAlloc, setHoveredAlloc] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [patrimoine, allocation, performance, budget, taux_epargne, fire, kpis] =
        await Promise.all([
          fetchSheet(GIDS.patrimoine),
          fetchSheet(GIDS.allocation),
          fetchSheet(GIDS.performance),
          fetchSheet(GIDS.budget),
          fetchSheet(GIDS.taux_epargne),
          fetchSheet(GIDS.fire),
          fetchSheet(GIDS.kpis),
        ]);
      setData({ patrimoine, allocation, performance, budget, taux_epargne, fire, kpis });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={loadData} />;

  // ─── Transform data ──────────────────────────────────────────────
  const { patrimoine, allocation, performance, budget, taux_epargne, fire, kpis } = data;

  // Patrimoine history
  const wealthHistory = patrimoine.map((r) => ({
    month: r.Mois || "",
    crypto: r.Crypto || 0,
    bourse: r.Bourse || 0,
    immo: r.Immobilier || 0,
    or: r.Or || 0,
    cash: r.Cash_Livrets || 0,
    total: r.Total || 0,
  }));

  // Allocation pie
  const allocationData = allocation
    .filter((r) => r.Classe_Actif && r.Classe_Actif !== "TOTAL")
    .map((r, i) => ({
      name: r.Classe_Actif,
      value: r.Valeur_EUR || 0,
      pct: typeof r.Part_Pct === "number" ? (r.Part_Pct * 100).toFixed(1) : r.Part_Pct,
      color: r.Couleur_Hex || pieColors[i % pieColors.length],
    }));

  const totalPatrimoine = allocationData.reduce((s, a) => s + a.value, 0);

  // Performance
  const perfAssets = performance.map((r) => ({
    name: r.Classe_Actif,
    perf: typeof r.Perf_YTD_Pct === "number" ? (r.Perf_YTD_Pct * 100) : r.Perf_YTD_Pct,
  }));

  // Budget — dernier mois
  const budgetMonths = [...new Set(budget.map((r) => r.Mois))];
  const latestMonth = budgetMonths[budgetMonths.length - 1] || "";
  const latestBudget = budget.filter((r) => r.Mois === latestMonth);
  const revenus = latestBudget.filter((r) => r.Type === "Revenu");
  const depenses = latestBudget.filter((r) => r.Type === "Dépense");
  const totalRevenus = revenus.reduce((s, r) => s + (r.Montant_EUR || 0), 0);
  const totalDepenses = depenses.reduce((s, r) => s + (r.Montant_EUR || 0), 0);
  const budgetDisplay = [
    { cat: "Revenus", montant: totalRevenus },
    ...depenses.map((r) => ({ cat: r.Categorie, montant: r.Montant_EUR })),
  ];
  const resteAVivre = totalRevenus + totalDepenses;

  // Taux d'épargne
  const savingsRate = taux_epargne.map((r) => {
    let taux = r.Taux_Epargne_Pct || r["Taux_Epargne_Pct"] || 0;
    if (typeof taux === "number" && taux <= 1) taux = Math.round(taux * 100);
    else if (typeof taux === "number") taux = Math.round(taux);
    return {
      m: (r.Mois || "").replace(/ 24$/, ""),
      taux,
    };
  });

  // KPIs
  const kpiMap = {};
  kpis.forEach((r) => { kpiMap[r.KPI] = r; });
  const patrimoineKpi = kpiMap["Patrimoine Net"];
  const revenuKpi = kpiMap["Revenus Mensuels"];
  const eparKpi = kpiMap["Taux d'Épargne"];
  const fireKpi = kpiMap["Progression FIRE"];

  const fmtEur = (v) => typeof v === "number" ? v.toLocaleString("fr-FR") + " €" : v;
  const fmtPct = (v) => typeof v === "number" ? (v * 100).toFixed(1) + "%" : v;

  // FIRE projection
  const fireParams = {};
  fire.forEach((r) => {
    const key = r["Paramètre"] || r["Parametre"] || r["paramètre"] || "";
    const val = r.Valeur || r["Valeur"] || 0;
    if (key) fireParams[key] = val;
  });
  const fireAge = Number(fireParams["Âge actuel"]) || Number(fireParams["Age actuel"]) || 39;
  const fireTarget = Number(fireParams["Objectif FIRE (€)"]) || Number(fireParams["Objectif FIRE"]) || 600000;
  const fireMonthlySave = Number(fireParams["Épargne mensuelle (€)"]) || Number(fireParams["Epargne mensuelle (€)"]) || 1200;
  const fireRate = Number(fireParams["Rendement pondéré"]) || Number(fireParams["Rendement pondere"]) || 0.072;
  const fireWithdrawal = Number(fireParams["Taux de retrait annuel"]) || 0.07;
  const fireData = (() => {
    let vals = [];
    let pessimist = totalPatrimoine, median = totalPatrimoine, optimist = totalPatrimoine;
    for (let y = 0; y <= 15; y++) {
      vals.push({
        age: fireAge + y,
        pessimiste: Math.round(pessimist),
        "médian": Math.round(median),
        optimiste: Math.round(optimist),
        objectif: fireTarget,
      });
      pessimist = pessimist * (1 + fireRate * 0.8) + fireMonthlySave * 12;
      median = median * (1 + fireRate) + fireMonthlySave * 12;
      optimist = optimist * (1 + fireRate * 1.2) + fireMonthlySave * 12;
    }
    return vals;
  })();

  let fireAgeEstimate = "N/A";
  for (const d of fireData) {
    if (d["médian"] >= fireTarget) { fireAgeEstimate = `~${d.age} ans`; break; }
  }

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh", color: COLORS.text,
      fontFamily: "'Outfit', 'Segoe UI', sans-serif", padding: "28px 32px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div style={{
            fontSize: 11, color: COLORS.accent, letterSpacing: 3,
            textTransform: "uppercase", marginBottom: 6,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Finances Personnelles
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 700, margin: 0,
            fontFamily: "'Space Grotesk', sans-serif",
            background: "linear-gradient(135deg, #e2e8f0, #22d3ee)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Tableau de Bord
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={loadData} style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: "8px 14px", cursor: "pointer",
            color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          }}>
            ↻ Rafraîchir
          </button>
          <div style={{
            fontSize: 12, color: COLORS.textDim,
            fontFamily: "'JetBrains Mono', monospace",
            background: COLORS.card, padding: "8px 16px",
            borderRadius: 8, border: `1px solid ${COLORS.border}`,
          }}>
            Données live — Google Sheets
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <KPI
          label="Patrimoine Net"
          value={fmtEur(patrimoineKpi?.Valeur ?? totalPatrimoine)}
          sub={patrimoineKpi?.Variation ? `${fmtPct(patrimoineKpi.Variation)} YTD` : ""}
          trend={patrimoineKpi?.Variation > 0 ? "up" : "down"}
          color={COLORS.accent}
        />
        <KPI
          label="Revenus Mensuels"
          value={fmtEur(revenuKpi?.Valeur ?? totalRevenus)}
          sub={revenuKpi?.Variation === 0 ? "Stable" : fmtPct(revenuKpi?.Variation)}
          color={COLORS.green}
        />
        <KPI
          label="Taux d'Épargne"
          value={fmtPct(eparKpi?.Valeur ?? 0)}
          sub={eparKpi?.Variation ? `+${Math.round(eparKpi.Variation * 100)}pts vs 2023` : ""}
          trend="up"
          color={COLORS.orange}
        />
        <KPI
          label="Objectif FIRE"
          value={fmtPct(fireKpi?.Valeur ?? totalPatrimoine / fireTarget)}
          sub={`${fmtEur(totalPatrimoine)} / ${fmtEur(fireTarget)}`}
          color={COLORS.purple}
        />
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Wealth evolution */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, padding: 24, gridColumn: "1 / -1",
        }}>
          <SectionTitle icon="📈">Évolution du Patrimoine</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={wealthHistory} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCrypto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pieColors[0]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={pieColors[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBourse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pieColors[1]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={pieColors[1]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradImmo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pieColors[2]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={pieColors[2]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pieColors[3]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={pieColors[3]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="month" tick={{ fill: COLORS.textDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} />
              <YAxis tick={{ fill: COLORS.textDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="cash" stackId="1" stroke={pieColors[3]} fill="url(#gradCash)" name="Cash / Livrets" />
              <Area type="monotone" dataKey="or" stackId="1" stroke="#ec4899" fill="none" name="Or" />
              <Area type="monotone" dataKey="immo" stackId="1" stroke={pieColors[2]} fill="url(#gradImmo)" name="Immobilier" />
              <Area type="monotone" dataKey="bourse" stackId="1" stroke={pieColors[1]} fill="url(#gradBourse)" name="Bourse" />
              <Area type="monotone" dataKey="crypto" stackId="1" stroke={pieColors[0]} fill="url(#gradCrypto)" name="Crypto" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation pie */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, padding: 24,
        }}>
          <SectionTitle icon="🎯">Répartition du Patrimoine</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie
                  data={allocationData} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90} paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, i) => setHoveredAlloc(i)}
                  onMouseLeave={() => setHoveredAlloc(null)}
                  stroke="none"
                >
                  {allocationData.map((entry, i) => (
                    <Cell key={i} fill={entry.color}
                      opacity={hoveredAlloc === null || hoveredAlloc === i ? 1 : 0.3}
                      style={{ transition: "opacity 0.2s", cursor: "pointer" }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {allocationData.map((a, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", borderRadius: 8, marginBottom: 4,
                  background: hoveredAlloc === i ? `${a.color}15` : "transparent",
                  transition: "background 0.2s", cursor: "pointer",
                }}
                  onMouseEnter={() => setHoveredAlloc(i)}
                  onMouseLeave={() => setHoveredAlloc(null)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: a.color }} />
                    <span style={{ fontSize: 13, color: COLORS.text }}>{a.name}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {typeof a.value === "number" ? a.value.toLocaleString("fr-FR") : a.value} €
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                      {a.pct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, padding: 24,
        }}>
          <SectionTitle icon="⚡">Performance YTD par Classe</SectionTitle>
          <div style={{ marginTop: 8 }}>
            {perfAssets.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: i < perfAssets.length - 1 ? `1px solid ${COLORS.border}` : "none",
              }}>
                <div style={{ flex: 1, fontSize: 14, color: COLORS.text }}>{a.name}</div>
                <div style={{
                  flex: 2, position: "relative", height: 24,
                  background: COLORS.bg, borderRadius: 6, overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${Math.min(a.perf / 50 * 100, 100)}%`,
                    background: `linear-gradient(90deg, ${a.perf > 20 ? COLORS.green : a.perf > 10 ? COLORS.accent : COLORS.orange}44, ${a.perf > 20 ? COLORS.green : a.perf > 10 ? COLORS.accent : COLORS.orange})`,
                    borderRadius: 6, transition: "width 0.8s ease",
                  }} />
                </div>
                <div style={{
                  width: 70, textAlign: "right", fontSize: 14, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: a.perf > 20 ? COLORS.green : a.perf > 10 ? COLORS.accent : COLORS.orange,
                }}>
                  +{typeof a.perf === "number" ? a.perf.toFixed(1) : a.perf}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budget mensuel */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, padding: 24,
        }}>
          <SectionTitle icon="💰">Budget Mensuel — {latestMonth}</SectionTitle>
          <div style={{ marginTop: 4 }}>
            {budgetDisplay.map((b, i) => {
              const isRevenu = b.montant > 0;
              const pct = Math.abs(b.montant) / totalRevenus * 100;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
                  borderBottom: i < budgetDisplay.length - 1 ? `1px solid ${COLORS.border}` : "none",
                }}>
                  <div style={{ width: 110, fontSize: 13, color: COLORS.text }}>{b.cat}</div>
                  <div style={{
                    flex: 1, position: "relative", height: 20,
                    background: COLORS.bg, borderRadius: 5, overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: isRevenu
                        ? `linear-gradient(90deg, ${COLORS.greenDim}, ${COLORS.green})`
                        : b.cat === "Épargne"
                          ? `linear-gradient(90deg, ${COLORS.accentDim}, ${COLORS.accent})`
                          : `linear-gradient(90deg, ${COLORS.redDim}, ${COLORS.red}88)`,
                      borderRadius: 5,
                    }} />
                  </div>
                  <div style={{
                    width: 80, textAlign: "right", fontSize: 13, fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: isRevenu ? COLORS.green : b.cat === "Épargne" ? COLORS.accent : COLORS.text,
                  }}>
                    {isRevenu ? "+" : ""}{b.montant.toLocaleString("fr-FR")} €
                  </div>
                </div>
              );
            })}
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: resteAVivre >= 0 ? COLORS.greenDim : COLORS.redDim,
              borderRadius: 8, display: "flex", justifyContent: "space-between",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
            }}>
              <span style={{ color: resteAVivre >= 0 ? COLORS.green : COLORS.red }}>Reste à vivre</span>
              <span style={{ color: resteAVivre >= 0 ? COLORS.green : COLORS.red, fontWeight: 700 }}>
                {resteAVivre >= 0 ? "+" : ""}{resteAVivre.toLocaleString("fr-FR")} €
              </span>
            </div>
          </div>
        </div>

        {/* Taux d'épargne */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, padding: 24,
        }}>
          <SectionTitle icon="📊">Taux d'Épargne Mensuel</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={savingsRate} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="m" tick={{ fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} />
              <YAxis tick={{ fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{
                  background: "#1a2332", border: `1px solid ${COLORS.border}`,
                  borderRadius: 10, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                }}
                formatter={(v) => [`${v}%`, "Taux d'épargne"]}
              />
              <Bar dataKey="taux" radius={[4, 4, 0, 0]} fillOpacity={1}>
                {savingsRate.map((entry, i) => (
                  <Cell key={i} fill={entry.taux >= 30 ? "#00FF9F" : entry.taux >= 25 ? "#00D4FF" : "#FFD600"} fillOpacity={1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{
            display: "flex", gap: 16, marginTop: 8, justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.textDim,
          }}>
            <span><span style={{ color: "#00FF9F" }}>●</span> ≥ 30%</span>
            <span><span style={{ color: "#00D4FF" }}>●</span> 25-29%</span>
            <span><span style={{ color: "#FFD600" }}>●</span> &lt; 25%</span>
          </div>
        </div>

        {/* Projection FIRE */}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 16, padding: 24,
        }}>
          <SectionTitle icon="🔥">Projection FIRE</SectionTitle>
          <div style={{
            display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          }}>
            <div style={{ background: COLORS.purpleDim, padding: "6px 14px", borderRadius: 8 }}>
              <span style={{ color: COLORS.textDim }}>Objectif</span>{" "}
              <span style={{ color: COLORS.purple, fontWeight: 600 }}>{fmtEur(fireTarget)}</span>
            </div>
            <div style={{ background: COLORS.greenDim, padding: "6px 14px", borderRadius: 8 }}>
              <span style={{ color: COLORS.textDim }}>FIRE estimé</span>{" "}
              <span style={{ color: COLORS.green, fontWeight: 600 }}>{fireAgeEstimate}</span>
            </div>
            <div style={{ background: COLORS.orangeDim, padding: "6px 14px", borderRadius: 8 }}>
              <span style={{ color: COLORS.textDim }}>Retrait</span>{" "}
              <span style={{ color: COLORS.orange, fontWeight: 600 }}>{Math.round(fireWithdrawal * 100)}% / an</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={fireData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradFire" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="age" tick={{ fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} />
              <YAxis tick={{ fill: COLORS.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: COLORS.border }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="objectif" stroke={COLORS.red} strokeDasharray="6 4" fill="none" name="Objectif" strokeWidth={2} />
              <Area type="monotone" dataKey="pessimiste" stroke={COLORS.orange} fill="none" name="Pessimiste" strokeWidth={1.5} strokeDasharray="3 3" />
              <Area type="monotone" dataKey="médian" stroke={COLORS.green} fill="url(#gradFire)" name="Médian" strokeWidth={2} />
              <Area type="monotone" dataKey="optimiste" stroke={COLORS.accent} fill="none" name="Optimiste" strokeWidth={1.5} strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: "center", marginTop: 20, padding: "16px 0",
        borderTop: `1px solid ${COLORS.border}`,
        fontSize: 11, color: COLORS.textMuted,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        Données live depuis Google Sheets • Cliquez sur ↻ Rafraîchir pour mettre à jour
      </div>
    </div>
  );
}
