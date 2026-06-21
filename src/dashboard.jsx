import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from "recharts";

/* ════════════════════════════════════════════════════════════════════
   CONFIG — à régler une fois ton vrai Google Sheet publié
   ──────────────────────────────────────────────────────────────────
   1. Ouvre ton Sheet → Fichier → Partager → "Tous les utilisateurs
      disposant du lien" → Lecteur.
   2. Passe DATA_SOURCE sur "live".
   3. Les onglets sont lus PAR NOM (pas par gid) via l'endpoint gviz,
      donc rien d'autre à configurer tant que tu ne renommes pas tes
      onglets.
   ════════════════════════════════════════════════════════════════════ */
const CONFIG = {
  DEFAULT_SHEET_URL: "",            // optionnel : pré-remplit le champ au démarrage
  STORAGE_KEY: "finance_dashboard_sheet_url",
  TABS: {
    wealth: "Wealth",
    budget: "Mon budget",
    bourse: "Bourse",
    crypto: "Cryptomonnaies",
    matieres: "Matières premières",
    data: "Data",
  },
  WEALTH_START: { year: 2020, month: 1 }, // 1er snapshot du Wealth (mois/année)
  BUDGET_BASE_YEAR: 2021,                 // année du 1er bloc de "Mon budget"
};

/* Extrait l'ID d'une URL Google Sheets — accepte aussi un ID brut collé seul */
const extractSheetId = (url) => {
  if (!url) return null;
  const m = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  const raw = String(url).trim();
  return /^[a-zA-Z0-9-_]{20,}$/.test(raw) ? raw : null;
};

/* Stockage du lien : persiste dans l'app déployée, ignoré sans planter en aperçu */
const safeStore = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { window.localStorage.removeItem(k); } catch { /* ignore */ } },
};

const SAMPLE = {"wealth": {"accounts": ["Compte bancaire 1", "Compte bancaire 2", "Compte Kasikorn", "Livret A+LDD", "P.E.A cash", "P.E.A investi", "Assurance vie  PEE", "Cash/bitrefill+ Cash IBKR", "Boursorama/LEP", "Transferwise/Fortuneo", "Crypto", "Or"], "months": [{"liq": 19541.16, "inv": 22669.34, "tot": 42210.5, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 1377.3, "Compte Kasikorn": 11253.0, "Livret A+LDD": 5878.86, "P.E.A cash": 14440.74, "P.E.A investi": 933.6, "Assurance vie  PEE": 7295.0, "Cash/bitrefill+ Cash IBKR": 400.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 632.0, "Crypto": 0.0, "Or": 0.0}}, {"liq": 18900.18, "inv": 22437.55, "tot": 41337.73, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 1931.09, "Compte Kasikorn": 2480.78, "Livret A+LDD": 13833.31, "P.E.A cash": 7936.17, "P.E.A investi": 7200.38, "Assurance vie  PEE": 7301.0, "Cash/bitrefill+ Cash IBKR": 220.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 435.0, "Crypto": 0.0, "Or": 0.0}}, {"liq": 15139.02, "inv": 22666.03, "tot": 37805.05, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 1295.02, "Compte Kasikorn": 62.23, "Livret A+LDD": 11320.3, "P.E.A cash": 3895.42, "P.E.A investi": 11465.61, "Assurance vie  PEE": 7305.0, "Cash/bitrefill+ Cash IBKR": 35.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 2426.47, "Crypto": 0.0, "Or": 0.0}}, {"liq": 10139.06, "inv": 22116.12, "tot": 32255.18, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 3246.2, "Compte Kasikorn": 62.23, "Livret A+LDD": 5320.3, "P.E.A cash": 3895.42, "P.E.A investi": 10907.7, "Assurance vie  PEE": 7313.0, "Cash/bitrefill+ Cash IBKR": 30.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 1480.33, "Crypto": 0.0, "Or": 0.0}}, {"liq": 15512.69, "inv": 20412.23, "tot": 35924.92, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 12865.5, "Compte Kasikorn": 62.23, "Livret A+LDD": 1320.3, "P.E.A cash": 7935.68, "P.E.A investi": 10158.55, "Assurance vie  PEE": 2318.0, "Cash/bitrefill+ Cash IBKR": 15.0, "Boursorama/LEP": 244.68, "Transferwise/Fortuneo": 1004.98, "Crypto": 0.0, "Or": 0.0}}, {"liq": 7070.09, "inv": 32007.96, "tot": 39078.05, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 3336.08, "Compte Kasikorn": 62.23, "Livret A+LDD": 3000.0, "P.E.A cash": 17725.86, "P.E.A investi": 11959.1, "Assurance vie  PEE": 2323.0, "Cash/bitrefill+ Cash IBKR": 5.0, "Boursorama/LEP": 586.41, "Transferwise/Fortuneo": 80.37, "Crypto": 0.0, "Or": 0.0}}, {"liq": 12801.75, "inv": 32064.43, "tot": 44866.18, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 8797.52, "Compte Kasikorn": 62.23, "Livret A+LDD": 3000.0, "P.E.A cash": 16355.26, "P.E.A investi": 13386.17, "Assurance vie  PEE": 2323.0, "Cash/bitrefill+ Cash IBKR": 36.0, "Boursorama/LEP": 849.74, "Transferwise/Fortuneo": 56.26, "Crypto": 0.0, "Or": 0.0}}, {"liq": 14731.3, "inv": 32706.43, "tot": 47437.73, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 5663.5, "Compte Kasikorn": 62.23, "Livret A+LDD": 8000.0, "P.E.A cash": 9407.37, "P.E.A investi": 20974.06, "Assurance vie  PEE": 2325.0, "Cash/bitrefill+ Cash IBKR": 30.0, "Boursorama/LEP": 919.31, "Transferwise/Fortuneo": 56.26, "Crypto": 0.0, "Or": 0.0}}, {"liq": 16145.7, "inv": 32948.93, "tot": 49094.63, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 1131.51, "Compte Kasikorn": 62.23, "Livret A+LDD": 14000.0, "P.E.A cash": 8950.48, "P.E.A investi": 21670.45, "Assurance vie  PEE": 2328.0, "Cash/bitrefill+ Cash IBKR": 215.0, "Boursorama/LEP": 680.7, "Transferwise/Fortuneo": 56.26, "Crypto": 0.0, "Or": 0.0}}, {"liq": 19106.75, "inv": 33003.26, "tot": 52110.01, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 1356.05, "Compte Kasikorn": 62.23, "Livret A+LDD": 17027.27, "P.E.A cash": 7311.92, "P.E.A investi": 24385.34, "Assurance vie  PEE": 306.0, "Cash/bitrefill+ Cash IBKR": 185.0, "Boursorama/LEP": 467.05, "Transferwise/Fortuneo": 9.15, "Crypto": 1000.0, "Or": 0.0}}, {"liq": 19705.9, "inv": 33991.56, "tot": 53697.46, "v": {"Compte bancaire 1": 985.0, "Compte bancaire 2": 1231.84, "Compte Kasikorn": 62.23, "Livret A+LDD": 15000.0, "P.E.A cash": 5476.62, "P.E.A investi": 26211.62, "Assurance vie  PEE": 306.0, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 2413.2, "Transferwise/Fortuneo": 3.63, "Crypto": 1997.32, "Or": 0.0}}, {"liq": 19154.91, "inv": 34861.9, "tot": 54016.81, "v": {"Compte bancaire 1": 17571.42, "Compte bancaire 2": 449.86, "Compte Kasikorn": 0.0, "Livret A+LDD": 100.0, "P.E.A cash": 5660.08, "P.E.A investi": 26460.4, "Assurance vie  PEE": 941.42, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 1010.0, "Transferwise/Fortuneo": 3.63, "Crypto": 1800.0, "Or": 0.0}}, {"liq": 6879.67, "inv": 50495.08, "tot": 57374.75, "v": {"Compte bancaire 1": 5069.1, "Compte bancaire 2": 778.04, "Compte Kasikorn": 0.0, "Livret A+LDD": 100.0, "P.E.A cash": 5700.34, "P.E.A investi": 27048.76, "Assurance vie  PEE": 941.42, "Cash/bitrefill+ Cash IBKR": 90.0, "Boursorama/LEP": 838.9, "Transferwise/Fortuneo": 3.63, "Crypto": 1897.87, "Or": 0.0}}, {"liq": 5417.08, "inv": 53114.61, "tot": 58531.69, "v": {"Compte bancaire 1": 3823.17, "Compte bancaire 2": 711.83, "Compte Kasikorn": 0.0, "Livret A+LDD": 100.0, "P.E.A cash": 5700.34, "P.E.A investi": 27224.25, "Assurance vie  PEE": 963.15, "Cash/bitrefill+ Cash IBKR": 65.0, "Boursorama/LEP": 713.45, "Transferwise/Fortuneo": 3.63, "Crypto": 2326.36, "Or": 0.0}}, {"liq": 6356.6, "inv": 57375.23, "tot": 63731.83, "v": {"Compte bancaire 1": 5072.08, "Compte bancaire 2": 427.44, "Compte Kasikorn": 0.0, "Livret A+LDD": 100.0, "P.E.A cash": 26823.77, "P.E.A investi": 6893.43, "Assurance vie  PEE": 981.01, "Cash/bitrefill+ Cash IBKR": 40.0, "Boursorama/LEP": 713.45, "Transferwise/Fortuneo": 3.63, "Crypto": 3945.31, "Or": 0.0}}, {"liq": 29922.48, "inv": 35358.68, "tot": 65281.16, "v": {"Compte bancaire 1": 2349.28, "Compte bancaire 2": 336.54, "Compte Kasikorn": 0.0, "Livret A+LDD": 100.0, "P.E.A cash": 26864.03, "P.E.A investi": 6959.09, "Assurance vie  PEE": 965.59, "Cash/bitrefill+ Cash IBKR": 5.0, "Boursorama/LEP": 264.0, "Transferwise/Fortuneo": 3.63, "Crypto": 4880.46, "Or": 0.0}}, {"liq": 30923.22, "inv": 37503.1, "tot": 68426.32, "v": {"Compte bancaire 1": 2859.35, "Compte bancaire 2": 970.01, "Compte Kasikorn": 0.0, "Livret A+LDD": 100.0, "P.E.A cash": 26864.03, "P.E.A investi": 7315.36, "Assurance vie  PEE": 1003.33, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 96.15, "Transferwise/Fortuneo": 33.68, "Crypto": 6023.12, "Or": 0.0}}, {"liq": 31528.38, "inv": 38199.97, "tot": 69728.35, "v": {"Compte bancaire 1": 2980.0, "Compte bancaire 2": 490.76, "Compte Kasikorn": 0.0, "Livret A+LDD": 100.0, "P.E.A cash": 27842.79, "P.E.A investi": 6206.65, "Assurance vie  PEE": 999.35, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 81.15, "Transferwise/Fortuneo": 33.68, "Crypto": 6092.0, "Or": 0.0}}, {"liq": 31000.32, "inv": 40487.1, "tot": 71487.42, "v": {"Compte bancaire 1": 1833.0, "Compte bancaire 2": 1190.85, "Compte Kasikorn": 0.0, "Livret A+LDD": 100.0, "P.E.A cash": 27842.79, "P.E.A investi": 6507.54, "Assurance vie  PEE": 996.36, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 33.68, "Crypto": 6405.0, "Or": 0.0}}, {"liq": 31076.41, "inv": 41701.49, "tot": 72777.9, "v": {"Compte bancaire 1": 2179.07, "Compte bancaire 2": 841.93, "Compte Kasikorn": 0.0, "Livret A+LDD": 118.68, "P.E.A cash": 27883.05, "P.E.A investi": 7057.31, "Assurance vie  PEE": 955.93, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 33.68, "Crypto": 5556.0, "Or": 0.0}}, {"liq": 22881.18, "inv": 51830.39, "tot": 74711.57, "v": {"Compte bancaire 1": 2980.85, "Compte bancaire 2": 887.63, "Compte Kasikorn": 0.0, "Livret A+LDD": 118.68, "P.E.A cash": 18840.34, "P.E.A investi": 15571.57, "Assurance vie  PEE": 932.96, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 33.68, "Crypto": 6040.74, "Or": 0.0}}, {"liq": 33604.42, "inv": 46505.5, "tot": 80109.92, "v": {"Compte bancaire 1": 2414.29, "Compte bancaire 2": 2752.96, "Compte Kasikorn": 0.0, "Livret A+LDD": 118.68, "P.E.A cash": 28264.81, "P.E.A investi": 6845.0, "Assurance vie  PEE": 900.0, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 33.68, "Crypto": 8028.53, "Or": 0.0}}, {"liq": 23320.67, "inv": 58895.66, "tot": 82216.33, "v": {"Compte bancaire 1": 2139.66, "Compte bancaire 2": 16743.84, "Compte Kasikorn": 0.0, "Livret A+LDD": 118.68, "P.E.A cash": 4264.81, "P.E.A investi": 6720.92, "Assurance vie  PEE": 309.0, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 33.68, "Crypto": 20082.37, "Or": 0.0}}, {"liq": 11685.06, "inv": 62187.7, "tot": 73872.76, "v": {"Compte bancaire 1": 1551.54, "Compte bancaire 2": 5563.91, "Compte Kasikorn": 0.0, "Livret A+LDD": 118.68, "P.E.A cash": 4397.25, "P.E.A investi": 6697.8, "Assurance vie  PEE": 3130.78, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 33.68, "Crypto": 19497.66, "Or": 0.0}}, {"liq": 12625.34, "inv": 59859.4, "tot": 72484.74, "v": {"Compte bancaire 1": 1672.52, "Compte bancaire 2": 5863.58, "Compte Kasikorn": 0.0, "Livret A+LDD": 418.68, "P.E.A cash": 4437.51, "P.E.A investi": 6428.51, "Assurance vie  PEE": 3130.78, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 213.05, "Crypto": 16790.39, "Or": 0.0}}, {"liq": 11731.64, "inv": 67578.07, "tot": 79309.71, "v": {"Compte bancaire 1": 2936.98, "Compte bancaire 2": 3017.0, "Compte Kasikorn": 0.0, "Livret A+LDD": 418.68, "P.E.A cash": 5269.98, "P.E.A investi": 7676.05, "Assurance vie  PEE": 3130.78, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 69.0, "Crypto": 22307.0, "Or": 0.0}}, {"liq": 16866.65, "inv": 67502.52, "tot": 84369.17, "v": {"Compte bancaire 1": 787.3, "Compte bancaire 2": 7374.1, "Compte Kasikorn": 0.0, "Livret A+LDD": 418.68, "P.E.A cash": 8244.57, "P.E.A investi": 5082.71, "Assurance vie  PEE": 3130.78, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 24070.54, "Or": 0.0}}, {"liq": 16490.29, "inv": 69485.55, "tot": 85975.84, "v": {"Compte bancaire 1": 3237.5, "Compte bancaire 2": 4547.54, "Compte Kasikorn": 0.0, "Livret A+LDD": 418.68, "P.E.A cash": 8244.57, "P.E.A investi": 4877.63, "Assurance vie  PEE": 3130.78, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 25316.0, "Or": 0.0}}, {"liq": 17627.33, "inv": 75520.47, "tot": 93147.8, "v": {"Compte bancaire 1": 3528.28, "Compte bancaire 2": 1770.39, "Compte Kasikorn": 0.0, "Livret A+LDD": 4000.0, "P.E.A cash": 8286.66, "P.E.A investi": 5547.26, "Assurance vie  PEE": 3130.78, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 29779.24, "Or": 0.0}}, {"liq": 18972.28, "inv": 72791.29, "tot": 91763.57, "v": {"Compte bancaire 1": 3492.15, "Compte bancaire 2": 4770.81, "Compte Kasikorn": 276.95, "Livret A+LDD": 200.0, "P.E.A cash": 9162.78, "P.E.A investi": 5241.15, "Assurance vie  PEE": 3130.78, "Cash/bitrefill+ Cash IBKR": 1037.59, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 26633.72, "Or": 0.0}}, {"liq": 23230.71, "inv": null, "tot": 56661.74, "v": {"Compte bancaire 1": 3091.14, "Compte bancaire 2": 6850.63, "Compte Kasikorn": 3835.16, "Livret A+LDD": 200.0, "P.E.A cash": 9211.78, "P.E.A investi": 5199.45, "Assurance vie  PEE": 3136.58, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 25095.0, "Or": 0.0}}, {"liq": 19351.66, "inv": null, "tot": 61011.15, "v": {"Compte bancaire 1": 1649.44, "Compte bancaire 2": 6292.63, "Compte Kasikorn": 1801.0, "Livret A+LDD": 200.0, "P.E.A cash": 9245.59, "P.E.A investi": 5244.91, "Assurance vie  PEE": 3136.58, "Cash/bitrefill+ Cash IBKR": 131.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 33278.0, "Or": 0.0}}, {"liq": 18046.11, "inv": null, "tot": 64404.03, "v": {"Compte bancaire 1": 1008.85, "Compte bancaire 2": 6540.88, "Compte Kasikorn": 1001.41, "Livret A+LDD": 207.38, "P.E.A cash": 9245.59, "P.E.A investi": 5435.54, "Assurance vie  PEE": 3146.64, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 37775.74, "Or": 0.0}}, {"liq": 21604.64, "inv": null, "tot": 68251.28, "v": {"Compte bancaire 1": 4957.15, "Compte bancaire 2": 798.8, "Compte Kasikorn": 1001.41, "Livret A+LDD": 211.17, "P.E.A cash": 14594.11, "P.E.A investi": 0.0, "Assurance vie  PEE": 3146.64, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 43500.0, "Or": 0.0}}, {"liq": 20827.1, "inv": null, "tot": 71711.14, "v": {"Compte bancaire 1": 1635.68, "Compte bancaire 2": 6367.67, "Compte Kasikorn": 1001.41, "Livret A+LDD": 211.17, "P.E.A cash": 11579.17, "P.E.A investi": 3046.4, "Assurance vie  PEE": 3146.64, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 44691.0, "Or": 0.0}}, {"liq": 26360.05, "inv": 90920.86, "tot": 117280.91, "v": {"Compte bancaire 1": 4759.7, "Compte bancaire 2": 6272.01, "Compte Kasikorn": 3466.0, "Livret A+LDD": 211.17, "P.E.A cash": 11579.17, "P.E.A investi": 2487.1, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 40.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 32.0, "Crypto": 44511.7, "Or": 0.0}}, {"liq": 29200.15, "inv": 91875.16, "tot": 121075.31, "v": {"Compte bancaire 1": 3800.19, "Compte bancaire 2": 7461.19, "Compte Kasikorn": 5914.55, "Livret A+LDD": 211.17, "P.E.A cash": 11579.17, "P.E.A investi": 2608.65, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 40.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 193.88, "Crypto": 44563.08, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 67784.03, "v": {"Compte bancaire 1": 2928.29, "Compte bancaire 2": 5375.01, "Compte Kasikorn": 0.0, "Livret A+LDD": 3207.38, "P.E.A cash": 11579.17, "P.E.A investi": 2181.95, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 130.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 70.05, "Crypto": 41999.18, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 59298.53, "v": {"Compte bancaire 1": 1655.22, "Compte bancaire 2": 0.0, "Compte Kasikorn": 0.0, "Livret A+LDD": 50.0, "P.E.A cash": 8742.0, "P.E.A investi": 4951.85, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 7700.0, "Transferwise/Fortuneo": 299.46, "Crypto": 35587.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 65093.45, "v": {"Compte bancaire 1": 1802.0, "Compte bancaire 2": 3367.95, "Compte Kasikorn": 0.0, "Livret A+LDD": 50.0, "P.E.A cash": 8742.0, "P.E.A investi": 5236.5, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 7700.0, "Transferwise/Fortuneo": 100.0, "Crypto": 37782.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 72193.05, "v": {"Compte bancaire 1": 1674.44, "Compte bancaire 2": 3849.14, "Compte Kasikorn": 0.0, "Livret A+LDD": 50.0, "P.E.A cash": 8742.0, "P.E.A investi": 5284.7, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 7710.0, "Transferwise/Fortuneo": 312.77, "Crypto": 44257.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 78839.27, "v": {"Compte bancaire 1": 2765.74, "Compte bancaire 2": 4490.1, "Compte Kasikorn": 0.0, "Livret A+LDD": 50.0, "P.E.A cash": 10753.32, "P.E.A investi": 3052.14, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 30.0, "Boursorama/LEP": 6958.55, "Transferwise/Fortuneo": 276.42, "Crypto": 50150.0, "Or": 0.0}}, {"liq": 35157.52, "inv": null, "tot": 102120.43, "v": {"Compte bancaire 1": 3452.69, "Compte bancaire 2": 719.02, "Compte Kasikorn": 20260.0, "Livret A+LDD": 50.0, "P.E.A cash": 10304.81, "P.E.A investi": 3591.36, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 30.0, "Boursorama/LEP": 8958.55, "Transferwise/Fortuneo": 341.0, "Crypto": 54100.0, "Or": 0.0}}, {"liq": 39577.36, "inv": null, "tot": 105967.05, "v": {"Compte bancaire 1": 9463.42, "Compte bancaire 2": 1626.6, "Compte Kasikorn": 18413.5, "Livret A+LDD": 57.95, "P.E.A cash": 9925.89, "P.E.A investi": 3999.53, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 30.0, "Boursorama/LEP": 6148.16, "Transferwise/Fortuneo": 60.0, "Crypto": 55929.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 129368.21, "v": {"Compte bancaire 1": 4834.84, "Compte bancaire 2": 4679.23, "Compte Kasikorn": 16632.0, "Livret A+LDD": 57.95, "P.E.A cash": 7694.78, "P.E.A investi": 6326.41, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 30.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 60.0, "Crypto": 78740.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 134101.01, "v": {"Compte bancaire 1": 4446.42, "Compte bancaire 2": 7402.1, "Compte Kasikorn": 13154.0, "Livret A+LDD": 57.95, "P.E.A cash": 6739.09, "P.E.A investi": 7497.45, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 60.0, "Crypto": 84431.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 123741.04, "v": {"Compte bancaire 1": 4559.0, "Compte bancaire 2": 9000.0, "Compte Kasikorn": 12409.0, "Livret A+LDD": 57.95, "P.E.A cash": 6739.09, "P.E.A investi": 7303.0, "Assurance vie  PEE": 313.0, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 60.0, "Crypto": 73300.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 139225.87, "v": {"Compte bancaire 1": 3955.56, "Compte bancaire 2": 9144.68, "Compte Kasikorn": 14532.13, "Livret A+LDD": 57.95, "P.E.A cash": 5767.89, "P.E.A investi": 8443.82, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 228.24, "Crypto": 86778.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 120391.61, "v": {"Compte bancaire 1": 644.77, "Compte bancaire 2": 665.24, "Compte Kasikorn": 17603.47, "Livret A+LDD": 0.0, "P.E.A cash": 4230.07, "P.E.A investi": 10241.46, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 129.0, "Crypto": 76560.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 122891.15, "v": {"Compte bancaire 1": 1332.59, "Compte bancaire 2": 2057.91, "Compte Kasikorn": 20969.05, "Livret A+LDD": 0.0, "P.E.A cash": 2660.51, "P.E.A investi": 11730.42, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 111.0, "Crypto": 73712.07, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 122375.31, "v": {"Compte bancaire 1": 2618.78, "Compte bancaire 2": 2802.46, "Compte Kasikorn": 24299.5, "Livret A+LDD": 2664.0, "P.E.A cash": 1651.19, "P.E.A investi": 12887.32, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 15.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 316.0, "Crypto": 64803.46, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 128667.37, "v": {"Compte bancaire 1": 1818.74, "Compte bancaire 2": 3426.6, "Compte Kasikorn": 26315.67, "Livret A+LDD": 0.0, "P.E.A cash": 2099.38, "P.E.A investi": 14284.38, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 50.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 230.0, "Crypto": 70125.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 129094.23, "v": {"Compte bancaire 1": 1472.82, "Compte bancaire 2": 1185.06, "Compte Kasikorn": 28721.92, "Livret A+LDD": 0.0, "P.E.A cash": 1033.5, "P.E.A investi": 15260.79, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 0.0, "Crypto": 71082.54, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 163754.46, "v": {"Compte bancaire 1": 1187.09, "Compte bancaire 2": 1256.99, "Compte Kasikorn": 31952.18, "Livret A+LDD": 0.0, "P.E.A cash": 1003.5, "P.E.A investi": 16044.1, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 20.0, "Boursorama/LEP": 10000.0, "Transferwise/Fortuneo": 75.0, "Crypto": 101898.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 166659.13, "v": {"Compte bancaire 1": 2917.08, "Compte bancaire 2": 3506.91, "Compte Kasikorn": 35525.11, "Livret A+LDD": 0.0, "P.E.A cash": 1513.95, "P.E.A investi": 17458.48, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 2010.0, "Transferwise/Fortuneo": 100.0, "Crypto": 103300.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 172042.59, "v": {"Compte bancaire 1": 1582.04, "Compte bancaire 2": 1718.41, "Compte Kasikorn": 36961.75, "Livret A+LDD": 0.0, "P.E.A cash": 2.17, "P.E.A investi": 21465.5, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 5717.18, "Transferwise/Fortuneo": 205.0, "Crypto": 104062.94, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 148336.24, "v": {"Compte bancaire 1": 969.91, "Compte bancaire 2": 849.25, "Compte Kasikorn": 39697.0, "Livret A+LDD": 0.0, "P.E.A cash": 2.17, "P.E.A investi": 21229.13, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 10.0, "Boursorama/LEP": 3727.18, "Transferwise/Fortuneo": 237.0, "Crypto": 81297.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 143183.19, "v": {"Compte bancaire 1": 1764.5, "Compte bancaire 2": 4086.31, "Compte Kasikorn": 37515.0, "Livret A+LDD": 10.0, "P.E.A cash": 58.26, "P.E.A investi": 23480.34, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 1737.18, "Transferwise/Fortuneo": 252.0, "Crypto": 73962.0, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 146161.22, "v": {"Compte bancaire 1": 2243.08, "Compte bancaire 2": 4712.99, "Compte Kasikorn": 37727.22, "Livret A+LDD": 10.0, "P.E.A cash": 12.61, "P.E.A investi": 24102.66, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 47.18, "Transferwise/Fortuneo": 0.0, "Crypto": 76987.88, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 160698.08, "v": {"Compte bancaire 1": 1306.24, "Compte bancaire 2": 3819.88, "Compte Kasikorn": 37654.65, "Livret A+LDD": 10.0, "P.E.A cash": 2016.21, "P.E.A investi": 27507.36, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 57.18, "Transferwise/Fortuneo": 0.0, "Crypto": 88008.96, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 160891.24, "v": {"Compte bancaire 1": 3014.0, "Compte bancaire 2": 3017.07, "Compte Kasikorn": 39392.86, "Livret A+LDD": 10.0, "P.E.A cash": 10.31, "P.E.A investi": 29779.62, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 45.0, "Boursorama/LEP": 67.18, "Transferwise/Fortuneo": 0.0, "Crypto": 85237.6, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 174628.98, "v": {"Compte bancaire 1": 2479.18, "Compte bancaire 2": 2911.5, "Compte Kasikorn": 33874.84, "Livret A+LDD": 10.0, "P.E.A cash": 6.12, "P.E.A investi": 32857.91, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 811.0, "Boursorama/LEP": 0.0, "Transferwise/Fortuneo": 0.0, "Crypto": 101360.83, "Or": 0.0}}, {"liq": null, "inv": null, "tot": 186720.08, "v": {"Compte bancaire 1": 1830.32, "Compte bancaire 2": 4518.72, "Compte Kasikorn": 33245.23, "Livret A+LDD": 10.0, "P.E.A cash": 506.12, "P.E.A investi": 33439.27, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 740.4, "Boursorama/LEP": 1643.62, "Transferwise/Fortuneo": 50.21, "Crypto": 105320.83, "Or": 5097.76}}, {"liq": null, "inv": null, "tot": 184992.98, "v": {"Compte bancaire 1": 2076.46, "Compte bancaire 2": 1505.56, "Compte Kasikorn": 32544.0, "Livret A+LDD": 10.0, "P.E.A cash": 14.52, "P.E.A investi": 35631.88, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 720.41, "Boursorama/LEP": 1653.62, "Transferwise/Fortuneo": 45.88, "Crypto": 103069.0, "Or": 7404.05}}, {"liq": null, "inv": null, "tot": 145289.66, "v": {"Compte bancaire 1": 0.0, "Compte bancaire 2": 0.0, "Compte Kasikorn": 0.0, "Livret A+LDD": 10.0, "P.E.A cash": 14.52, "P.E.A investi": 36739.63, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 720.41, "Boursorama/LEP": 63.62, "Transferwise/Fortuneo": 45.88, "Crypto": 97637.0, "Or": 9741.0}}, {"liq": null, "inv": null, "tot": 164466.34, "v": {"Compte bancaire 1": 3379.7, "Compte bancaire 2": 779.78, "Compte Kasikorn": 30242.0, "Livret A+LDD": 10.0, "P.E.A cash": 14.52, "P.E.A investi": 36631.42, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 720.41, "Boursorama/LEP": 73.62, "Transferwise/Fortuneo": 45.88, "Crypto": 80275.1, "Or": 11976.31}}, {"liq": null, "inv": null, "tot": 205113.03, "v": {"Compte bancaire 1": 46995.86, "Compte bancaire 2": 765.78, "Compte Kasikorn": 28646.74, "Livret A+LDD": 0.0, "P.E.A cash": 8.41, "P.E.A investi": 36886.41, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 720.41, "Boursorama/LEP": 83.62, "Transferwise/Fortuneo": 45.88, "Crypto": 76593.32, "Or": 14049.0}}, {"liq": null, "inv": null, "tot": 189419.16, "v": {"Compte bancaire 1": 28009.54, "Compte bancaire 2": 770.72, "Compte Kasikorn": 28351.0, "Livret A+LDD": 14.36, "P.E.A cash": 0.0, "P.E.A investi": 48459.0, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 7137.06, "Transferwise/Fortuneo": 45.88, "Crypto": 64916.0, "Or": 11398.0}}, {"liq": null, "inv": null, "tot": 140403.85, "v": {"Compte bancaire 1": 23372.83, "Compte bancaire 2": 656.3, "Compte Kasikorn": 28351.0, "Livret A+LDD": 9014.36, "P.E.A cash": 0.0, "P.E.A investi": 0.0, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 7147.06, "Transferwise/Fortuneo": 45.88, "Crypto": 58780.0, "Or": 12718.82}}, {"liq": null, "inv": null, "tot": 129477.21, "v": {"Compte bancaire 1": 19072.03, "Compte bancaire 2": 2144.65, "Compte Kasikorn": 26983.12, "Livret A+LDD": 0.0, "P.E.A cash": 0.0, "P.E.A investi": 0.0, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 7157.06, "Transferwise/Fortuneo": 1177.75, "Crypto": 59225.0, "Or": 13400.0}}, {"liq": null, "inv": null, "tot": 144283.27, "v": {"Compte bancaire 1": 27335.73, "Compte bancaire 2": 2132.66, "Compte Kasikorn": 25919.51, "Livret A+LDD": 0.0, "P.E.A cash": 0.0, "P.E.A investi": 0.0, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 7167.06, "Transferwise/Fortuneo": 1005.98, "Crypto": 65804.73, "Or": 14600.0}}, {"liq": null, "inv": null, "tot": 138872.29, "v": {"Compte bancaire 1": 16265.43, "Compte bancaire 2": 9818.67, "Compte Kasikorn": 27102.0, "Livret A+LDD": 14.12, "P.E.A cash": 8.41, "P.E.A investi": 0.0, "Assurance vie  PEE": 317.6, "Cash/bitrefill+ Cash IBKR": 0.0, "Boursorama/LEP": 7177.06, "Transferwise/Fortuneo": 213.0, "Crypto": 61856.0, "Or": 16100.0}}]}, "budget": {"years": ["A1", "A2", "A3", "A4", "A5"], "rows": [{"label": "Mes revenus", "group": true, "total": true, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Salaire", "group": false, "total": false, "years": [[2000.0, null, null, null, null, null, null, null, 2000.0, 2000.0, 2000.0, 2000.0], [2400.0, 2400.0, 2400.0, 2400.0, 2400.0, 2400.0, 2400.0, 2400.0, 2400.0, 2400.0, 2400.0, 2400.0], [2400.0, 2800.0, 2800.0, 2800.0, 2800.0, 2800.0, 2800.0, 2800.0, 2800.0, 2800.0, 2800.0, 2800.0], [3200.0, 3200.0, 3200.0, 3200.0, 3200.0, 3200.0, 3200.0, 3200.0, 3200.0, 3200.0, 3200.0, 3200.0], [3800.0, 3800.0, 3800.0, 3800.0, 3800.0, 1866.0, null, null, null, null, null, null]]}, {"label": "Part loyer partenaire", "group": false, "total": false, "years": [[325.0, null, null, null, null, null, null, null, 325.0, 325.0, 325.0, 325.0], [325.0, 325.0, 325.0, 325.0, 325.0, 325.0, 325.0, 325.0, 325.0, 325.0, 325.0, 325.0], [375.0, 375.0, 375.0, 375.0, 375.0, 375.0, 375.0, 375.0, 375.0, 375.0, 375.0, 375.0], [375.0, 375.0, 375.0, 450.0, 375.0, 375.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, null, null, null, null, null, null, null, null, null]]}, {"label": "Remboursement pro", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, 700.0, null, null], [0.0, 0.0, 0.0, 130.0, 75.0, 40.0, 40.0, 40.0, 75.0, 75.0, 401.0, 75.0], [75.0, 75.0, 75.0, 55.68, 65.01, 50.39, 50.39, 114.73, 87.66, 88.65, 77.91, 50.0], [57.0, 55.0, 61.0, 58.0, 59.9, 69.0, 31.09, 65.02, 57.55, 142.0, 202.0, 215.75], [130.0, 145.71, 82.72, 79.17, 80.0, 0.0, null, null, null, null, null, null]]}, {"label": "Aide de l'état", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [1855.0, 0.0, 0.0, 1917.66, 1890.0, 1953.93, 1855.0, 1990.82, 2029.57, 1964.1, 2029.57, 1964.1], [851.11, 0.0, 0.0, 0.0, 0.0, null, 224.0, null, null, null, null, null], [null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0, null, null, null, null, null, null, null, null]]}, {"label": "Autres revenus", "group": false, "total": false, "years": [[2041.0, null, null, null, null, null, null, null, 2041.04, 2461.7, 2002.29, 1937.7], [1000.0, 28.75, 36.9, null, 494.56, 20.0, 125.0, null, null, null, null, null], [null, 2200.0, 30.97, 150.0, null, null, null, null, null, 20.0, null, null], [null, null, 0.0, 0.0, null, null, null, 798.62, 0.0, 1000.0, 0.0, null], [640.0, 2484.0, null, null, 6590.0, 13100.0, null, null, null, null, null, null]]}, {"label": "Total revenus", "group": false, "total": true, "years": [[4366.0, null, null, null, null, null, null, null, 4366.04, 5486.7, 4327.29, 4262.7], [5580.0, 2753.75, 2761.9, 4772.66, 5184.56, 4738.93, 4745.0, 4755.82, 4829.57, 4764.1, 5155.57, 4764.1], [null, 5450.0, 3280.97, 3380.68, 3240.01, 3225.39, 3449.39, 3289.73, 3262.66, 3283.65, 3252.91, 3225.0], [null, null, 3636.0, 3708.0, null, null, null, 4063.64, 3257.55, 4342.0, 3402.0, null], [4570.0, 6429.71, null, null, 10470.0, 14966.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Mes dépenses", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [2615.0, 1051.09, 1563.91, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Mon logement", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Loyer", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [280.0, 140.0, null, null, null, null, null, null, null, null, null, null], [412.75, null, 412.75, 412.75, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, 575.0, 577.0, 565.0, 579.0, 582.85], [586.87, 578.17, 581.46, 570.91, 1254.06, 567.12, null, null, null, null, null, null]]}, {"label": "Emprunt*", "group": false, "total": false, "years": [[597.52, null, null, null, null, null, null, null, 597.52, 597.52, 597.52, 597.52], [597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52], [597.52, 597.52, 597.52, 597.52, 597.52, null, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52], [597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52, 597.52], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Assurance Emprunt", "group": false, "total": false, "years": [[20.16, null, null, null, null, null, null, null, 20.16, 20.16, 20.16, 20.16], [20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16], [20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16, 20.16], [20.43, 20.43, 20.43, 20.43, 20.43, 20.43, 20.43, 20.43, 20.43, 20.43, 20.43, 20.43], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Electricité/Gaz", "group": false, "total": false, "years": [[35.47, null, null, null, null, null, null, null, 35.47, 35.47, 35.47, 35.47], [50.94, 35.47, 35.47, -84.06, 35.47, 35.47, 35.47, 35.47, 35.47, 35.47, 35.47, 35.47], [35.47, null, null, null, null, 30.36, 46.5, 38.13, 38.13, 38.13, 38.13, 38.13], [129.0, 129.0, 129.0, 75.95, 129.5, 129.5, null, 34.4, 29.56, 31.24, 21.41, 16.99], [24.56, 18.85, 37.15, 50.7, 58.76, 34.56, null, null, null, null, null, null]]}, {"label": "Gaz", "group": false, "total": false, "years": [[84.53, null, null, null, null, null, null, null, 84.53, 84.53, 84.53, 84.53], [84.53, 84.53, 84.53, -200.32, 84.53, 84.53, 84.53, 84.53, 84.53, 84.53, 84.53, 84.53], [84.53, 84.53, 84.53, 84.53, 84.53, 72.36, 67.77, 90.87, null, 90.87, 90.87, 90.87], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Eau", "group": false, "total": false, "years": [[15.53, null, null, null, null, null, null, null, 15.53, 15.53, 15.53, 15.53], [15.53, 15.53, 15.53, 15.53, 15.53, 15.53, 15.53, 15.53, 15.53, 15.53, 15.53, 15.53], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, 5.6, null, 0.25, 2.16, 1.9], [2.18, 2.42, 2.7, null, 3.0, null, null, null, null, null, null, null]]}, {"label": "Charges locatives", "group": false, "total": false, "years": [[79.37, null, null, null, null, null, null, null, 79.37, 79.37, 79.37, 79.37], [149.37, 89.66, 89.66, 89.66, 89.66, 89.66, 89.66, 89.66, 89.66, 89.66, 89.66, 89.66], [158.61, 97.24, 97.24, 97.24, 97.24, 97.24, 97.24, null, 97.24, 97.24, 97.24, 97.24], [362.23, null, null, 300.04, null, null, 300.04, null, null, 204.18, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Taxe d'habitation", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Taxe foncière", "group": false, "total": false, "years": [[1.7, null, null, null, null, null, null, null, null, 792.0, null, null], [null, null, null, null, null, null, null, null, null, 856.0, null, null], [null, null, null, null, null, null, null, null, 889.0, null, null, null], [null, null, null, null, null, null, null, null, 906.0, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Assurance habitation", "group": false, "total": false, "years": [[22.49, null, null, null, null, null, null, null, 22.49, 22.49, 22.49, 22.49], [22.49, 29.58, 29.58, 29.58, 29.58, 29.58, 29.58, 29.58, 29.58, 29.58, 29.58, 29.58], [29.58, 29.58, 29.58, 29.58, 29.58, 23.68, 31.09, 25.18, 25.18, 25.18, 25.18, 25.18], [25.19, 25.19, 25.19, 25.19, 25.19, 25.19, null, 25.19, 25.19, 25.19, 25.19, 25.19], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Poubelles/maid", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, 6.82, 6.87, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, 20.91, null, 50.61, null], [31.1, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Internet/téléphone", "group": false, "total": false, "years": [[40.0, null, null, null, null, null, null, null, 50.0, 50.0, 50.0, 82.83], [82.83, 64.0, 70.41, 75.59, 52.0, 52.0, 52.0, 52.0, 52.0, 52.0, 52.0, 52.0], [52.0, null, 52.0, null, 96.0, 52.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0], [50.0, 50.0, 50.0, 50.0, 50.0, 50.0, null, null, null, null, null, null], [8.06, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Total logement", "group": false, "total": true, "years": [[856.77, null, null, null, null, null, null, null, 855.07, 1647.07, 855.07, 855.07], [1303.37, 1076.45, 942.86, 543.66, 924.45, 924.45, 924.45, 924.45, 924.45, 1780.45, 924.45, 924.45], [1390.62, null, null, null, null, null, 910.28, null, null, 919.1, 919.1, 919.1], [1184.37, 822.14, 822.14, 1069.13, 822.64, 822.64, null, null, null, null, null, null], [652.77, null, null, null, null, 601.68, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Mon transport", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Transports en commun", "group": false, "total": false, "years": [[0.0, null, null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0], [48.75, 60.2, 27.1, null, null, null, null, null, null, null, null, null], [null, null, 6.67, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Réparation", "group": false, "total": false, "years": [[0.0, null, null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0], [null, null, 48.0, null, null, null, null, null, null, null, 59.86, 35.5], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, 34.0, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Essence", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, 47.55, 140.79, null, null], [null, null, 162.37, null, null, 88.97, null, null, null, null, null, null], [null, null, null, null, 2.52, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Assurance voiture", "group": false, "total": false, "years": [[36.86, null, null, null, null, null, null, null, 36.86, 36.86, 36.86, 36.86], [343.67, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Autre (péage, amende, parking)", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, 167.33, 95.48, null, 228.2], [null, null, 105.16, null, 24.99, null, null, null, 68.0, null, 34.94, null], [null, 16.84, null, null, null, 0.8, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Total transport", "group": false, "total": true, "years": [[36.86, null, null, null, null, null, null, null, 251.74, 273.13, 36.86, 265.06], [392.42, 60.2, 342.63, null, 24.99, null, 0.0, null, null, null, 94.8, 35.5], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Mon alimentation", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Alimention course", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, 242.12, 232.93, 209.16, 232.12], [178.78, 100.89, 322.23, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, 34.27, null, null, null, null, null, null]]}, {"label": "Restos & commandes", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, 24.45, 99.5, 32.5, 259.43], [197.65, 392.1, 36.0, null, 6.0, null, null, null, 54.0, null, null, null], [null, null, null, null, null, null, null, null, 34.0, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Total alimentation", "group": false, "total": true, "years": [[0.0, null, null, null, null, null, null, null, 266.57, 332.43, 241.66, 491.55], [376.43, 492.99, 358.23, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Mes loisirs", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, 2.39, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Café / Verre/Dessert", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, 16.4, null, 51.0], [21.55, 39.0, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, 1.63], [null, null, null, null, 3.79, null, null, null, null, null, null, null]]}, {"label": "Soins (coiffeur...)", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, 1.0, null, null, null, null, null, null], [7.41, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, 18.41, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Shopping", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, 153.63, null, 595.86], [44.78, 10.5, 274.65, null, null, null, null, null, null, null, null, null], [null, null, 146.98, null, null, null, null, null, null, 120.0, 3.0, null], [null, null, null, null, null, null, null, 49.19, null, null, 320.22, null], [7.77, 9.37, null, 252.32, null, null, null, null, null, null, null, null]]}, {"label": "Loisirs / Sorties", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, 397.39, 5.0, 15.0, 12.25], [null, 20.13, 16.99, 109.0, null, null, null, null, null, 4.43, null, null], [null, 172.0, null, null, null, 15.6, null, null, 15.6, null, null, null], [null, null, null, null, null, null, null, null, 1.58, 2.14, 4.04, 3.8], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Cadeaux", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, 102.24, null, 324.0], [1197.04, null, null, 67.8, null, 180.0, null, 290.0, null, null, null, 0.0], [null, 20.51, null, null, 63.0, 389.0, null, 150.0, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, 26.97, null], [null, 34.48, null, 81.6, 129.89, 125.0, null, null, null, null, null, null]]}, {"label": "Sport", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, 143.61], [3.22, null, null, null, 22.5, null, null, null, null, null, null, null], [null, null, 34.95, 62.92, null, null, null, null, null, 197.0, null, null], [null, null, null, null, null, null, 92.24, 14.55, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Abonnement (Netflix...)", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, 69.99, null, null, null, 70.0, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, 5.21, 1.35, 1.35], [null, null, null, 1.31, 1.3, 1.3, null, null, null, null, null, null]]}, {"label": "Vacances", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [548.56, 116.93, 458.86, 820.0, 734.0, null, null, null, 0.0, 0.0, 668.99, 0.0], [0.0, 350.0, null, 174.58, 0.0, 37.71, 150.83, 0.0, 0.0, 0.0, 0.0, null], [null, null, null, null, null, null, 84.94, null, 397.83, null, null, null], [40.94, 65.04, null, 81.65, null, null, null, null, null, null, null, null]]}, {"label": "Total loisirs", "group": false, "total": true, "years": [[0.0, null, null, null, null, null, null, null, 397.39, 277.27, 15.0, 1126.72], [1815.15, 186.56, 820.49, null, null, null, null, null, null, null, null, 0.0], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Mes enfants", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Argent de poche", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Santé", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, 27.7, 109.72, 12.9, null, null, 33.45], [null, null, 13.79, null, null, 18.99, null, null, null, null, null, null]]}, {"label": "Loisirs/sorties", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, 7.97, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Shopping", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [9.0, null, 58.0, null, null, null, null, null, null, 110.08, null, null], [1.4, null, null, null, null, 4.27, null, null, null, null, null, null]]}, {"label": "Education/scolaire/nounou", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, 40.4, 27.11], [null, 26.89, 40.57, 66.17, 79.2, 153.83, null, null, null, null, null, null]]}, {"label": "Autre", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, 14.5, 6.0, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Total enfants", "group": false, "total": true, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [9.0, null, 58.0, null, 6.0, null, null, null, null, null, null, null], [null, null, null, null, null, 177.09, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Autre", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, 47.7, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Santé", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, 64.25], [34.71, null, null, 7.5, 6.95, null, null, null, null, 5.0, null, null], [null, 12.17, null, null, null, null, null, null, 23.95, null, null, null], [null, 13.47, null, null, null, null, null, null, null, null, null, null], [20.06, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Mutuelle", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, 20.74, null, null, null], [null, null, null, null, 75.0, 75.0, 75.0, 75.0, 75.0, 75.0, 75.0, 75.0], [76.1, 76.1, 76.1, 76.1, 76.1, 76.1, 76.1, 76.1, 76.1, 76.1, 86.94, 86.94], [86.94, 86.94, 86.94, 86.94, 86.94, 86.94, 86.94, null, null, null, 154.7, 156.76], [156.6, 156.6, 155.15, 155.15, 153.45, 151.34, null, null, null, null, null, null]]}, {"label": "Banque", "group": false, "total": false, "years": [[2.5, null, null, null, null, null, null, null, 2.5, 2.5, 2.5, 2.5], [null, null, 9.76, null, 45.0, 2.0, null, 2.0, null, null, null, null], [null, null, null, null, 46.0, 1.0, 15.0, null, null, null, null, null], [2.5, null, 2.5, 2.5, 47.0, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, null], [2.5, 13.0, null, 26.0, null, null, null, null, null, null, null, null]]}, {"label": "Autre", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, 1253.0, null, 117.43], [60.28, 8.0, 22.58, null, null, null, null, null, 1.16, 2.82, null, null], [null, null, null, null, null, 400.0, null, null, null, null, null, null], [null, null, null, null, null, null, 13.28, null, null, null, null, null], [28.02, 28.02, null, null, 9.0, 25.37, null, null, null, null, null, null]]}, {"label": "Total autre", "group": false, "total": true, "years": [[2.5, null, null, null, null, null, null, null, 23.24, 1255.5, 2.5, 184.18], [94.99, 8.0, 32.34, 7.5, 126.95, null, 75.0, 77.0, null, 82.82, null, null], [76.1, null, null, 76.1, null, null, 91.1, 76.1, 100.05, null, 86.94, 86.94], [89.44, null, null, null, null, 89.44, null, null, null, null, 157.2, null], [207.18, 197.62, null, 181.15, null, 176.71, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Mes investissements", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Epargne d'urgence", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [1198.52, null, null, null, null, null, null, null, null, null, null, null], [null, null, 556.91, 496.21, 0.0, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Investissement bourse", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, 2223.86, 955.69, null, 971.2, 965.97, 1569.56, 1009.32, 1051.81, 1095.88, 1489.55, 1502.84], [1708.94, 1787.11, 1656.8, 1545.65, 1996.4, null, 2004.19, null, null, 1550.21, null, null], [null, null, null, null, 9205.13, 5910.43, null, null, null, null, null, null]]}, {"label": "Investissement crypto", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, 2000.0, 2000.0, 2000.0, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Investissement immo", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Investissement de Charlie", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Travaux", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, 296.55, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, 290.0, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Autre", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Total investissement", "group": false, "total": true, "years": [[0.0, null, null, null, null, null, null, null, 2296.55, 2000.0, 2000.0, 0.0], [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [1198.52, 2223.86, 955.69, null, null, 965.97, 1569.56, 1009.32, 1051.81, 1095.88, 1489.55, 1502.84], [null, null, 2213.71, 2041.86, 1996.4, null, 2004.19, null, null, 1550.21, null, null], [null, null, null, null, 9205.13, 5910.43, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Récap'", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Mes revenus", "group": true, "total": true, "years": [[4366.0, null, null, null, null, null, null, null, 4366.04, 5486.7, 4327.29, 4262.7], [5580.0, 2753.75, 2761.9, 4772.66, 5184.56, 4738.93, 4745.0, 4755.82, 4829.57, 4764.1, 5155.57, 4764.1], [null, 5450.0, 3280.97, 3380.68, 3240.01, 3225.39, 3449.39, 3289.73, 3262.66, 3283.65, 3252.91, 3225.0], [null, null, 3636.0, 3708.0, null, null, null, 4063.64, 3257.55, 4342.0, 3402.0, null], [4570.0, 6429.71, null, null, 10470.0, 14966.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "- Charges", "group": false, "total": true, "years": [[896.13, null, null, null, null, null, null, null, 1794.01, 3785.4, 1151.09, 2922.58], [3982.36, 1824.2, 2496.55, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "- Investissements", "group": false, "total": true, "years": [[0.0, null, null, null, null, null, null, null, 2296.55, 2000.0, 2000.0, 0.0], [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [1198.52, 2223.86, 955.69, null, null, 965.97, 1569.56, 1009.32, 1051.81, 1095.88, 1489.55, 1502.84], [null, null, 2213.71, 2041.86, 1996.4, null, 2004.19, null, null, 1550.21, null, null], [null, null, null, null, 9205.13, 5910.43, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "Balance", "group": false, "total": true, "years": [[3469.87, null, null, null, null, null, null, null, 275.48, -298.7, 1176.2, 1340.12], [1597.64, 929.55, 265.35, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}, {"label": "% revenu économisé", "group": false, "total": true, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [0.29, 0.34, 0.1, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Mes impôts", "group": true, "total": false, "years": [[null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]]}, {"label": "Impôts", "group": false, "total": false, "years": [[null, null, null, null, null, null, null, null, null, -2017.0, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, 552.88, 552.88, 552.88, 552.88], [null, null, null, null, 5.06, null, null, null, null, null, null, null]]}, {"label": "Total impôts", "group": false, "total": true, "years": [[null, null, null, null, null, null, null, null, 0.0, -2017.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 552.88, 552.88, 552.88, 552.88], [0.0, 0.0, 0.0, 0.0, 5.06, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]]}]}, "bourse": {"holdings": [{"name": "BNP PAR.EASY STOX.EU.600 U.ETF", "qty": null, "isin": null, "value": 7077.5, "perf": 0.0075, "pl": null, "weight": 0.3793}, {"name": "AM.PEA MSCI EM ESG LEAD.UC.ETF", "qty": null, "isin": null, "value": 4302.5, "perf": 0.198, "pl": null, "weight": 0.2306}, {"name": "STREAMWIDE", "qty": null, "isin": null, "value": 7280.0, "perf": 0.5855, "pl": null, "weight": 0.3901}]}, "crypto": {"current": [{"name": "Bitcoin", "ticker": "BTC", "cap": "Mega cap", "narrative": "Layer 1", "price": 63935.67, "value": 874.55, "pl": null, "perf": 2.6436, "wallet": "Ledger", "weight": 0.0087}, {"name": "ethereum", "ticker": "ETH", "cap": "Mega cap", "narrative": "Layer 1", "price": 1717.5846, "value": 731.15, "pl": null, "perf": 2.0784000000000002, "wallet": "Ledger", "weight": 0.0073}, {"name": "Tether", "ticker": "USDT", "cap": "Mega cap", "narrative": "Stablecoin", "price": null, "value": 5941.35, "pl": null, "perf": 0.7068000000000001, "wallet": "Ledger", "weight": 0.0594}, {"name": "Avalanche", "ticker": "AVAX", "cap": "Large cap", "narrative": "Layer 1", "price": null, "value": 886.5, "pl": null, "perf": 0.41159999999999997, "wallet": "Avax inscription", "weight": 0.0089}, {"name": "Cosmos", "ticker": "ATOM", "cap": "Mid cap", "narrative": "Layer 1", "price": null, "value": 5511.15, "pl": null, "perf": 0.2568, "wallet": "Ledger", "weight": 0.0551}, {"name": "Celestia", "ticker": "TIA", "cap": "Mid cap", "narrative": "Layer 1", "price": null, "value": 11665.4, "pl": null, "perf": 2.6472, "wallet": "Keplr", "weight": 0.1167}, {"name": "polygon-ecosystem-token", "ticker": "MATIC", "cap": "Mid cap", "narrative": "Layer 2", "price": 0.07, "value": 826.75, "pl": null, "perf": 2.0244, "wallet": "Ledger", "weight": 0.0083}, {"name": "Aave", "ticker": "AAVE", "cap": "Mid cap", "narrative": "DeFi", "price": null, "value": 8737.65, "pl": null, "perf": -0.4704, "wallet": "Ledger", "weight": 0.0874}, {"name": "Zigcoin", "ticker": "ZIG", "cap": "Micro cap", "narrative": "IA", "price": null, "value": 1997.85, "pl": null, "perf": 0.1272, "wallet": "Airdrop", "weight": 0.02}, {"name": "Render", "ticker": "REND", "cap": "Mid cap", "narrative": "IA", "price": 1.46, "value": 8450.85, "pl": null, "perf": 0.6816, "wallet": "Binance", "weight": 0.0845}, {"name": "Centrifuge", "ticker": "CFG", "cap": "Small cap", "narrative": "RWA", "price": null, "value": 5714.3, "pl": null, "perf": 2.8416, "wallet": "Kucoin", "weight": 0.0571}, {"name": "Osmosis", "ticker": "OSMO", "cap": "Small cap", "narrative": "DeFi", "price": 0.02, "value": 922.35, "pl": null, "perf": 1.1856, "wallet": "Keplr", "weight": 0.0092}, {"name": "Multiversx-egld", "ticker": "EGLD", "cap": "Mid cap", "narrative": "Layer 1", "price": null, "value": 8295.5, "pl": null, "perf": 2.6327999999999996, "wallet": "Xportal", "weight": 0.083}, {"name": "Lukso-network", "ticker": "LYX", "cap": "Small cap", "narrative": "SocialFi", "price": null, "value": 2081.5, "pl": null, "perf": 2.208, "wallet": "Binance", "weight": 0.0208}, {"name": "Onbeam", "ticker": "BEAM", "cap": "Mid cap", "narrative": "Gaming", "price": 0.00155, "value": 1017.95, "pl": null, "perf": 2.5824000000000003, "wallet": "Binance", "weight": 0.0102}, {"name": "Zel", "ticker": "FLUX", "cap": "Small cap", "narrative": "Depin", "price": null, "value": 2643.15, "pl": null, "perf": 0.21, "wallet": "Kucoin", "weight": 0.0264}, {"name": "Eigencloud", "ticker": "EIGEN", "cap": "Micro cap", "narrative": "Layer 1", "price": 0.15, "value": 9753.4, "pl": null, "perf": 2.2332, "wallet": "Airdrop", "weight": 0.0975}, {"name": "Fetch", "ticker": "FET", "cap": "Small cap", "narrative": "IA", "price": null, "value": 9908.75, "pl": null, "perf": 0.2208, "wallet": "Ledger", "weight": 0.0991}, {"name": "Meter", "ticker": "MTRG", "cap": "Micro cap", "narrative": "Layer 1", "price": null, "value": 10697.45, "pl": null, "perf": 1.5275999999999998, "wallet": "Kucoin", "weight": 0.107}, {"name": "partisia-blockchain", "ticker": "MPC", "cap": "Singerie", "narrative": "Layer 1", "price": null, "value": 3336.25, "pl": null, "perf": 1.5816, "wallet": "Partisia", "weight": 0.0334}], "past": [{"name": "Bnb", "ticker": "BNB", "cap": "Mega cap", "narrative": "Layer 1"}, {"name": "Vechain", "ticker": "VET", "cap": "Large cap", "narrative": "Layer 1"}, {"name": "Polkadot", "ticker": "DOT", "cap": "Large cap", "narrative": "Layer 1"}, {"name": "Terra", "ticker": "LUNA", "cap": "Large cap", "narrative": "Layer 1"}, {"name": "Near-protocol", "ticker": "NEAR", "cap": "Mid cap", "narrative": "Layer 1"}, {"name": "1inch", "ticker": "1INCH", "cap": "Small cap", "narrative": "DeFi"}, {"name": "Radiant-capital", "ticker": "RDNT", "cap": "Small cap", "narrative": "DeFi"}, {"name": "Ocean-protocol", "ticker": "OCEAN", "cap": "Small cap", "narrative": "IA"}, {"name": "Harmony", "ticker": "ONE", "cap": "Small cap", "narrative": "Layer 1"}, {"name": "Dao-maker", "ticker": "DAO", "cap": "Small cap", "narrative": "DeFi"}, {"name": "Polkastarter", "ticker": "POLS", "cap": "Small cap", "narrative": "DeFi"}, {"name": "Band-protocol", "ticker": "BAND", "cap": "Small cap", "narrative": "Layer 1"}, {"name": "ecomi-new", "ticker": "OMI", "cap": "Small cap", "narrative": "Gaming"}, {"name": "Marlin", "ticker": "POND", "cap": "Small cap", "narrative": "Layer 1"}, {"name": "Wootrade", "ticker": "WOO", "cap": "Small cap", "narrative": "DeFi"}, {"name": "Sxp", "ticker": "SXP", "cap": "Small cap", "narrative": "Layer 1"}, {"name": "Chiliz", "ticker": "CHZ", "cap": "Small cap", "narrative": "Gaming"}, {"name": "Itheum", "ticker": "ITHEUM", "cap": "Micro cap", "narrative": "DeFi"}, {"name": "Airswap", "ticker": "AST", "cap": "Micro cap", "narrative": "DeFi"}, {"name": "Ashswap", "ticker": "ASH", "cap": "Micro cap", "narrative": "DeFi"}, {"name": "Milc-platform", "ticker": "MLT", "cap": "Micro cap", "narrative": "Gaming"}, {"name": "Qredo", "ticker": "QRDO", "cap": "Micro cap", "narrative": "Layer 1"}, {"name": "Spartan-protocol", "ticker": "SPARTA", "cap": "Singerie/ICO", "narrative": "DeFi"}, {"name": "Cantina-royale", "ticker": "CRT", "cap": "Singerie/ICO", "narrative": "Gaming"}, {"name": "Burency", "ticker": "BUY", "cap": "Singerie/ICO", "narrative": "Layer 1"}, {"name": "Multiverse", "ticker": "AI", "cap": "Singerie/ICO", "narrative": "Gaming"}, {"name": "Seedify-fund", "ticker": "SFUND", "cap": "Small cap", "narrative": "Gaming"}, {"name": "Altlayer", "ticker": "ALT", "cap": "Small cap", "narrative": "Layer 1"}, {"name": "Dymension", "ticker": "DYM", "cap": "Small cap", "narrative": "Layer 2"}, {"name": "Libra", "ticker": "DIEM", "cap": "Micro cap", "narrative": "Layer 1"}, {"name": "Saga", "ticker": "SAGA", "cap": "Small cap", "narrative": "Gaming"}, {"name": "Smardex", "ticker": "SDEX", "cap": "Small cap", "narrative": "DeFi"}]}, "matieres": {"holdings": []}, "data": {"crypto_tx": [{"type": "Sell", "date": "2023-08-13", "price": 29422.26, "value": -3273.51, "token": "-0.1113 BTC"}, {"type": "Buy", "date": "2023-05-22", "price": 26850.99, "value": 809.56, "token": "0.03015 BTC"}, {"type": "Buy", "date": "2023-03-10", "price": 20176.29, "value": 758.63, "token": "0.0376 BTC"}, {"type": "Buy", "date": "2023-02-02", "price": 23855.38, "value": 43.13, "token": "0.001808 BTC"}, {"type": "Buy", "date": "2023-01-03", "price": 16651.0, "value": 1000.23, "token": "0.06007 BTC"}, {"type": "Buy", "date": "2022-11-22", "price": 16100.0, "value": 308.8, "token": "0.01918 BTC"}, {"type": "Buy", "date": "2022-11-10", "price": 16125.68, "value": 418.14, "token": "0.02593 BTC"}, {"type": "Buy", "date": "2022-11-10", "price": 16813.09, "value": 397.97, "token": "0.02367 BTC"}, {"type": "Buy", "date": "2022-11-09", "price": 17234.54, "value": 402.94, "token": "0.02338 BTC"}, {"type": "Buy", "date": "2022-11-09", "price": 17246.51, "value": 372.66, "token": "0.02161 BTC"}, {"type": "Buy", "date": "2022-10-13", "price": 18376.37, "value": 498.73, "token": "0.02714 BTC"}, {"type": "Buy", "date": "2022-10-08", "price": 19427.61, "value": 303.46, "token": "0.01562 BTC"}, {"type": "Buy", "date": "2022-09-19", "price": 18300.0, "value": 344.04, "token": "0.0188 BTC"}, {"type": "Buy", "date": "2022-09-06", "price": 19046.44, "value": 305.89, "token": "0.01606 BTC"}, {"type": "Buy", "date": "2022-09-02", "price": 19817.42, "value": 504.95, "token": "0.02548 BTC"}, {"type": "Buy", "date": "2022-08-29", "price": 20227.47, "value": 138.56, "token": "0.00685 BTC"}, {"type": "Buy", "date": "2022-08-29", "price": 20294.77, "value": 126.64, "token": "0.00624 BTC"}, {"type": "Buy", "date": "2022-08-21", "price": 21414.45, "value": 514.16, "token": "0.02401 BTC"}, {"type": "Buy", "date": "2022-08-18", "price": 23282.0, "value": 412.09, "token": "0.0177 BTC"}, {"type": "Buy", "date": "2022-08-18", "price": 23284.0, "value": 161.36, "token": "0.00693 BTC"}, {"type": "Buy", "date": "2022-07-27", "price": 21876.92, "value": 526.36, "token": "0.02406 BTC"}, {"type": "Buy", "date": "2022-07-12", "price": 19857.82, "value": 252.0, "token": "0.01269 BTC"}, {"type": "Buy", "date": "2022-07-03", "price": 19100.0, "value": 405.3, "token": "0.02122 BTC"}, {"type": "Buy", "date": "2022-06-30", "price": 18880.86, "value": 214.86, "token": "0.01138 BTC"}, {"type": "Sell", "date": "2022-06-30", "price": 19109.92, "value": -124.21, "token": "-0.0065 BTC"}, {"type": "Buy", "date": "2022-06-30", "price": 19151.09, "value": 524.36, "token": "0.02738 BTC"}, {"type": "Buy", "date": "2022-06-23", "price": 20341.73, "value": 503.81, "token": "0.02477 BTC"}, {"type": "Buy", "date": "2022-06-13", "price": 23458.6, "value": 525.47, "token": "0.0224 BTC"}, {"type": "Buy", "date": "2022-06-09", "price": 30204.32, "value": 532.8, "token": "0.01764 BTC"}, {"type": "Buy", "date": "2022-05-09", "price": 31181.44, "value": 1569.05, "token": "0.05032 BTC"}, {"type": "Buy", "date": "2022-04-27", "price": 39076.63, "value": 1582.99, "token": "0.04051 BTC"}, {"type": "Buy", "date": "2021-11-21", "price": 61800.54, "value": 207.96, "token": "0.003365 BTC"}, {"type": "Buy", "date": "Dec 5, 202", "price": 1.0, "value": 679.12, "token": "679 USDT"}, {"type": "Buy", "date": "Dec 3, 202", "price": 1.0, "value": 531.27, "token": "531 USDT"}, {"type": "Buy", "date": "Dec 3, 202", "price": 1.0, "value": 194.06, "token": "194 USDT"}, {"type": "Buy", "date": "Dec 19, 20", "price": 1.0, "value": 247.08, "token": "247.08 USDT"}, {"type": "Buy", "date": "Dec 3, 202", "price": 1.0, "value": 230.02, "token": "230 USDT"}, {"type": "Buy", "date": "Dec 3, 202", "price": 1.0, "value": 437.17, "token": "437 USDT"}, {"type": "Buy", "date": "Dec 3, 202", "price": 1.0, "value": 379.11, "token": "379 USDT"}, {"type": "Buy", "date": "Nov 14, 20", "price": 1.0, "value": 402.96, "token": "403 USDT"}, {"type": "Buy", "date": "Nov 9, 202", "price": 1.0, "value": 507.25, "token": "507 USDT"}, {"type": "Buy", "date": "Nov 9, 202", "price": 1.0, "value": 156.06, "token": "156 USDT"}, {"type": "Buy", "date": "Oct 31, 20", "price": 1.0, "value": 211.6, "token": "211.5 USDT"}, {"type": "Sell", "date": "May 22, 20", "price": 1.0, "value": -924.0, "token": "-931.29 USDT"}, {"type": "Sell", "date": "May 22, 20", "price": 1.0, "value": -463.02, "token": "-463 USDT"}, {"type": "Sell", "date": "May 22, 20", "price": 1.0, "value": -1921.02, "token": "-1,920.6 USDT"}, {"type": "Sell", "date": "Apr 14, 20", "price": 1.0, "value": -296.0, "token": "-296 USDT"}, {"type": "Buy", "date": "Mar 29, 20", "price": 1.0, "value": 2389.0, "token": "2,389 USDT"}, {"type": "Buy", "date": "Mar 23, 20", "price": 1.0, "value": 2339.0, "token": "2,339 USDT"}, {"type": "Sell", "date": "Mar 15, 20", "price": 1.0, "value": -453.06, "token": "-451 USDT"}, {"type": "Buy", "date": "Mar 14, 20", "price": 1.0, "value": 1081.0, "token": "1,081 USDT"}, {"type": "Sell", "date": "Mar 14, 20", "price": 1.0, "value": -21.0, "token": "-21 USDT"}, {"type": "Buy", "date": "Feb 16, 20", "price": 1.0, "value": 2590.6, "token": "2,590 USDT"}, {"type": "Sell", "date": "Jan 3, 202", "price": 1.0, "value": -743.02, "token": "-743.17 USDT"}, {"type": "Buy", "date": "Dec 13, 20", "price": 1.0, "value": 1063.8, "token": "1,063.8 USDT"}, {"type": "Buy", "date": "Dec 3, 202", "price": 1.0, "value": 400.05, "token": "400 USDT"}, {"type": "Sell", "date": "Nov 10, 20", "price": 1.0, "value": -1728.49, "token": "-1,728.49 USDT"}, {"type": "Sell", "date": "Nov 10, 20", "price": 1.0, "value": -301.38, "token": "-301.38 USDT"}, {"type": "Buy", "date": "Nov 10, 20", "price": 1.0, "value": 1294.8, "token": "1,294.8 USDT"}, {"type": "Buy", "date": "Nov 9, 202", "price": 1.0, "value": 735.1, "token": "735.1 USDT"}, {"type": "Sell", "date": "Sep 13, 20", "price": 1.0, "value": -2000.0, "token": "-2,000 USDT"}, {"type": "Buy", "date": "Aug 26, 20", "price": 1.0, "value": 1993.52, "token": "2,000 USDT"}, {"type": "Sell", "date": "Aug 19, 20", "price": 1.0, "value": -426.12, "token": "-426.12 USDT"}, {"type": "Buy", "date": "Jul 18, 20", "price": 1.0, "value": 425.96, "token": "426 USDT"}, {"type": "Sell", "date": "Jul 14, 20", "price": 1.0, "value": -153.91, "token": "-153.91 USDT"}, {"type": "Sell", "date": "Jul 13, 20", "price": 1.0, "value": -251.82, "token": "-252 USDT"}, {"type": "Sell", "date": "Jul 7, 202", "price": 1.0, "value": -403.64, "token": "-404 USDT"}, {"type": "Buy", "date": "Jul 3, 202", "price": 1.0, "value": 809.27, "token": "810 USDT"}, {"type": "Sell", "date": "Jan 1, 202", "price": 2333.94, "value": -200.72, "token": "-0.086 ETH"}, {"type": "Buy", "date": "Jan 1, 202", "price": 2352.0, "value": 1020.3, "token": "0.4338 ETH"}]}};

/* ─── Thème (identique au prototype) ───────────────────────────────── */
const C = {
  bg: "#0a0e17", card: "#111827", border: "#1e293b",
  accent: "#22d3ee", green: "#10b981", red: "#ef4444",
  orange: "#f59e0b", purple: "#a78bfa", pink: "#ec4899",
  text: "#e2e8f0", dim: "#64748b", muted: "#475569",
};
const PIE = ["#22d3ee", "#10b981", "#f59e0b", "#a78bfa", "#ec4899", "#6366f1",
  "#14b8a6", "#f43f5e", "#eab308", "#8b5cf6", "#06b6d4", "#84cc16",
  "#fb923c", "#e879f9", "#38bdf8", "#4ade80"];
const MONO = "'JetBrains Mono', monospace";
const DISP = "'Space Grotesk', sans-serif";

/* ─── Formatters ───────────────────────────────────────────────────── */
const eur = (v) => (typeof v === "number" && isFinite(v))
  ? Math.round(v).toLocaleString("fr-FR") + " €" : "—";
const eurK = (v) => `${(v / 1000).toFixed(0)}k`;
const pct = (v) => (typeof v === "number" && isFinite(v))
  ? (v * 100).toFixed(1).replace(".", ",") + " %" : "—";
const FR_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.",
  "août", "sept.", "oct.", "nov.", "déc."];
const monthLabel = (i) => {
  const m0 = CONFIG.WEALTH_START.month - 1 + i;
  const y = CONFIG.WEALTH_START.year + Math.floor(m0 / 12);
  return `${FR_MONTHS[((m0 % 12) + 12) % 12]} ${y}`;
};
const quarterTick = (label) => {
  const m = String(label).match(/([a-zà-ÿ]+)\.?\s+(\d{4})/i);
  if (!m) return "";
  const idx = FR_MONTHS.findIndex((x) => x.startsWith(m[1].slice(0, 3)));
  if (idx < 0 || idx % 3 !== 0) return "";
  return `T${idx / 3 + 1} ${m[2].slice(2)}`;
};

/* ════════════════════════════════════════════════════════════════════
   LIVE LOADER — lit chaque onglet via gviz CSV (par nom d'onglet)
   et renvoie une grille [ligne][colonne], puis parse vers le même
   modèle que SAMPLE. À ajuster si tu déplaces des tableaux.
   ════════════════════════════════════════════════════════════════════ */
const gvizURL = (sheetId, tab) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

async function fetchGrid(sheetId, tab) {
  const res = await fetch(gvizURL(sheetId, tab));
  if (!res.ok) throw new Error(`Onglet "${tab}" inaccessible (HTTP ${res.status})`);
  const csv = await res.text();
  const { data } = Papa.parse(csv, { header: false, skipEmptyLines: false });
  return data; // grille brute
}
const numAt = (g, r, c) => {
  const v = g?.[r]?.[c];
  if (v == null || v === "") return null;
  const s = String(v).replace(/\s|€|%|\u202f/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
const txtAt = (g, r, c) => {
  const v = g?.[r]?.[c];
  return v == null ? "" : String(v).trim();
};

async function loadLive(sheetId) {
  const [w, b, bo, cr, ma, da] = await Promise.all(
    Object.values(CONFIG.TABS).map((t) => fetchGrid(sheetId, t))
  );
  // WEALTH : row0 = en-têtes (12 comptes + Flat/Liq/Investi/Total), puis 72 mois
  const accounts = [];
  for (let c = 0; c < 12; c++) accounts.push(txtAt(w, 0, c));
  const months = [];
  for (let r = 1; r < w.length; r++) {
    if (w[r].every((x) => x === "" || x == null)) continue;
    const v = {};
    for (let c = 0; c < 12; c++) v[accounts[c]] = numAt(w, r, c) || 0;
    const tot = numAt(w, r, 15);
    if (tot == null) continue;
    months.push({ liq: numAt(w, r, 13), inv: numAt(w, r, 14), tot, v });
  }
  // BUDGET : row1 = mois (5 ans), lignes 2..85 = catégories, col B = label
  const blocks = [2, 14, 26, 38, 50];
  const rows = [];
  for (let r = 2; r < 86; r++) {
    const label = txtAt(b, r, 1);
    if (!label) continue;
    const years = blocks.map((b0) =>
      Array.from({ length: 12 }, (_, m) => numAt(b, r, b0 + m)));
    rows.push({
      label,
      group: /^Mes |^Mon |Récap/.test(label),
      total: /^Total|Balance|^- |économis/.test(label),
      years,
    });
  }
  // Portefeuilles génériques
  const portfolio = (g, hdr, map) => {
    const out = [];
    for (let r = hdr; r < g.length; r++) {
      const nm = txtAt(g, r, 1);
      if (!nm) { if (out.length) break; else continue; }
      if (/^Total|^Répartition|^Investissement|^Nom |^Moyenne|^Portefeuille/.test(nm)) {
        if (/^Total/.test(nm) && out.length) break; else continue;
      }
      const row = { name: nm };
      for (const k in map) row[k] = numAt(g, r, map[k]);
      out.push(row);
    }
    const tot = out.reduce((s, h) => s + (h.value || 0), 0) || 1;
    out.forEach((h) => (h.weight = (h.value || 0) / tot));
    return out;
  };
  const bourse = portfolio(bo, 5, { value: 8, perf: 9, pl: 10 });
  const matieres = portfolio(ma, 3, { value: 8, perf: 9, pl: 10 });
  // CRYPTO
  const cryptoTbl = (g, start, stop) => {
    const out = [];
    for (let r = start; r < stop; r++) {
      const nm = txtAt(g, r, 1);
      if (!nm || /^Total|^Moyenne|^Nom |^Portefeuille/.test(nm)) continue;
      out.push({
        name: nm, ticker: txtAt(g, r, 2), cap: txtAt(g, r, 3),
        narrative: txtAt(g, r, 4), price: numAt(g, r, 6),
        value: numAt(g, r, 8), pl: numAt(g, r, 9), perf: numAt(g, r, 10),
        wallet: txtAt(g, r, 11),
      });
    }
    return out;
  };
  const cur = cryptoTbl(cr, 4, 24);
  const tot = cur.reduce((s, h) => s + (h.value || 0), 0) || 1;
  cur.forEach((h) => (h.weight = (h.value || 0) / tot));
  const past = cryptoTbl(cr, 31, 63).map((h) =>
    ({ name: h.name, ticker: h.ticker, cap: h.cap, narrative: h.narrative }));
  // DATA
  const tx = [];
  for (let r = 2; r < da.length && tx.length < 200; r++) {
    const t = txtAt(da, r, 0);
    if (!t) continue;
    tx.push({ type: t, date: txtAt(da, r, 1).slice(0, 10), price: numAt(da, r, 2),
      value: numAt(da, r, 3), token: txtAt(da, r, 6) });
  }
  return {
    wealth: { accounts, months },
    budget: { years: ["A1", "A2", "A3", "A4", "A5"], rows },
    bourse: { holdings: bourse },
    crypto: { current: cur, past },
    matieres: { holdings: matieres },
    data: { crypto_tx: tx },
  };
}

/* ════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ════════════════════════════════════════════════════════════════════ */
const Card = ({ children, span, style }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: 22, gridColumn: span ? `span ${span}` : undefined, ...style,
  }}>{children}</div>
);

const Title = ({ icon, children, right }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
    paddingBottom: 12, borderBottom: `1px solid ${C.border}`,
  }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: 0.5,
      textTransform: "uppercase", fontFamily: MONO, flex: 1 }}>{children}</span>
    {right}
  </div>
);

const KPI = ({ label, value, sub, trend, color }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: "20px 22px", flex: 1, minWidth: 170, position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3,
      background: color || C.accent }} />
    <div style={{ fontSize: 11, color: C.dim, letterSpacing: 1, textTransform: "uppercase",
      marginBottom: 8, fontFamily: MONO }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontFamily: DISP, lineHeight: 1.1 }}>
      {value}</div>
    {sub != null && (
      <div style={{ marginTop: 8, fontSize: 12.5, fontFamily: MONO, display: "flex", gap: 4,
        color: trend === "up" ? C.green : trend === "down" ? C.red : C.dim }}>
        {trend === "up" && "▲"}{trend === "down" && "▼"} {sub}</div>
    )}
  </div>
);

const Tip = ({ active, payload, label, unit = "€" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a2332", border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "10px 14px", fontSize: 12, fontFamily: MONO }}>
      <div style={{ color: C.dim, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number"
            ? p.value.toLocaleString("fr-FR") + " " + unit : p.value}</div>
      ))}
    </div>
  );
};

/* Donut + légende */
function Donut({ data, height = 230, unit = "€" }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ width: 200, height, position: "relative" }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={58} outerRadius={88}
              paddingAngle={2} dataKey="value" stroke="none"
              onMouseEnter={(_, i) => setHover(i)} onMouseLeave={() => setHover(null)}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color || PIE[i % PIE.length]}
                  opacity={hover == null || hover === i ? 1 : 0.3}
                  style={{ transition: "opacity .2s" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: MONO }}>TOTAL</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: DISP, color: C.text }}>
            {unit === "€" ? eur(total) : total.toFixed(0)}</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        {data.map((d, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 10px", borderRadius: 8, marginBottom: 2,
              background: hover === i ? `${d.color || PIE[i % PIE.length]}22` : "transparent",
              transition: "background .2s", cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                background: d.color || PIE[i % PIE.length] }} />
              <span style={{ fontSize: 12.5, color: C.text, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
            </div>
            <div style={{ textAlign: "right", fontFamily: MONO, flexShrink: 0, marginLeft: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                {unit === "€" ? eur(d.value) : d.value.toFixed(0)}</span>
              <span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>
                {((d.value / total) * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Barres horizontales de performance / poids */
function HBars({ rows, fmt = pct, signed = true }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 0.0001);
  return (
    <div>
      {rows.map((r, i) => {
        const col = r.v >= 0 ? (r.v > 0.2 ? C.green : C.accent) : C.red;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
            borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ flex: 1, fontSize: 13, color: C.text, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
            <div style={{ flex: 1.6, height: 22, background: C.bg, borderRadius: 6,
              position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0,
                width: `${(Math.abs(r.v) / max) * 100}%`,
                background: `linear-gradient(90deg, ${col}44, ${col})`, borderRadius: 6,
                transition: "width .8s ease" }} />
            </div>
            <div style={{ width: 78, textAlign: "right", fontSize: 13, fontWeight: 600,
              fontFamily: MONO, color: col }}>
              {signed && r.v >= 0 ? "+" : ""}{fmt(r.v)}</div>
          </div>
        );
      })}
    </div>
  );
}

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 };

/* ════════════════════════════════════════════════════════════════════
   SECTION : WEALTH
   ════════════════════════════════════════════════════════════════════ */
function WealthView({ d }) {
  const { accounts, months } = d;
  const last = months[months.length - 1];
  const first = months[0];
  const series = months.map((m, i) => ({ month: monthLabel(i), Total: m.tot,
    Liquidités: m.liq ?? 0, Investi: m.inv ?? 0 }));
  const variation = first.tot ? (last.tot - first.tot) / first.tot : 0;

  // Regroupement par classe d'actif (heuristique sur le nom du compte)
  const classOf = (name) => {
    const n = name.toLowerCase();
    if (n.includes("crypto")) return "Crypto";
    if (n.includes("or")) return "Or";
    if (n.includes("investi") || n.includes("assurance vie")) return "Investi (actions)";
    return "Liquidités";
  };
  const byClass = {};
  accounts.forEach((a) => {
    const k = classOf(a); byClass[k] = (byClass[k] || 0) + (last.v[a] || 0);
  });
  const classData = Object.entries(byClass).filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  const acctData = accounts.map((a) => ({ name: a, value: last.v[a] || 0 }))
    .filter((x) => x.value > 0).sort((a, b) => b.value - a.value);

  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <KPI label="Patrimoine net" value={eur(last.tot)} color={C.accent}
          trend={variation >= 0 ? "up" : "down"}
          sub={`${variation >= 0 ? "+" : ""}${pct(variation)} depuis le départ`} />
        <KPI label="Liquidités" value={eur(last.liq)} color={C.green} />
        <KPI label="Investi" value={eur(last.inv)} color={C.purple} />
        <KPI label="Suivi" value={`${months.length} mois`} color={C.orange}
          sub={`depuis ${monthLabel(0)}`} />
      </div>

      <Card style={{ marginBottom: 18 }}>
        <Title icon="📈">Évolution du patrimoine</Title>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series} margin={{ top: 8, right: 10, left: 6, bottom: 0 }}>
            <defs>
              <linearGradient id="gTot" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" interval={0} tickFormatter={quarterTick} tickLine={false}
              tick={{ fill: "#cbd5e1", fontSize: 11, fontFamily: MONO }} axisLine={{ stroke: C.border }} />
            <YAxis tickFormatter={eurK} tick={{ fill: C.dim, fontSize: 11, fontFamily: MONO }}
              axisLine={{ stroke: C.border }} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="Total" stroke={C.accent} strokeWidth={2.5}
              fill="url(#gTot)" />
            <Area type="monotone" dataKey="Investi" stroke={C.purple} strokeWidth={1.5} fill="none" />
            <Area type="monotone" dataKey="Liquidités" stroke={C.green} strokeWidth={1.5} fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div style={grid2}>
        <Card>
          <Title icon="🎯">Répartition par classe</Title>
          <Donut data={classData.map((d, i) => ({ ...d, color: PIE[i] }))} />
        </Card>
        <Card>
          <Title icon="🏦">Par compte (dernier mois)</Title>
          <Donut data={acctData.map((d, i) => ({ ...d, color: PIE[i % PIE.length] }))} />
        </Card>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SECTION : BUDGET
   ════════════════════════════════════════════════════════════════════ */
function BudgetView({ d }) {
  const [yi, setYi] = useState(d.budget.years.length - 1);
  const rows = d.budget.rows;
  const find = (label) => rows.find((r) => r.label.toLowerCase().startsWith(label.toLowerCase()));
  const yearSum = (row) => row ? row.years[yi].reduce((s, v) => s + (v || 0), 0) : 0;

  const revenus = yearSum(find("Total revenus"));
  const groups = [
    ["Logement", "Total logement", C.accent],
    ["Transport", "Total transport", C.purple],
    ["Alimentation", "Total alimentation", C.green],
    ["Loisirs", "Total loisirs", C.orange],
    ["Enfants", "Total enfants", C.pink],
    ["Santé / Autre", "Total autre", "#6366f1"],
    ["Investissements", "Total investissement", "#14b8a6"],
    ["Impôts", "Total impôts", C.red],
  ];
  const groupData = groups.map(([name, key, color]) => ({ name, value: yearSum(find(key)), color }))
    .filter((g) => g.value > 0);
  const depenses = groupData.filter((g) => g.name !== "Investissements")
    .reduce((s, g) => s + g.value, 0);
  const invest = (groupData.find((g) => g.name === "Investissements") || {}).value || 0;
  const balance = revenus - depenses - invest;
  const tauxEpargne = revenus ? (balance + invest) / revenus : 0;

  // série mensuelle revenus vs dépenses
  const totRev = find("Total revenus");
  const totDepRows = groups.filter(([n]) => n !== "Investissements").map(([, k]) => find(k));
  const monthly = FR_MONTHS.map((mlabel, m) => {
    const rev = totRev ? (totRev.years[yi][m] || 0) : 0;
    const dep = totDepRows.reduce((s, r) => s + (r ? (r.years[yi][m] || 0) : 0), 0);
    return { mois: mlabel.replace(".", ""), Revenus: Math.round(rev), Dépenses: Math.round(dep) };
  });
  const yearName = (i) => `${CONFIG.BUDGET_BASE_YEAR + i}`;

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {d.budget.years.map((_, i) => (
          <button key={i} onClick={() => setYi(i)} style={{
            padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: MONO, fontSize: 13,
            border: `1px solid ${yi === i ? C.accent : C.border}`,
            background: yi === i ? `${C.accent}22` : C.card,
            color: yi === i ? C.accent : C.dim, fontWeight: yi === i ? 600 : 400,
          }}>{yearName(i)}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <KPI label="Revenus (année)" value={eur(revenus)} color={C.green} />
        <KPI label="Dépenses" value={eur(depenses)} color={C.red} />
        <KPI label="Investissements" value={eur(invest)} color={C.purple} />
        <KPI label="Taux d'épargne" value={pct(tauxEpargne)} color={C.orange}
          trend={tauxEpargne >= 0.2 ? "up" : undefined}
          sub={`Balance ${eur(balance)}`} />
      </div>

      <Card style={{ marginBottom: 18 }}>
        <Title icon="💰">Revenus vs dépenses — {yearName(yi)}</Title>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="mois" tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }}
              axisLine={{ stroke: C.border }} />
            <YAxis tickFormatter={eurK} tick={{ fill: C.dim, fontSize: 10, fontFamily: MONO }}
              axisLine={{ stroke: C.border }} />
            <Tooltip content={<Tip />} cursor={{ fill: "#ffffff08" }} />
            <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 12 }} />
            <Bar dataKey="Revenus" fill={C.green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Dépenses" fill={C.red} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div style={grid2}>
        <Card>
          <Title icon="📊">Répartition des dépenses</Title>
          <Donut data={groupData} />
        </Card>
        <Card>
          <Title icon="🧾">Postes principaux</Title>
          <HBars signed={false} fmt={eur}
            rows={[...groupData].sort((a, b) => b.value - a.value)
              .map((g) => ({ name: g.name, v: g.value }))} />
        </Card>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SECTION : PORTEFEUILLE (Bourse / Matières) — générique
   ════════════════════════════════════════════════════════════════════ */
function PortfolioView({ holdings, icon, label }) {
  if (!holdings || holdings.length === 0) {
    return (
      <Card><Title icon={icon}>{label}</Title>
        <div style={{ color: C.dim, fontFamily: MONO, fontSize: 13, padding: "30px 0",
          textAlign: "center" }}>
          Aucune ligne détectée dans cet onglet pour l'instant.<br />
          Les valeurs apparaîtront dès que le Sheet live sera connecté.
        </div></Card>
    );
  }
  const total = holdings.reduce((s, h) => s + (h.value || 0), 0);
  const best = [...holdings].sort((a, b) => (b.perf || 0) - (a.perf || 0))[0];
  const avgPerf = holdings.reduce((s, h) => s + (h.perf || 0) * (h.value || 0), 0) / (total || 1);
  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <KPI label="Valeur portefeuille" value={eur(total)} color={C.accent} />
        <KPI label="Lignes" value={holdings.length} color={C.purple} />
        <KPI label="Perf. pondérée" value={pct(avgPerf)} color={avgPerf >= 0 ? C.green : C.red}
          trend={avgPerf >= 0 ? "up" : "down"} />
        <KPI label="Meilleure ligne" value={best?.name?.slice(0, 16) || "—"} color={C.orange}
          sub={pct(best?.perf || 0)} trend="up" />
      </div>
      <div style={grid2}>
        <Card>
          <Title icon="🎯">Allocation</Title>
          <Donut data={[...holdings].sort((a, b) => b.value - a.value)
            .map((h, i) => ({ name: h.name, value: h.value || 0, color: PIE[i % PIE.length] }))} />
        </Card>
        <Card>
          <Title icon="⚡">Performance par ligne</Title>
          <HBars rows={[...holdings].sort((a, b) => (b.perf || 0) - (a.perf || 0))
            .map((h) => ({ name: h.name, v: h.perf || 0 }))} />
        </Card>
      </div>
      <Card style={{ marginTop: 18 }}>
        <Title icon={icon}>{label}</Title>
        <Table cols={["Ligne", "Valeur", "Perf.", "Poids"]}
          rows={[...holdings].sort((a, b) => b.value - a.value).map((h) => [
            h.name, eur(h.value),
            { v: pct(h.perf || 0), color: (h.perf || 0) >= 0 ? C.green : C.red },
            pct(h.weight || 0)])} />
      </Card>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SECTION : CRYPTO
   ════════════════════════════════════════════════════════════════════ */
function CryptoView({ d }) {
  const cur = d.crypto.current;
  const total = cur.reduce((s, h) => s + (h.value || 0), 0);
  const agg = (key) => {
    const m = {};
    cur.forEach((h) => { const k = h[key] || "—"; m[k] = (m[k] || 0) + (h.value || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: PIE[i % PIE.length] }));
  };
  const best = [...cur].sort((a, b) => (b.perf || 0) - (a.perf || 0))[0];
  const worst = [...cur].sort((a, b) => (a.perf || 0) - (b.perf || 0))[0];
  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <KPI label="Valeur crypto" value={eur(total)} color={C.accent} />
        <KPI label="Tokens détenus" value={cur.length} color={C.purple}
          sub={`${d.crypto.past.length} sortis`} />
        <KPI label="Top perf" value={best?.name || "—"} color={C.green} trend="up"
          sub={pct(best?.perf || 0)} />
        <KPI label="Pire perf" value={worst?.name || "—"} color={C.red} trend="down"
          sub={pct(worst?.perf || 0)} />
      </div>
      <div style={grid2}>
        <Card><Title icon="🧩">Par narrative</Title><Donut data={agg("narrative")} /></Card>
        <Card><Title icon="📐">Par capitalisation</Title><Donut data={agg("cap")} /></Card>
      </div>
      <div style={{ ...grid2, marginTop: 18 }}>
        <Card><Title icon="🔐">Par wallet</Title>
          <HBars signed={false} fmt={eur} rows={agg("wallet").map((g) => ({ name: g.name, v: g.value }))} />
        </Card>
        <Card><Title icon="⚡">Performance</Title>
          <HBars rows={[...cur].sort((a, b) => (b.perf || 0) - (a.perf || 0)).slice(0, 8)
            .map((h) => ({ name: h.name, v: h.perf || 0 }))} />
        </Card>
      </div>
      <Card style={{ marginTop: 18 }}>
        <Title icon="🪙">Portefeuille actuel</Title>
        <Table cols={["Crypto", "Ticker", "Narrative", "Valeur", "Perf.", "Wallet"]}
          rows={[...cur].sort((a, b) => b.value - a.value).map((h) => [
            h.name, h.ticker, h.narrative, eur(h.value),
            { v: pct(h.perf || 0), color: (h.perf || 0) >= 0 ? C.green : C.red }, h.wallet])} />
      </Card>
      <Card style={{ marginTop: 18 }}>
        <Title icon="🗄️">Portefeuille passé ({d.crypto.past.length})</Title>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {d.crypto.past.map((p, i) => (
            <span key={i} style={{ fontFamily: MONO, fontSize: 12, color: C.dim,
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "4px 10px" }}>{p.name}</span>
          ))}
        </div>
      </Card>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SECTION : DATA (transactions)
   ════════════════════════════════════════════════════════════════════ */
function DataView({ d }) {
  const tx = d.data.crypto_tx;
  const buys = tx.filter((t) => /buy|achat/i.test(t.type));
  const sells = tx.filter((t) => /sell|vente/i.test(t.type));
  const invested = buys.reduce((s, t) => s + Math.abs(t.value || 0), 0);
  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <KPI label="Transactions" value={tx.length} color={C.accent} />
        <KPI label="Achats" value={buys.length} color={C.green} />
        <KPI label="Ventes" value={sells.length} color={C.red} />
        <KPI label="Volume acheté" value={eur(invested)} color={C.purple} />
      </div>
      <Card>
        <Title icon="🧾">Historique des transactions</Title>
        <Table cols={["Type", "Date", "Actif", "Prix", "Montant"]}
          rows={tx.map((t) => [
            { v: t.type, color: /buy|achat/i.test(t.type) ? C.green : C.red },
            t.date, t.token, eur(t.price), eur(t.value)])} maxH={520} />
      </Card>
    </>
  );
}

/* Tableau générique */
function Table({ cols, rows, maxH = 460 }) {
  return (
    <div style={{ overflow: "auto", maxHeight: maxH }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 12.5 }}>
        <thead>
          <tr>{cols.map((c, i) => (
            <th key={i} style={{ textAlign: i === 0 ? "left" : "right", color: C.dim,
              fontWeight: 500, padding: "8px 10px", borderBottom: `1px solid ${C.border}`,
              position: "sticky", top: 0, background: C.card, textTransform: "uppercase",
              fontSize: 11, letterSpacing: 0.5 }}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((cell, ci) => {
              const obj = cell && typeof cell === "object";
              return (
                <td key={ci} style={{ textAlign: ci === 0 ? "left" : "right",
                  padding: "8px 10px", borderBottom: `1px solid ${C.border}55`,
                  color: obj ? cell.color : C.text,
                  fontWeight: ci === 0 ? 600 : 400, whiteSpace: "nowrap" }}>
                  {obj ? cell.v : cell}</td>
              );
            })}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   APP
   ════════════════════════════════════════════════════════════════════ */
const NAV = [
  { id: "wealth", label: "Wealth", icon: "💎" },
  { id: "budget", label: "Mon budget", icon: "💰" },
  { id: "bourse", label: "Bourse", icon: "📈" },
  { id: "crypto", label: "Cryptomonnaies", icon: "🪙" },
  { id: "matieres", label: "Matières premières", icon: "🛢️" },
  { id: "data", label: "Data", icon: "🗄️" },
];

export default function Dashboard() {
  const [tab, setTab] = useState("wealth");
  const savedUrl = safeStore.get(CONFIG.STORAGE_KEY) || CONFIG.DEFAULT_SHEET_URL || "";
  const [sheetUrl, setSheetUrl] = useState(savedUrl);
  const [activeId, setActiveId] = useState(() => extractSheetId(savedUrl));
  const [data, setData] = useState(SAMPLE);
  const [source, setSource] = useState(() => (extractSheetId(savedUrl) ? "live" : "sample"));
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(() => !extractSheetId(savedUrl));

  const loadFromId = async (id) => {
    if (!id) { setData(SAMPLE); setSource("sample"); return; }
    setLoading(true); setErr(null);
    try { setData(await loadLive(id)); setSource("live"); }
    catch (e) { setErr(e.message); setData(SAMPLE); setSource("sample"); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadFromId(activeId); }, []); // chargement initial

  // Applique le lien collé → recharge le dashboard depuis ce Sheet
  const applyUrl = () => {
    const id = extractSheetId(sheetUrl);
    if (!id) { setErr("Lien Google Sheets invalide — colle l'URL complète du fichier."); return; }
    setErr(null);
    safeStore.set(CONFIG.STORAGE_KEY, sheetUrl.trim());
    setActiveId(id); setShowSettings(false);
    loadFromId(id);
  };
  const reset = () => {
    safeStore.del(CONFIG.STORAGE_KEY);
    setSheetUrl(""); setActiveId(null); setErr(null);
    setData(SAMPLE); setSource("sample"); setShowSettings(true);
  };
  const refresh = () => loadFromId(activeId);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text,
      fontFamily: "'Outfit', sans-serif", padding: "22px 26px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.accent, letterSpacing: 3, textTransform: "uppercase",
            fontFamily: MONO, marginBottom: 4 }}>Finances personnelles</div>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, fontFamily: DISP,
            background: "linear-gradient(135deg,#e2e8f0,#22d3ee)", WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent" }}>Tableau de bord</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: MONO, fontSize: 12 }}>
          <button onClick={() => setShowSettings((s) => !s)} style={{ background: C.card,
            border: `1px solid ${showSettings ? C.accent : C.border}`, borderRadius: 8,
            padding: "8px 14px", cursor: "pointer", color: showSettings ? C.accent : C.dim }}>
            ⚙ Lien Sheet</button>
          <button onClick={refresh} disabled={!activeId} style={{ background: C.card,
            border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px",
            cursor: activeId ? "pointer" : "not-allowed", color: activeId ? C.accent : C.muted }}>
            ↻ Rafraîchir</button>
          <span style={{ color: source === "live" ? C.green : C.orange, background: C.card,
            padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}` }}>
            {loading ? "● Chargement…" : source === "live" ? "● Live Google Sheets" : "● Données d'exemple"}</span>
        </div>
      </div>

      {/* Panneau lien Google Sheet */}
      {showSettings && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.dim, fontFamily: MONO, marginBottom: 8,
            textTransform: "uppercase", letterSpacing: 0.5 }}>
            Lien de ton Google Sheet</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyUrl()}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              style={{ flex: 1, minWidth: 260, background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "10px 14px", color: C.text, fontFamily: MONO,
                fontSize: 13, outline: "none" }} />
            <button onClick={applyUrl} style={{ background: C.accent, color: C.bg, border: "none",
              borderRadius: 8, padding: "10px 22px", cursor: "pointer", fontFamily: MONO,
              fontWeight: 600, fontSize: 13 }}>Charger</button>
            {activeId && (
              <button onClick={reset} style={{ background: "transparent",
                border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px",
                cursor: "pointer", color: C.dim, fontFamily: MONO, fontSize: 13 }}>Effacer</button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, fontFamily: MONO, marginTop: 10,
            lineHeight: 1.6 }}>
            Le Sheet doit être partagé en « Tous les utilisateurs avec le lien · Lecteur ».
            Le lien est mémorisé et rechargé automatiquement à chaque ouverture.
            {activeId && <span style={{ color: C.green }}> · Connecté ({activeId.slice(0, 10)}…)</span>}
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap",
        borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 16px",
            background: "transparent", border: "none", cursor: "pointer", fontFamily: MONO,
            fontSize: 13, color: tab === n.id ? C.accent : C.dim,
            borderBottom: `2px solid ${tab === n.id ? C.accent : "transparent"}`,
            fontWeight: tab === n.id ? 600 : 400, marginBottom: -1 }}>
            <span style={{ fontSize: 15 }}>{n.icon}</span>{n.label}</button>
        ))}
      </div>

      {err && (
        <div style={{ background: `${C.orange}1a`, border: `1px solid ${C.orange}`, borderRadius: 10,
          padding: "10px 16px", marginBottom: 18, fontFamily: MONO, fontSize: 12.5, color: C.orange }}>
          Chargement live impossible ({err}). Affichage des données d'exemple. Vérifie le partage du Sheet.
        </div>
      )}

      {loading && !data ? (
        <div style={{ color: C.dim, fontFamily: MONO, padding: 40, textAlign: "center" }}>
          Chargement…</div>
      ) : (
        <div>
          {tab === "wealth" && <WealthView d={data.wealth} />}
          {tab === "budget" && <BudgetView d={data} />}
          {tab === "bourse" && <PortfolioView holdings={data.bourse.holdings} icon="📈" label="Portefeuille bourse" />}
          {tab === "crypto" && <CryptoView d={data} />}
          {tab === "matieres" && <PortfolioView holdings={data.matieres.holdings} icon="🛢️" label="Portefeuille matières premières" />}
          {tab === "data" && <DataView d={data} />}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 24, paddingTop: 16,
        borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, fontFamily: MONO }}>
        6 sections · Wealth · Budget · Bourse · Crypto · Matières · Data — alimenté par ton Google Sheet
      </div>
    </div>
  );
}
