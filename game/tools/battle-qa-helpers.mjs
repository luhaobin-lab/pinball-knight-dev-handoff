// Read-only instrumentation plus ordinary mouse/keyboard input for the extracted battle scene.
// Pass an existing Playwright page; these helpers do not send core gameplay commands.
export async function waitBattleReady(page) {
  await page.waitForFunction(() => {
    const s = window.__shell, v = s?.game.view;
    return window.__ready && v?.screen === 'room' && !v.modal && v.inputOpen &&
      s.game.legal().some(c => c.type === 'aim.release') &&
      v.field.some(a => (a.kind === 'enemy' || a.kind === 'boss') && !a.hidden && a.hp > 0);
  }, null, { timeout: 60000 });
}

export async function instrumentBattle(page) {
  await page.evaluate(() => {
    if (window.__battleQa) return;
    const s = window.__shell;
    if (!s) throw new Error('window.__shell is required for battle QA');
    const qa = window.__battleQa = { commands: [], events: [] };
    const send = s.send.bind(s);
    s.send = cmd => {
      const ok = send(cmd);
      qa.commands.push({ cmd, ok, at: s.game.view.time });
      return ok;
    };
    const drain = s.game.drainEvents.bind(s.game);
    s.game.drainEvents = () => {
      const events = drain();
      qa.events.push(...events);
      return events; // The renderer receives every original event unchanged.
    };
  });
}

export async function battleSnapshot(page) {
  return page.evaluate(() => {
    const s = window.__shell, v = s.game.view, stage = s.controller.stage;
    const rendered = stage?.heroView();
    return {
      screen: v.screen, phase: v.phase, modal: v.modal?.kind ?? null,
      inputOpen: v.inputOpen, time: v.time, floor: v.run?.floor, turn: v.run?.turn,
      hero: v.hero && { id: v.hero.id, row: v.hero.row, position: v.hero.position,
        hp: v.hero.hp, maxHp: v.hero.maxHp, stamina: v.hero.stamina,
        armor: v.hero.armor, statuses: v.hero.statuses },
      renderedHero: rendered && { x: rendered.x, z: rendered.z,
        visible: rendered.group.visible, attached: !!rendered.group.parent },
      enemies: v.field.filter(a => a.kind === 'enemy' || a.kind === 'boss').map(a => ({
        id: a.id, row: a.row, hp: a.hp, maxHp: a.maxHp, position: a.position,
        hidden: a.hidden, intent: a.intent, rendered: !!stage?.actor(a.id)?.group.parent,
      })),
      equip: v.inventory.equip.map(c => ({ id: c.id, row: c.row, charge: c.charge,
        chargeMax: c.chargeMax, place: c.place, durability: c.durability })),
      launch: v.launch && { duration: v.launch.playback.duration,
        end: v.launch.playback.end, contacts: v.launch.playback.contacts.map(c => ({
          kind: c.kind, index: c.index, position: c.position, time: c.time,
        })) },
      shell: s.stats,
      qa: { commands: window.__battleQa?.commands ?? [], events: window.__battleQa?.events ?? [] },
    };
  });
}

export async function chooseMouseAim(page, mode = 'enemy-and-wall') {
  return page.evaluate(mode => {
    const s = window.__shell, g = s.game, v = g.view, stage = s.controller.stage;
    if (!v.hero || !stage) throw new Error('No live battle stage');
    const r = stage.renderer, box = r.canvas.getBoundingClientRect(), origin = v.hero.position;
    let best = null;
    // Read the real preview to pick a reproducible target, then use a real mouse release to launch.
    for (let degrees = 0; degrees < 360; degrees += 2) {
      const angle = degrees * Math.PI / 180;
      const aim = { x: Math.round((origin.x + Math.cos(angle) * 128) / 4) * 4,
                    y: Math.round((origin.y + Math.sin(angle) * 128) / 4) * 4 };
      const t = stage.frame.toTiles(aim.x, aim.y);
      const p = r.projectToScreen({ x: t.x, y: 0, z: t.z });
      const client = { x: box.left + p.x, y: box.top + p.y };
      if (client.x < 12 || client.x > innerWidth - 12 || client.y < 12 || client.y > innerHeight - 12) continue;
      const pointer = s.sample({ clientX: client.x, clientY: client.y });
      if (pointer.hud !== null || !pointer.floor) continue;
      const preview = g.preview(aim);
      if (!preview || !preview.legs.length) continue;
      const enemies = preview.legs.filter(c => c.marker === 'enemy').length;
      const walls = preview.legs.filter(c => c.marker === 'wall').length;
      const score = mode === 'wall' ? walls * 100 - enemies * 200 :
        mode === 'enemy' ? enemies * 100 + walls : enemies * 100 + walls * 10;
      if (!best || score > best.score) best = { degrees, aim, client, score, enemies, walls,
        predictedEnd: preview.terminal?.end ?? preview.legs.at(-1).end,
        preview: preview.legs.map(c => ({ index: c.index, start: c.start, end: c.end,
          marker: c.marker, bounceDirection: c.bounceDirection, bounceable: c.bounceable })) };
    }
    if (!best) throw new Error('No mouse-accessible aim target');
    return best;
  }, mode);
}

export async function mouseLaunch(page, target, { holdMs = 120, timeoutMs = 30000 } = {}) {
  const before = await battleSnapshot(page);
  const commandStart = before.qa.commands.length, eventStart = before.qa.events.length;
  await page.mouse.move(target.client.x, target.client.y);
  await page.waitForTimeout(60);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(holdMs);
  const held = await battleSnapshot(page);
  if (held.qa.commands.slice(commandStart).some(c => c.cmd.type === 'aim.release')) {
    throw new Error('Mouse press fired before release');
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(start => window.__battleQa.commands.slice(start).some(c =>
    c.cmd.type === 'aim.release' && c.ok), commandStart, { timeout: 5000 });
  await page.waitForFunction(start => window.__battleQa.events.slice(start).some(e => e.kind === 'launch.end'),
    eventStart, { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const v = window.__shell.game.view;
    return !v.launch && (v.inputOpen || v.modal || v.screen !== 'room');
  }, null, { timeout: timeoutMs });
  const after = await battleSnapshot(page);
  return { before, held, after,
    commands: after.qa.commands.slice(commandStart),
    events: after.qa.events.slice(eventStart) };
}

export async function hudPoint(page, target) {
  return page.evaluate(target => {
    const hud = window.__shell.hud, canvas = hud.canvas, box = canvas.getBoundingClientRect();
    for (let y = 2; y < canvas.height; y += 4) {
      for (let x = 2; x < canvas.width; x += 4) {
        if (hud.hitTest(x, y) === target) return {
          x: box.left + x * box.width / canvas.width,
          y: box.top + y * box.height / canvas.height,
        };
      }
    }
    throw new Error(`No HUD target ${target}`);
  }, target);
}
