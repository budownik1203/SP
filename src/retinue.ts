// Kompani (Build 0.27): czterech nowych (razem 18, także specjaliści: kwatermistrzyni, runokuj, szaman),
// osobiste zadania każdego kompana, oddanie (premie), samodzielne dozbrajanie i nobilitacja kompana na lorda twojej korony.

COMPANIONS.push(
  { id: "lucjan", name: "Lucjan Mallius", race: "human", role: "kusznik", weapon: "armsword", shield: false, armor: 0.3, bow: 52, horse: false, hp: 115, cost: 380, wage: 9, bio: "Dezerter Legionu. Ma w plecaku pięć bełtów z imionami dawnych dowódców.", helm: "kettle", body: "mail" } as any,
  { id: "thrain", name: "Thrain Runokuj", race: "dwarf", role: "runokuj", weapon: "hammer", shield: true, armor: 0.42, bow: 0, horse: false, hp: 150, cost: 520, wage: 12, bio: "Wypędzony z kuźni klanu za runę, której nie wolno było wykuć.", helm: "dwarf", body: "plate" } as any,
  { id: "morkesh", name: "Mor-Kesh", race: "orc", role: "szaman", weapon: "club", shield: false, armor: 0.15, bow: 0, horse: false, hp: 120, cost: 340, wage: 8, bio: "Słyszy duchy przodków. Twierdzi, że większość z nich to nudziarze.", helm: "none", body: "fur" } as any,
  { id: "wilhelmina", name: "Wilhelmina Bez Ziemi", race: "human", role: "kwatermistrzyni", weapon: "dagger", shield: false, armor: 0.18, bow: 30, horse: true, hp: 100, cost: 280, wage: 7, bio: "Prowadziła tabory trzech wojen. Liczy suchary szybciej niż kapłan pacierze.", helm: "hood", body: "leather" } as any,
);
Object.assign(COMP_TRAITS, {
  lucjan: { likes: ["agata", "brakk"], hates: ["teodor"] },
  thrain: { likes: ["brakk", "dvalin"], hates: ["morkesh"] },
  morkesh: { likes: ["grashna", "urgh"], hates: ["ilse", "thrain"] },
  wilhelmina: { likes: ["mira", "wojmir"], hates: ["lisek"] },
});

// ---------- Osobiste zadania ----------
interface PQ { kind: "hunt" | "visit" | "pay" | "deliver"; text: (s: Settlement) => string; done: string; amount?: number; good?: string; n?: number; bandit?: string; }
const PQUESTS: Record<string, PQ> = {
  kasia: { kind: "hunt", bandit: "Banda Rudego Wita", text: (s) => `Kasia: „Rudy Wit zabił mojego brata. Jego banda kręci się koło ${s.name}.” Rozbij ją.`, done: "Kasia wyciera grot strzały. „Teraz mogę spać.”" },
  bogdan: { kind: "pay", amount: 600, text: (s) => `Bogdan winien jest 600 denarów lichwiarzowi w ${s.name}. Spłać dług, zanim przyjdą po jego palce.`, done: "Bogdan klepie cię w plecy tak, że aż dudni. „Nie zapomnę.”" },
  ilse: { kind: "visit", text: (s) => `Siostra Ilse chce się modlić przy grobie swej przeoryszy w ${s.name}.`, done: "Ilse wraca spokojniejsza. Jej modlitwy leczą szybciej." },
  dvalin: { kind: "deliver", good: "iron", n: 10, text: (s) => `Dvalin chce przekuć topór dziada. Dostarcz 10 żelaza do kuźni w ${s.name}.`, done: "Topór dziada znów błyszczy. Dvalin śpiewa całą noc." },
  grashna: { kind: "hunt", bandit: "Klan Sinego Ucha", text: (s) => `Grashna: „Siny Ucho wygnał mnie z klanu. Jego ludzie obozują przy ${s.name}.”`, done: "Grashna nosi teraz ucho rywala na rzemyku." },
  brakk: { kind: "deliver", good: "timber", n: 25, text: (s) => `Brakk projektuje nową machinę. Potrzebuje 25 drewna w ${s.name}.`, done: "Brakk ma plan machiny, która zbuduje się szybciej. Inżynieria +." },
  mira: { kind: "pay", amount: 800, text: (s) => `Mira chce wykupić udziały w kantorze w ${s.name} (800 denarów). Obiecuje, że się zwróci.`, done: "Mira dostaje udział w kantorze. Co tydzień przysyła ci zysk." },
  wojmir: { kind: "visit", text: (s) => `Wojmir słyszał o zarazie w ${s.name}. Chce tam iść z lekami.`, done: "Wojmir ratuje pół wioski. Ludzie znają teraz twoje imię." },
  urgh: { kind: "hunt", bandit: "Bracia Żelaznej Pięści", text: (s) => `Urgh: „Bracia Żelaznej Pięści mówią, że Urgh jest miękki.” Są koło ${s.name}.`, done: "Urgh śmieje się z łamiąc kości. Nikt już nie powie, że jest miękki." },
  elsbeth: { kind: "visit", text: (s) => `Elsbeth szuka zapisków swojego mistrza w okolicy ${s.name}.`, done: "Elsbeth odnajduje księgę mistrza. Jej czary są silniejsze." },
  hrodgar: { kind: "deliver", good: "ale", n: 10, text: (s) => `Hrodgar obiecał klanowi 10 beczek piwa do ${s.name} na stypę ojca.`, done: "Stypa trwa trzy dni. Hrodgar jest twój na zawsze." },
  lisek: { kind: "pay", amount: 500, text: (s) => `Kumple Liska siedzą w lochu w ${s.name}. Przekupienie strażnika: 500.`, done: "Kumple Liska rozbiegają się po kraju. Teraz wszędzie masz uszy." },
  agata: { kind: "hunt", bandit: "Zdrajcy z Czarnej Wieży", text: (s) => `Agata: „Ludzie, którzy spalili mój zamek, rabują teraz koło ${s.name}.”`, done: "Agata odzyskuje rodowy miecz z rąk herszta." },
  teodor: { kind: "visit", text: (s) => `Teodor chce stanąć przed rodziną zdradzonego pana w ${s.name} i prosić o wybaczenie.`, done: "Teodor wraca z twarzą mokrą od łez. Mówią na niego teraz Teodor Wierny." },
  lucjan: { kind: "hunt", bandit: "Pościg Legionu", text: (s) => `Za Lucjanem idą łowcy Legionu. Czekają na niego koło ${s.name}. Skończ to.`, done: "Lucjan pali swój list dezercji. „Jestem wolny.”" },
  thrain: { kind: "deliver", good: "iron", n: 15, text: (s) => `Thrain chce wykuć zakazaną runę. Potrzebuje 15 żelaza w ${s.name}.`, done: "Runa zapłonęła. Twoja broń w kuźni wychodzi lepsza." },
  morkesh: { kind: "visit", text: (s) => `Mor-Kesh mówi, że duchy wołają go do kurhanu koło ${s.name}.`, done: "Duchy przodków przemówiły. Mor-Kesh przynosi wróżby przed bitwą." },
  wilhelmina: { kind: "pay", amount: 400, text: (s) => `Wilhelmina chce kupić nowe wozy taborowe w ${s.name} (400).`, done: "Nowe wozy skrzypią mniej. Żywność starcza na dłużej." },
};
function cstate(c: CompanionState): any { return c as any; }
function devoted(c: CompanionState) { return !!cstate(c).devoted; }
function companionQuestsDaily(w: World) {
  const P = w.player;
  for (const c of P.companions) {
    const cs = cstate(c);
    cs.days = (cs.days || 0) + 1;
    if (cs.devoted || cs.pq || cs.days < 18 || !PQUESTS[c.id] || !chance(0.08)) continue;
    const def = PQUESTS[c.id];
    const towns = w.settlements.filter((s) => s.kind !== "castle" && s.faction !== 5).sort((a, b) => Math.hypot(a.cx - playerParty(w).x / WCELL, a.cy - playerParty(w).y / WCELL) - Math.hypot(b.cx - playerParty(w).x / WCELL, b.cy - playerParty(w).y / WCELL));
    const s = def.kind === "deliver" || def.kind === "pay" ? towns.filter((x) => x.kind === "town")[1 + (hashInt(c.id.length * 7) % 3)] : towns[3 + (hashInt(c.id.length * 13) % 5)];
    if (!s) continue;
    const id = w.questId++;
    const q: any = { id, kind: def.kind === "hunt" ? "bandits" : "letter", giver: s.id, target: s.id, amount: 0, reward: 0, days: 40, text: `Prośba kompana. ${def.text(s)}`, done: false, comp: c.id, pkind: def.kind };
    if (def.kind === "hunt") { const ang = rr(0, 6.28); q.spawn = { k: "bandit", x: (s.cx + Math.cos(ang) * 6) * WCELL, y: (s.cy + Math.sin(ang) * 6) * WCELL, n: 14 + P.level * 2, name: def.bandit }; if (!acceptQuest(q)) continue; const b = partyById(w, q.target); if (b) { addTroops(b.troops, "b_chief", 2); b.wait = 60; } }
    else if (def.kind === "pay" || def.kind === "deliver") { q.kind = "pquest"; P.quests.push(q); }
    else P.quests.push(q);
    cs.pq = id;
    addLogMsg(`${c.name} prosi o rozmowę przy ognisku: ${def.text(s).replace(/^[^:]*: /, "")}`, PAL.gold);
  }
  // nieukończone zadanie po terminie: kompan jest rozczarowany
  for (const q of P.quests) if ((q as any).comp && !q.done && q.days <= 1 && !(q as any).failed) {
    (q as any).failed = true; q.done = true;
    const c = P.companions.find((x) => x.id === (q as any).comp);
    if (c) { cstate(c).pq = 0; cstate(c).days = 0; P.morale = Math.max(0, P.morale - 5); addLogMsg(`${c.name} jest zawiedziony: nie pomogłeś w sprawie, na której mu zależało.`, PAL.redL); if (chance(0.3)) { P.companions = P.companions.filter((x) => x !== c); chron(w, `${c.name} odchodzi rozgoryczony.`, PAL.redL); } }
  }
  // Mira: zysk z kantoru
  if (P.companions.some((c) => c.id === "mira" && devoted(c)) && w.day % 7 === 0) { P.gold += 90; addLogMsg("Mira: zysk z kantoru, 90 denarów.", PAL.gold); }
}
// wołane po ukończeniu zadania (completeQuest)
function companionQuestDone(q: Quest, lines: string[]) {
  const w = WORLD, P = w.player, cid = (q as any).comp; if (!cid) return;
  const c = P.companions.find((x) => x.id === cid); if (!c) return;
  const cs = cstate(c); cs.devoted = true; cs.pq = 0;
  c.maxHp = Math.round(c.maxHp * 1.2); c.hp = c.maxHp; c.level += 2;
  lines.push(`${PQUESTS[cid].done} (${c.name} jest ci oddany: +20% zdrowia, +2 poziomy, nigdy nie odejdzie)`);
  chron(w, `${c.name} zostaje oddanym towarzyszem ${P.name}.`, PAL.gold, "player");
}
// zadania „zapłać” i „dostarcz” rozlicza się w mieście
function pquestRows(w: World, s: Settlement): string {
  const P = w.player;
  return P.quests.filter((q) => !q.done && (q as any).comp && q.target === s.id && ((q as any).pkind === "pay" || (q as any).pkind === "deliver")).map((q) => {
    const d = PQUESTS[(q as any).comp], ok = d.kind === "pay" ? P.gold >= d.amount! : (P.goods[d.good!] || 0) >= d.n!;
    return `<div class="row"><span>${ic("heart")} ${esc(P.companions.find((c) => c.id === (q as any).comp)?.name || "")}: ${d.kind === "pay" ? `${d.amount} denarów` : `${d.n}× ${GOODS[d.good!]?.name || d.good}`}</span><button class="mini" data-a="pqDo" data-v="${q.id}" ${ok ? "" : "disabled"}>${d.kind === "pay" ? "Zapłać" : "Oddaj"}</button></div>`;
  }).join("");
}
function pquestDo(w: World, qid: number) {
  const P = w.player, q = P.quests.find((x) => x.id === qid); if (!q) return;
  const d = PQUESTS[(q as any).comp];
  if (d.kind === "pay") { if (P.gold < d.amount!) return; P.gold -= d.amount!; } else { if ((P.goods[d.good!] || 0) < d.n!) return; P.goods[d.good!] -= d.n!; }
  const lines: string[] = []; completeQuest(q, lines); lines.forEach((l) => toast(l, PAL.gold));
}

// ---------- Specjaliści ----------
function hasRole(P: PlayerState, role: string) { return P.companions.some((c) => c.role === role && !(c as any).away); }
function foodUseK(P: PlayerState) { return hasRole(P, "kwatermistrzyni") ? (P.companions.some((c) => c.id === "wilhelmina" && devoted(c)) ? 0.75 : 0.85) : 1; }

// ---------- Dozbrajanie ----------
function gearCost(c: CompanionState) { return 120 + Math.round(c.armor * 600) + c.level * 30; }
function gearUp(c: CompanionState) {
  const P = WORLD.player, cost = gearCost(c);
  if (P.gold < cost || c.armor >= 0.6) return;
  P.gold -= cost; c.armor = Math.min(0.6, Math.round((c.armor + 0.05) * 100) / 100); c.maxHp += 4; c.hp = Math.min(c.maxHp, c.hp + 4);
  if (c.armor >= 0.3 && c.look.body === "leather") c.look.body = "mail";
  if (c.armor >= 0.45 && c.look.body === "mail") c.look.body = "plate";
  toast(`${c.name} kupuje lepszy pancerz (pancerz ${Math.round(c.armor * 100)}).`, PAL.gold); sfx.coin();
}

// ---------- Nobilitacja kompana ----------
function canEnnoble(w: World, c: CompanionState) { return w.player.status === "król" && !!fst(w, PLAYER_FACTION) && c.level >= 4 && myLands(w).some((s) => s.owner === -2 && s.kind !== "village"); }
function ennoble(w: World, c: CompanionState, sid: number) {
  const P = w.player, s = w.settlements[sid];
  if (!s || s.owner !== -2) return;
  const L: Lord = { id: Math.max(...w.lords.map((l) => l.id)) + 1, name: c.name, title: femName(c.name) ? "Baronowa" : "Baron", faction: PLAYER_FACTION, look: c.look, party: -1, renown: 200 + c.level * 40, relation: 60, alive: true, captive: -1, respawn: 0, ruler: false, personality: "honorowy" };
  (L as any).loyal = 90; (L as any).rank = 1; (L as any).fromComp = c.id;
  w.lords.push(L);
  s.owner = L.id; for (const v of w.settlements) if (v.bound === s.id && v.owner === -2) v.owner = L.id;
  w.ownerVersion++;
  P.companions = P.companions.filter((x) => x !== c);
  spawnLordParty(w, L);
  chron(w, `${P.name} pasuje ${c.name} i nadaje lenno ${s.name}. Nowy ród w ${P.kingdom}!`, PAL.gold, "lord");
  sfx.fanfare(); toast(`${c.name} klęka, wstaje jako ${L.title.toLowerCase()} na ${s.name}.`, PAL.gold);
}
function companionExtraHtml(w: World, c: CompanionState) {
  const P = w.player, cs = cstate(c);
  const fiefs = myLands(w).filter((s) => s.owner === -2 && s.kind !== "village");
  const q = cs.pq ? P.quests.find((x) => x.id === cs.pq && !x.done) : null;
  return `<div class="compx">${devoted(c) ? `<span class="gold">${ic("heart")} Oddany</span>` : q ? `<span class="muted">${ic("heart")} Ma prośbę: ${esc(q.text.replace(/<[^>]+>/g, "").slice(0, 90))}…</span>` : `<span class="muted">Jeszcze ci się nie zwierzył.</span>`}
    <button class="mini" data-a="gear" data-v="${c.id}" ${P.gold >= gearCost(c) && c.armor < 0.6 ? "" : "disabled"}>Niech się dozbroi (${gearCost(c)})</button>
    ${canEnnoble(w, c) ? `<select id="enf_${c.id}">${fiefs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select><button class="mini" data-a="ennoble" data-v="${c.id}">Pasuj na lorda i daj lenno</button>` : ""}</div>`;
}
function companionExtraActs(w: World, re: () => void): Acts {
  return {
    gear: (v) => { const c = w.player.companions.find((x) => x.id === v); if (c) gearUp(c); re(); },
    ennoble: (v) => { const c = w.player.companions.find((x) => x.id === v); const sel = document.getElementById("enf_" + v) as HTMLSelectElement | null; if (c && sel) ennoble(w, c, Number(sel.value)); re(); },
    pqDo: (v) => { pquestDo(w, Number(v)); re(); },
  };
}
