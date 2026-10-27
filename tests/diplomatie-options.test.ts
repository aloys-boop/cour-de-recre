import { afterEach, describe, expect, it } from 'vitest';
import { TeamAi, TAG_LOANED } from '../src/core/ai';
import { Diplomacy } from '../src/core/diplomacy';
import { DiplomacyExtras, EXTRAS } from '../src/core/diplomacy-extras';
import { DEFAULT_RULES, RULE_TOGGLES, normalizeRules, type GameRules } from '../src/core/rules';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'arene4',
  name: 'Arène',
  w: 14,
  h: 14,
  teams: 4,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 12, y: 12, owner: 1 },
    { kind: 'camp', x: 0, y: 12, owner: 2 },
    { kind: 'camp', x: 12, y: 0, owner: 3 },
    { kind: 'bonus', x: 3, y: 3, suit: 'heart' },
    { kind: 'bonus', x: 9, y: 9, suit: 'spade' },
    { kind: 'bonus', x: 6, y: 6, suit: 'club' },
  ],
};

const SAVED = { ...EXTRAS };
afterEach(() => Object.assign(EXTRAS, SAVED));

function setup(rules: GameRules = { gifts: true, sos: true, tribute: true }) {
  const w = new World(ARENA, 4, 7);
  w.rules = normalizeRules(rules);
  const dip = new Diplomacy(w, 'difficile', [1, 2, 3], 7);
  const ex = new DiplomacyExtras(w, dip, 0, 7);
  return { w, dip, ex };
}

function tile(w: World, x: number, y: number) {
  return w.tiles.find((t) => t.x === x && t.y === y)!;
}

function spawnMany(w: World, team: number, n: number, x: number, y: number) {
  return Array.from({ length: n }, (_, i) => w.spawnUnit(team, x + (i % 4) * 0.3, y + Math.floor(i / 4) * 0.3, false));
}

function tick(w: World, seconds: number, each?: (dt: number) => void) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    each?.(step);
    w.update(step);
  }
}

describe('options de diplomatie : désactivées par défaut', () => {
  it('trois options dans le menu, inactives par défaut et en campagne (pas de règles)', () => {
    const keys = RULE_TOGGLES.map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['gifts', 'sos', 'tribute']));
    for (const k of ['gifts', 'sos', 'tribute'] as const) {
      expect(DEFAULT_RULES[k]).toBeFalsy();
      expect(normalizeRules(undefined)[k]).toBeFalsy(); // campagne : Game reçoit rules = undefined
    }
  });

  it('sans les options, rien ne se passe : ni cadeau, ni SOS, ni tribut, ni initiative des IA', () => {
    const { w, ex } = setup({});
    w.setAllied(0, 1, true);
    const mine = spawnMany(w, 0, 3, 2, 2);
    tile(w, 3, 3).owner = 0;
    spawnMany(w, 1, 12, 11, 11);
    expect(ex.giftUnits(0, 1, mine.map((u) => u.id))).toEqual([]);
    expect(ex.giftSelected(1, new Set(mine.map((u) => u.id))).ok).toBe(false);
    expect(ex.playerCedeTile(1).ok).toBe(false);
    expect(ex.callSos(0).result).toBe('off');
    expect(ex.payTribute(2).ok).toBe(false);
    expect(mine.every((u) => u.team === 0)).toBe(true);
    expect(tile(w, 3, 3).owner).toBe(0);
    // Les IA ne prennent aucune initiative, même avec des probabilités certaines.
    Object.assign(EXTRAS, { giftChance: 1, offerChance: 1, aiSosChance: 1 });
    tick(w, 60, (dt) => ex.update(dt));
    expect(ex.drainMessages()).toEqual([]);
    expect(ex.offer).toBeNull();
    expect(w.isFriend(0, 2)).toBe(false);
  });
});

describe('cadeaux entre alliés', () => {
  it('les élèves sélectionnés passent à l’allié, gardent leurs PV et quittent la sélection', () => {
    const { w, ex } = setup();
    w.setAllied(0, 1, true);
    const mine = spawnMany(w, 0, 4, 2, 2);
    mine[0].hp = 17;
    mine[1].hp = 33;
    const sel = new Set([mine[0].id, mine[1].id, mine[2].id]);
    const r = ex.giftSelected(1, sel);
    expect(r.ok).toBe(true);
    expect(r.text).toBe('Les Verts reçoivent 3 élèves. Merci !');
    expect(mine.slice(0, 3).map((u) => u.team)).toEqual([1, 1, 1]);
    expect(mine[3].team).toBe(0);
    expect(mine[0].hp).toBe(17);
    expect(mine[1].hp).toBe(33);
    expect(sel.size).toBe(0);
    expect(w.teamUnitCount(1)).toBe(3);
    // Personne ne se bat : l'élève resté au joueur et les élèves donnés sont amis.
    tick(w, 2);
    expect(mine[3].hp).toBe(mine[3].maxHp);
  });

  it('refuse poliment sans sélection, et seulement entre alliés', () => {
    const { w, ex } = setup();
    const mine = spawnMany(w, 0, 2, 2, 2);
    expect(ex.giftSelected(1, new Set(mine.map((u) => u.id))).ok).toBe(false); // pas allié
    w.setAllied(0, 1, true);
    const r = ex.giftSelected(1, new Set());
    expect(r.ok).toBe(false);
    expect(r.text).toBe('Sélectionne d’abord les élèves à donner aux Verts.');
    // Des élèves d'une autre équipe dans la sélection ne sont jamais transférés.
    const foe = w.spawnUnit(2, 5, 5, false);
    expect(ex.giftSelected(1, new Set([foe.id])).ok).toBe(false);
    expect(foe.team).toBe(2);
  });

  it('céder une case : la case bonus la plus proche de l’allié, jamais un camp', () => {
    const { w, ex } = setup();
    w.setAllied(0, 1, true);
    tile(w, 3, 3).owner = 0;
    tile(w, 9, 9).owner = 0;
    w.refreshMods();
    expect(ex.nearestBonusTile(0, 1)).toBe(tile(w, 9, 9));
    const r = ex.playerCedeTile(1);
    expect(r.ok).toBe(true);
    expect(r.text).toBe('Tu cèdes une case \u2660 aux Verts.');
    expect(tile(w, 9, 9).owner).toBe(1);
    expect(w.mods[1].suits.spade).toBeGreaterThan(0);
    expect(w.mods[0].suits.spade).toBe(0);
    ex.playerCedeTile(1); // le cœur
    expect(tile(w, 3, 3).owner).toBe(1);
    // Plus de case bonus : refus, et le camp reste au joueur.
    const camp = tile(w, 0, 0);
    expect(ex.playerCedeTile(1).ok).toBe(false);
    expect(ex.transferTile(camp, 0, 1)).toBe(false);
    expect(ex.cedeTile(0, 1, camp)).toBeNull();
    expect(camp.owner).toBe(0);
  });

  it('une IA alliée aide parfois un allié en difficulté (annoncé)', () => {
    const { w, ex } = setup({ gifts: true });
    EXTRAS.giftChance = 1;
    w.setAllied(0, 1, true);
    spawnMany(w, 0, 2, 2, 2);
    spawnMany(w, 1, 14, 11, 11);
    tick(w, EXTRAS.firstThink + 6, (dt) => ex.update(dt));
    expect(w.teamUnitCount(0)).toBeGreaterThan(2);
    const msgs = ex.drainMessages();
    expect(msgs.some((m) => m.important && /^Cadeau ! Les Verts t’offrent \d élèves\.$/.test(m.text))).toBe(true);
  });
});

describe('appel à l’aide', () => {
  it('les alliés envoient une partie de leurs élèves libres, les gardent au camp ~25 s, puis repartent', () => {
    const { w, ex } = setup({ sos: true });
    w.setAllied(0, 1, true);
    const ai = new TeamAi(w, 1, 'difficile');
    spawnMany(w, 1, 10, 11, 11);
    spawnMany(w, 0, 2, 0.8, 0.8);
    // Un ennemi rôde près du camp du joueur, loin des renforts.
    const r = ex.callSos(0);
    expect(r.result).toBe('ok');
    const n = r.sent.get(1)!;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
    const helpers = w.units.filter((u) => u.aiTag === TAG_LOANED);
    expect(helpers).toHaveLength(n);
    expect(ex.helpersFor(0)).toBe(n);
    expect(ex.sosCooldownLeft()).toBeCloseTo(EXTRAS.sosCooldown, 5);
    expect(ex.callSos(0).result).toBe('recharge');
    const camp = tile(w, 0, 0);
    const far = () => helpers.reduce((s, u) => s + Math.hypot(u.x - camp.cx, u.y - camp.cy), 0) / helpers.length;
    tick(w, 20, (dt) => {
      ai.update(dt);
      ex.update(dt);
    });
    // Ils sont venus et l'IA ne les a pas rappelés.
    expect(far()).toBeLessThan(2.5);
    expect(helpers.every((u) => u.aiTag === TAG_LOANED)).toBe(true);
    tick(w, 6, (dt) => {
      ai.update(dt);
      ex.update(dt);
    });
    expect(ex.helpersFor(0)).toBe(0);
    expect(helpers.every((u) => u.aiTag !== TAG_LOANED)).toBe(true);
    tick(w, 8, (dt) => {
      ai.update(dt);
      ex.update(dt);
    });
    // Rendus à leur IA, ils repartent vers ses objectifs.
    expect(far()).toBeGreaterThan(3);
  });

  it('refus poli sans allié ; pas de recharge consommée', () => {
    const { w, ex } = setup({ sos: true });
    spawnMany(w, 1, 6, 11, 11);
    const r = ex.playerSos();
    expect(r.ok).toBe(false);
    expect(r.text).toBe('Personne pour t’aider : allie-toi d’abord avec une équipe.');
    expect(ex.sosCooldownLeft()).toBe(0);
  });

  it('une IA attaquée appelle ses alliés ; le joueur, allié, est prévenu', () => {
    const { w, ex } = setup({ sos: true });
    EXTRAS.aiSosChance = 1;
    w.setAllied(0, 1, true);
    w.setAllied(1, 2, true);
    spawnMany(w, 2, 8, 1, 11);
    spawnMany(w, 3, 6, 11.5, 11.5); // assaut sur le camp des Verts
    tick(w, EXTRAS.firstThink + 6, (dt) => ex.update(dt));
    const msgs = ex.drainMessages();
    expect(msgs.some((m) => m.important && m.text.startsWith('Les Verts appellent à l’aide : leur camp est attaqué !'))).toBe(true);
    expect(w.units.some((u) => u.team === 2 && u.aiTag === TAG_LOANED)).toBe(true);
  });
});

describe('tribut et trêve', () => {
  it('payer un tribut : une case à l’ennemi, 30 s sans dégâts ni capture, puis le combat reprend', () => {
    const { w, ex } = setup({ tribute: true });
    tile(w, 3, 3).owner = 0;
    w.refreshMods();
    const a = w.spawnUnit(0, 6, 6, false);
    const b = w.spawnUnit(1, 6.3, 6, false);
    const raider = w.spawnUnit(1, 0.9, 0.9, false); // sur le camp du joueur
    tick(w, 0.6);
    expect(a.hp + b.hp).toBeLessThan(a.maxHp + b.maxHp); // ils se battent
    const r = ex.payTribute(1);
    expect(r.ok).toBe(true);
    expect(r.text).toBe('Les Verts acceptent la case ♥ : trêve de 30 s.');
    expect(tile(w, 3, 3).owner).toBe(1);
    expect(a.engagedId).toBe(-1);
    expect(ex.truceLeft(1)).toBeCloseTo(30, 5);
    expect(ex.payTribute(1).ok).toBe(false); // déjà en trêve
    tick(w, 0.4); // un coup déjà parti ne porte pas
    const hp = [a.hp, b.hp];
    tick(w, 28, (dt) => ex.update(dt));
    expect([a.hp, b.hp]).toEqual(hp);
    expect(tile(w, 0, 0).owner).toBe(0);
    expect(tile(w, 0, 0).capTeam).toBe(NO_TEAM);
    expect(raider.hp).toBe(raider.maxHp);
    tick(w, 2, (dt) => ex.update(dt));
    expect(ex.truceLeft(1)).toBe(0);
    expect(ex.drainMessages().some((m) => m.text === 'Fin de la trêve avec les Verts !')).toBe(true);
    tick(w, 2, (dt) => ex.update(dt));
    expect(a.hp + b.hp).toBeLessThan(hp[0] + hp[1]);
  });

  it('l’IA refuse si le joueur n’a pas de case bonus ; pas de tribut entre alliés', () => {
    const { w, ex } = setup({ tribute: true });
    w.spawnUnit(1, 11, 11, false);
    const r = ex.payTribute(1);
    expect(r.ok).toBe(false);
    expect(r.text).toBe('Les Verts refusent : tu n’as aucune case bonus à leur offrir.');
    expect(w.isFriend(0, 1)).toBe(false);
    tile(w, 3, 3).owner = 0;
    w.setAllied(0, 1, true);
    expect(ex.payTribute(1).ok).toBe(false);
  });

  it('une IA en mauvaise posture propose un tribut : Accepter donne la case et la trêve ; sinon elle expire', () => {
    Object.assign(EXTRAS, { offerChance: 1, firstThink: 0 });
    const { w, ex } = setup({ tribute: true });
    tile(w, 9, 9).owner = 1;
    w.refreshMods();
    w.spawnUnit(1, 13, 13, false);
    spawnMany(w, 0, 16, 9.4, 12.2); // le joueur, bien plus fort, assiège le camp des Verts
    tick(w, 3, (dt) => ex.update(dt));
    expect(ex.offer?.from).toBe(1);
    expect(ex.drainMessages().some((m) => m.important && m.text === 'Les Verts proposent un tribut : une case ♠ contre 30 s de trêve.')).toBe(true);
    const r = ex.acceptOffer();
    expect(r.ok).toBe(true);
    expect(tile(w, 9, 9).owner).toBe(0);
    expect(ex.truceLeft(1)).toBeGreaterThan(29);
    expect(w.isFriend(0, 1)).toBe(true);
    expect(w.isAllied(0, 1)).toBe(false); // une trêve n'est pas une alliance (pas de victoire commune)

    // Seconde partie : la proposition expire au bout de ~8 s.
    const s = setup({ tribute: true });
    tile(s.w, 9, 9).owner = 1;
    s.w.spawnUnit(1, 13, 13, false);
    spawnMany(s.w, 0, 16, 9.4, 12.2);
    tick(s.w, 3, (dt) => s.ex.update(dt));
    expect(s.ex.offer).not.toBeNull();
    tick(s.w, EXTRAS.offerSeconds + 0.5, (dt) => s.ex.update(dt));
    expect(s.ex.offer).toBeNull();
    expect(tile(s.w, 9, 9).owner).not.toBe(0);
  });
});
