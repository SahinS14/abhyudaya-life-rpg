require("dotenv").config();
const express = require("express"),
  bcrypt = require("bcryptjs"),
  jwt = require("jsonwebtoken"),
  postgres = require("postgres"),
  crypto = require("crypto"),
  path = require("path");
const app = express(),
  secret = process.env.JWT_SECRET,
  sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    ssl: "require",
  }),
  id = () => crypto.randomUUID(),
  one = async (q) => (await q)[0],
  task = (x) => ({ ...x, completed: !!x.completed_at }),
  xpForLevel = (l) => (100 * (l - 1) * l * (2 * l - 1)) / 6,
  level = (xp) => {
    let current = 1;
    while (xp >= xpForLevel(current + 1)) current++;
    return current;
  },
  next = (l) => xpForLevel(l + 1),
  hero = async (u) => {
    let character = await one(sql`select * from characters where user_id=${u}`);
    const correctLevel = character && level(Number(character.xp));
    if (character && character.level !== correctLevel)
      character = await one(sql`update characters set level=${correctLevel},updated_at=now() where user_id=${u} returning *`);
    return character;
  },
  day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : ""),
  refreshDaily = (db = sql) =>
    db`update tasks set completed_at=null where frequency='daily' and completed_at < date_trunc('day',now())`,
  fail = (r, s, e) => r.status(s).json({ error: e });
if (!secret || !process.env.DATABASE_URL)
  throw Error("JWT_SECRET and DATABASE_URL are required");
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((q, r, n) => {
  r.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  q.cookies = Object.fromEntries(
    (q.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((x) => {
        let i = x.indexOf("=");
        return [x.slice(0, i).trim(), decodeURIComponent(x.slice(i + 1))];
      }),
  );
  n();
});
const session = (r, u) => {
    let t = jwt.sign({ sub: u }, secret, { expiresIn: "7d" });
    r.setHeader(
      "Set-Cookie",
      `lifequest_session=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800; Secure`,
    );
    return t;
  },
  auth = (q, r, n) => {
    for (let t of [
      q.cookies.lifequest_session,
      (q.headers.authorization || "").replace(/^Bearer\s+/i, ""),
    ].filter(Boolean))
      try {
        q.userId = jwt.verify(t, secret).sub;
        return n();
      } catch {}
    return fail(r, 401, "Authentication required.");
  },
  log = (db, u, t, m, x = 0, g = 0) =>
    db`insert into activity_logs(id,user_id,type,message,xp_delta,gold_delta)values(${id()},${u},${t},${m},${x},${g})`;
app.get("/api/health", async (q, r) => {
  try {
    let required = [
        "users",
        "characters",
        "tasks",
        "activity_logs",
        "shop_items",
        "inventory",
        "user_settings",
      ],
      rows =
        await sql`select table_name from information_schema.tables where table_schema='public' and table_name in ${sql(required)}`,
      found = new Set(rows.map((x) => x.table_name)),
      missing = required.filter((x) => !found.has(x));
    if (missing.length)
      return fail(
        r,
        503,
        `Supabase schema is incomplete: missing ${missing.join(", ")}. Run supabase/schema.sql in this project's SQL Editor.`,
      );
    r.json({ status: "ok", database: "supabase-postgres", schema: "ready" });
  } catch (e) {
    console.error("health database error", e);
    fail(r, 503, "Database unavailable. Check DATABASE_URL in Vercel.");
  }
});
app.post("/api/auth/register", async (q, r) => {
  try {
    let e = String(q.body.email || "")
        .trim()
        .toLowerCase(),
      p = String(q.body.password || ""),
      name = String(q.body.name || "New Operative").slice(0, 40);
    if (!/^\S+@\S+\.\S+$/.test(e) || p.length < 8)
      return fail(
        r,
        400,
        "Use a valid email and a password of at least 8 characters.",
      );
    let u = id();
    await sql.begin(async (db) => {
      if (await one(db`select id from users where email=${e}`))
        throw Object.assign(Error("That email is already registered."), {
          s: 409,
        });
      await db`insert into users(id,email,password_hash)values(${u},${e},${await bcrypt.hash(p, 12)})`;
      await db`insert into characters(user_id,name)values(${u},${name})`;
      await log(db, u, "account", "Entered the Abhyudaya realm.");
    });
    r.status(201).json({
      user: { id: u, email: e },
      character: await hero(u),
      sessionToken: session(r, u),
    });
  } catch (x) {
    console.error("registration error", x);
    fail(
      r,
      x.s || 500,
      x.s
        ? x.message
        : "Account creation failed in the database. Open Vercel Function Logs for the exact database error.",
    );
  }
});
app.post("/api/auth/login", async (q, r) => {
  let u = await one(
    sql`select * from users where email=${String(q.body.email || "")
      .trim()
      .toLowerCase()}`,
  );
  if (
    !u ||
    !(await bcrypt.compare(String(q.body.password || ""), u.password_hash))
  )
    return fail(r, 401, "Incorrect email or password.");
  r.json({
    user: { id: u.id, email: u.email },
    character: await hero(u.id),
    sessionToken: session(r, u.id),
  });
});
app.post("/api/auth/logout", (q, r) => {
  r.setHeader(
    "Set-Cookie",
    "lifequest_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure",
  );
  r.status(204).end();
});
app.get("/api/me", auth, async (q, r) =>
  r.json({
    user: await one(
      sql`select id,email,created_at from users where id=${q.userId}`,
    ),
    character: await hero(q.userId),
  }),
);
app.post("/api/onboarding/complete", auth, async (q, r) => {
  try {
    let h = await hero(q.userId);
    if (h.onboarding_completed) return r.json({ character: h });
    let c = [
        "Technomancer",
        "Cyber Paladin",
        "Neural Rogue",
        "Chrono Alchemist",
      ].includes(q.body.class_name)
        ? q.body.class_name
        : "Technomancer",
      n =
        String(q.body.name || h.name)
          .trim()
          .slice(0, 40) || "New Operative",
      m = {
        int: "intellect",
        foc: "focus",
        dis: "discipline",
        vit: "vitality",
        str: "strength",
        cre: "creativity",
      },
      s = Object.fromEntries(
        Object.entries(m).map(([k, v]) => [
          v,
          Math.max(1, Math.min(20, Number(q.body.stats?.[k] || 1))),
        ]),
      );
    if (Object.values(s).reduce((a, b) => a + b, 0) > 80)
      return fail(
        r,
        400,
        "Attribute sync exceeds the available genesis allocation.",
      );
    await sql.begin(async (db) => {
      await db`update characters set name=${n},class_name=${c},intellect=${s.intellect},focus=${s.focus},discipline=${s.discipline},vitality=${s.vitality},strength=${s.strength},creativity=${s.creativity},origin_story=${String(q.body.origin_story || "").slice(0, 500)},directives_json=${JSON.stringify(Array.isArray(q.body.directives) ? q.body.directives.slice(0, 4) : [])},protocol=${["casual", "balanced", "hardcore"].includes(q.body.protocol) ? q.body.protocol : "balanced"},onboarding_completed=true,updated_at=now() where user_id=${q.userId}`;
      for (let [t, d, a, x, g] of [
        [
          "Refactor Payment Microservice",
          "Isolate webhooks and validate the service boundary.",
          "intellect",
          180,
          45,
        ],
        [
          "Morning Mobility & 5km Run",
          "Complete today’s movement protocol.",
          "strength",
          100,
          25,
        ],
        [
          "Complete System Design Chapter 4",
          "Study and capture key decisions.",
          "intellect",
          100,
          25,
        ],
        [
          "Hydration & Nutrition Protocol: 3L Water",
          "Complete your daily health protocol.",
          "discipline",
          50,
          10,
        ],
      ])
        await db`insert into tasks(id,user_id,title,description,attribute,xp_reward,gold_reward,frequency)values(${id()},${q.userId},${t},${d},${a},${x},${g},'daily')`;
      await log(db, q.userId, "character", `Forged ${n}, ${c}.`);
    });
    r.status(201).json({ character: await hero(q.userId) });
  } catch (e) {
    fail(r, 500, e.message);
  }
});
app.get("/api/tasks", auth, async (q, r) => {
  await refreshDaily();
  r.json(
    (
      await sql`select * from tasks where user_id=${q.userId} order by completed_at is not null,created_at asc`
    ).map(task),
  );
});
app.post("/api/tasks", auth, async (q, r) => {
  let a = String(q.body.attribute || "focus").toLowerCase(),
    t = String(q.body.title || "")
      .trim()
      .slice(0, 120),
    x = Number(q.body.xp_reward || 25),
    g = Number(q.body.gold_reward || 10);
  if (
    !t ||
    ![
      "strength",
      "intellect",
      "focus",
      "discipline",
      "vitality",
      "creativity",
    ].includes(a) ||
    !Number.isInteger(x) ||
    x < 5 ||
    x > 500 ||
    !Number.isInteger(g) ||
    g < 1 ||
    g > 250
  )
    return fail(r, 400, "Invalid quest details.");
  r.status(201).json(
    task(
      await one(
        sql`insert into tasks(id,user_id,title,description,attribute,xp_reward,gold_reward,frequency)values(${id()},${q.userId},${t},${String(q.body.description || "").slice(0, 500)},${a},${x},${g},${["daily", "weekly", "once"].includes(q.body.frequency) ? q.body.frequency : "daily"}) returning *`,
      ),
    ),
  );
});
app.post("/api/tasks/:id/complete", auth, async (q, r) => {
  try {
    let z = await sql.begin(async (db) => {
      await refreshDaily(db);
      let t = await one(
        db`select * from tasks where id=${q.params.id} and user_id=${q.userId} for update`,
      );
      if (!t) throw Object.assign(Error("Quest not found."), { s: 404 });
      if (t.completed_at)
        throw Object.assign(Error("This quest was already completed."), {
          s: 409,
        });
      let h = await one(
          db`select * from characters where user_id=${q.userId} for update`,
        ),
        today = new Date().toISOString().slice(0, 10),
        yes = new Date(Date.now() - 864e5).toISOString().slice(0, 10),
        st =
          day(h.last_completed_on) === today
            ? h.current_streak
            : day(h.last_completed_on) === yes
              ? h.current_streak + 1
              : 1,
        x = h.xp + t.xp_reward,
        l = level(x);
      await db`update tasks set completed_at=now() where id=${t.id}`;
      await db.unsafe(
        `update characters set xp=$1,gold=gold+$2,${t.attribute}=${t.attribute}+1,level=$3,current_streak=$4,longest_streak=greatest(longest_streak,$4),last_completed_on=$5 where user_id=$6`,
        [x, t.gold_reward, l, st, today, q.userId],
      );
      await log(
        db,
        q.userId,
        "quest_complete",
        `Completed: ${t.title}`,
        t.xp_reward,
        t.gold_reward,
      );
      if (l > h.level)
        await log(db, q.userId, "level_up", `Reached Level ${l}.`);
      return { t, l, up: l > h.level };
    });
    r.json({
      task: task(await one(sql`select * from tasks where id=${z.t.id}`)),
      character: await hero(q.userId),
      levelUp: z.up,
      xpToNext: next(z.l),
    });
  } catch (x) {
    fail(r, x.s || 500, x.message);
  }
});
app.get("/api/activity", auth, async (q, r) =>
  r.json(
    await sql`select * from activity_logs where user_id=${q.userId} order by created_at desc limit 100`,
  ),
);
app.get("/api/notifications", auth, async (q, r) => {
  let x =
    await sql`select id,type,message,created_at from activity_logs where user_id=${q.userId} order by created_at desc limit 5`;
  r.json({
    notifications: x.map((v) => ({
      ...v,
      title:
        v.type === "quest_complete"
          ? "Quest completed"
          : v.type === "level_up"
            ? "Level ascension"
            : "Realm update",
    })),
  });
});
app.patch("/api/tasks/:id", auth, async (q, r) => {
  let t = await one(
    sql`select * from tasks where id=${q.params.id} and user_id=${q.userId}`,
  );
  if (!t) return fail(r, 404, "Quest not found.");
  if (t.completed_at) return fail(r, 409, "Completed quests cannot be edited.");
  let title =
    q.body.title === undefined
      ? t.title
      : String(q.body.title).trim().slice(0, 120);
  if (!title) return fail(r, 400, "Quest title is required.");
  r.json(
    task(
      await one(
        sql`update tasks set title=${title},description=${q.body.description === undefined ? t.description : String(q.body.description).slice(0, 500)},due_date=${q.body.due_date === undefined ? t.due_date : q.body.due_date} where id=${t.id} returning *`,
      ),
    ),
  );
});
app.delete("/api/tasks/:id", auth, async (q, r) => {
  let x =
    await sql`delete from tasks where id=${q.params.id} and user_id=${q.userId} and completed_at is null returning id`;
  if (!x.length) return fail(r, 404, "Active quest not found.");
  r.status(204).end();
});
app.get("/api/progression", auth, async (q, r) => {
  let h = await hero(q.userId),
    n = Number(
      (
        await one(
          sql`select count(*)::int as n from activity_logs where user_id=${q.userId} and type='quest_complete'`,
        )
      ).n,
    ),
    floor = xpForLevel(h.level),
    to = next(h.level);
  r.json({
    character: h,
    completedQuests: n,
    xpForLevel: floor,
    xpForNext: to,
    levelProgress: Math.max(
      0,
      Math.min(100, Math.round(((h.xp - floor) / (to - floor)) * 100)),
    ),
  });
});
app.get("/api/settings", auth, async (q, r) => {
  await sql`insert into user_settings(user_id)values(${q.userId})on conflict do nothing`;
  r.json(
    await one(
      sql`select sound_enabled,reduced_motion,theme from user_settings where user_id=${q.userId}`,
    ),
  );
});
app.patch("/api/settings", auth, async (q, r) => {
  await sql`insert into user_settings(user_id)values(${q.userId})on conflict do nothing`;
  let s = await one(sql`select * from user_settings where user_id=${q.userId}`);
  r.json(
    await one(
      sql`update user_settings set sound_enabled=${q.body.sound_enabled === undefined ? s.sound_enabled : !!q.body.sound_enabled},reduced_motion=${q.body.reduced_motion === undefined ? s.reduced_motion : !!q.body.reduced_motion},theme=${["cyberpunk", "midnight"].includes(q.body.theme) ? q.body.theme : s.theme},updated_at=now() where user_id=${q.userId} returning sound_enabled,reduced_motion,theme`,
    ),
  );
});
app.get("/api/shop", auth, async (q, r) =>
  r.json(
    await sql`select s.*,exists(select 1 from inventory i where i.item_id=s.id and i.user_id=${q.userId}) as owned from shop_items s order by price`,
  ),
);
app.post("/api/shop/:id/purchase", auth, async (q, r) => {
  try {
    let x = await sql.begin(async (db) => {
      let i = await one(db`select * from shop_items where id=${q.params.id}`),
        h = await one(
          db`select * from characters where user_id=${q.userId} for update`,
        );
      if (!i) throw Object.assign(Error("Item not found."), { s: 404 });
      if (h.gold < i.price)
        throw Object.assign(Error("Not enough gold."), { s: 409 });
      if (
        await one(
          db`select item_id from inventory where user_id=${q.userId} and item_id=${i.id}`,
        )
      )
        throw Object.assign(Error("You already own this item."), { s: 409 });
      await db`insert into inventory(user_id,item_id)values(${q.userId},${i.id})`;
      await db`update characters set gold=gold-${i.price} where user_id=${q.userId}`;
      await log(db, q.userId, "purchase", `Purchased: ${i.name}`, 0, -i.price);
      return i;
    });
    r.status(201).json({ item: x, character: await hero(q.userId) });
  } catch (e) {
    fail(r, e.s || 500, e.message);
  }
});
app.get("/api/inventory", auth, async (q, r) =>
  r.json(
    await sql`select s.*,i.purchased_at,i.equipped,i.quantity from inventory i join shop_items s on s.id=i.item_id where i.user_id=${q.userId} order by i.equipped desc,i.purchased_at desc`,
  ),
);
app.post("/api/inventory/:id/:action", auth, async (q, r) => {
  try {
    let action = q.params.action,
      x = await sql.begin(async (db) => {
        let i = await one(
          db`select s.* from inventory v join shop_items s on s.id=v.item_id where v.user_id=${q.userId} and v.item_id=${q.params.id}`,
        );
        if (!i)
          throw Object.assign(Error("Item is not in your inventory."), {
            s: 404,
          });
        if (action === "equip") {
          if (!["relic", "badge", "theme", "aura"].includes(i.category))
            throw Object.assign(Error("This item cannot be equipped."), {
              s: 409,
            });
          await db`update inventory set equipped=false where user_id=${q.userId} and item_id in(select id from shop_items where category=${i.category})`;
          await db`update inventory set equipped=true where user_id=${q.userId} and item_id=${i.id}`;
          await log(db, q.userId, "inventory", `Equipped: ${i.name}.`);
        } else if (action === "use") {
          if (!["consumable", "booster"].includes(i.category))
            throw Object.assign(Error("This item cannot be used."), { s: 409 });
          await db`delete from inventory where user_id=${q.userId} and item_id=${i.id}`;
          await log(db, q.userId, "inventory", `Used: ${i.name}.`);
        } else if (action === "disenchant") {
          if (!i.price)
            throw Object.assign(Error("Item cannot be disenchanted."), {
              s: 404,
            });
          let g = Math.max(1, Math.floor(i.price * 0.4));
          await db`delete from inventory where user_id=${q.userId} and item_id=${i.id}`;
          await db`update characters set gold=gold+${g} where user_id=${q.userId}`;
          await log(
            db,
            q.userId,
            "inventory",
            `Disenchanted: ${i.name}.`,
            0,
            g,
          );
          i.gold = g;
        } else
          throw Object.assign(Error("Unknown inventory action."), { s: 404 });
        return i;
      });
    r.json({
      item: x,
      gold: x.gold,
      character: await hero(q.userId),
      inventory:
        await sql`select s.*,i.equipped from inventory i join shop_items s on s.id=i.item_id where i.user_id=${q.userId}`,
    });
  } catch (e) {
    fail(r, e.s || 500, e.message);
  }
});
app.patch("/api/character", auth, async (q, r) => {
  let h = await hero(q.userId),
    n = String(q.body.name || "")
      .trim()
      .slice(0, 40),
    c = String(q.body.class_name || "")
      .trim()
      .slice(0, 40);
  if (!n && !c) return fail(r, 400, "Provide a character name or class.");
  r.json(
    await one(
      sql`update characters set name=${n || h.name},class_name=${c || h.class_name},updated_at=now() where user_id=${q.userId} returning *`,
    ),
  );
});
app.post("/api/ascensions/claim", auth, async (q, r) => {
  let h = await hero(q.userId),
    v = ["intellect", "focus", "discipline"].map((k) =>
      Number(q.body.allocation?.[k] || 0),
    );
  if (h.level < 2)
    return fail(r, 409, "Reach level 2 before claiming an ascension reward.");
  if (
    !v.every(Number.isInteger) ||
    v.some((x) => x < 0) ||
    v.reduce((a, b) => a + b, 0) !== 3
  )
    return fail(r, 400, "Allocate all 3 ascension points before claiming.");
  try {
    await sql.begin(async (db) => {
      if (
        await one(
          db`select level from ascension_claims where user_id=${q.userId} and level=${h.level}`,
        )
      )
        throw Object.assign(Error("Ascension reward already claimed."), {
          s: 409,
        });
      await db`insert into ascension_claims(user_id,level)values(${q.userId},${h.level})`;
      await db`update characters set gold=gold+250,intellect=intellect+${v[0]},focus=focus+${v[1]},discipline=discipline+${v[2]} where user_id=${q.userId}`;
      await db`insert into inventory(user_id,item_id)values(${q.userId},'ascension-cache')on conflict do nothing`;
      await log(
        db,
        q.userId,
        "ascension",
        `Claimed level ${h.level} ascension cache.`,
        0,
        250,
      );
    });
    r.status(201).json({
      character: await hero(q.userId),
      level: h.level,
      allocation: { intellect: v[0], focus: v[1], discipline: v[2] },
    });
  } catch (e) {
    fail(r, e.s || 500, e.message);
  }
});
app.get("/api/achievements", auth, async (q, r) => {
  let h = await hero(q.userId),
    n = Number(
      (
        await one(
          sql`select count(*)::int as n from activity_logs where user_id=${q.userId} and type='quest_complete'`,
        )
      ).n,
    ),
    i = Number(
      (
        await one(
          sql`select count(*)::int as n from inventory where user_id=${q.userId}`,
        )
      ).n,
    ),
    claims = new Set(
      (
        await sql`select achievement_id from achievement_claims where user_id=${q.userId}`
      ).map((x) => x.achievement_id),
    ),
    a = [
      ["first-quest", "First Signal", "Complete your first quest.", n, 1, 50],
      ["centurion", "Centurion of Focus", "Complete 100 quests.", n, 100, 500],
      [
        "streak-7",
        "Week of Will",
        "Maintain a 7-day streak.",
        h.longest_streak,
        7,
        100,
      ],
      ["collector", "Armory Initiate", "Acquire 3 rewards.", i, 3, 100],
      ["ascendant", "Ascendant", "Reach level 10.", h.level, 10, 350],
    ].map(([id, title, description, p, target, gold_reward]) => ({
      id,
      title,
      description,
      unlocked: p >= target,
      progress: Math.min(p, target),
      target,
      gold_reward,
      claimed: claims.has(id),
    }));
  r.json({ completedQuests: n, achievements: a });
});
app.post("/api/achievements/:id/claim", auth, async (q, r) => {
  let rewards = {
    "first-quest": 50,
    centurion: 500,
    "streak-7": 100,
    collector: 100,
    ascendant: 350,
  };
  if (!rewards[q.params.id]) return fail(r, 404, "Achievement not found.");
  let data = await one(
    sql`select (select count(*)::int from activity_logs where user_id=${q.userId} and type='quest_complete') as completed,(select count(*)::int from inventory where user_id=${q.userId}) as items`,
    ),
    h = await hero(q.userId),
    ok = {
      "first-quest": data.completed >= 1,
      centurion: data.completed >= 100,
      "streak-7": h.longest_streak >= 7,
      collector: data.items >= 3,
      ascendant: h.level >= 10,
    }[q.params.id];
  if (!ok) return fail(r, 409, "This achievement is not unlocked yet.");
  try {
    await sql.begin(async (db) => {
      if (
        await one(
          db`select achievement_id from achievement_claims where user_id=${q.userId} and achievement_id=${q.params.id}`,
        )
      )
        throw Object.assign(Error("Reward already claimed."), { s: 409 });
      await db`insert into achievement_claims(user_id,achievement_id)values(${q.userId},${q.params.id})`;
      await db`update characters set gold=gold+${rewards[q.params.id]} where user_id=${q.userId}`;
      await log(
        db,
        q.userId,
        "achievement",
        `Claimed achievement reward: ${q.params.id}.`,
        0,
        rewards[q.params.id],
      );
    });
    r.status(201).json({
      character: await hero(q.userId),
      gold_reward: rewards[q.params.id],
    });
  } catch (e) {
    fail(r, e.s || 500, e.message);
  }
});
app.get("/api/export.json", auth, async (q, r) => {
  r.setHeader(
    "Content-Disposition",
    'attachment; filename="abhyudaya-export.json"',
  );
  r.json({
    exported_at: new Date().toISOString(),
    character: await hero(q.userId),
    tasks: (
      await sql`select * from tasks where user_id=${q.userId} order by created_at desc`
    ).map(task),
    activity:
      await sql`select * from activity_logs where user_id=${q.userId} order by created_at desc`,
    inventory:
      await sql`select s.* from inventory i join shop_items s on s.id=i.item_id where i.user_id=${q.userId}`,
  });
});
app.get("/api/export.csv", auth, async (q, r) => {
  let x =
      await sql`select created_at,type,message,xp_delta,gold_delta from activity_logs where user_id=${q.userId} order by created_at desc`,
    v = (a) => `"${String(a ?? "").replaceAll('"', '""')}"`;
  r.type("text/csv")
    .setHeader(
      "Content-Disposition",
      'attachment; filename="abhyudaya-activity.csv"',
    )
    .send(
      [
        "timestamp,type,message,xp_delta,gold_delta",
        ...x.map((z) =>
          [z.created_at, z.type, z.message, z.xp_delta, z.gold_delta]
            .map(v)
            .join(","),
        ),
      ].join("\n"),
    );
});
app.post("/api/tokens", auth, async (q, r) => {
  let t = `abh_${crypto.randomBytes(24).toString("base64url")}`;
  await sql`insert into api_tokens(id,user_id,token_hash,token_prefix)values(${id()},${q.userId},${crypto.createHash("sha256").update(t).digest("hex")},${t.slice(0, 10)})`;
  r.status(201).json({
    token: t,
    message: "Copy this key now; it cannot be retrieved again.",
  });
});
app.get("/api/tokens", auth, async (q, r) =>
  r.json(
    await sql`select id,token_prefix,created_at,revoked_at from api_tokens where user_id=${q.userId} order by created_at desc`,
  ),
);
app.post("/api/guild/contribute", auth, async (q, r) => {
  let kind = q.body.kind === "mana" ? "mana" : "gold",
    amount =
      kind === "mana"
        ? 5
        : Math.max(1, Math.min(1000, Number(q.body.amount || 0)));
  if (!Number.isInteger(amount)) return fail(r, 400, "Invalid contribution.");
  try {
    await sql.begin(async (db) => {
      let h = await one(
        db`select gold from characters where user_id=${q.userId} for update`,
      );
      if (kind === "gold" && h.gold < amount)
        throw Object.assign(Error("Not enough Gold."), { s: 409 });
      if (kind === "gold")
        await db`update characters set gold=gold-${amount} where user_id=${q.userId}`;
      if (kind === "gold")
        await db`update guild_state set treasury_gold=treasury_gold+${amount} where id=1`;
      else await db`update guild_state set mana=mana+${amount} where id=1`;
      await db`insert into guild_contributions(id,user_id,kind,amount)values(${id()},${q.userId},${kind},${amount})`;
      await log(
        db,
        q.userId,
        "guild",
        `Contributed ${amount} ${kind === "gold" ? "Gold" : "Mana"} to the guild.`,
        0,
        kind === "gold" ? -amount : 0,
      );
    });
    r.json({
      state: await one(sql`select * from guild_state where id=1`),
      character: await hero(q.userId),
    });
  } catch (e) {
    fail(r, e.s || 500, e.message);
  }
});
app.post("/api/account/rebirth", auth, async (q, r) => {
  if (q.body.confirmation !== "REBIRTH")
    return fail(r, 400, "Type REBIRTH to confirm this reset.");
  await sql.begin(async (db) => {
    for (let table of [
      "tasks",
      "inventory",
      "activity_logs",
      "achievement_claims",
      "ascension_claims",
    ])
      await db.unsafe(`delete from ${table} where user_id=$1`, [q.userId]);
    await db`update characters set level=1,xp=0,gold=0,strength=1,intellect=1,focus=1,discipline=1,vitality=1,creativity=1,current_streak=0,longest_streak=0,last_completed_on=null,onboarding_completed=false,origin_story='',directives_json='[]' where user_id=${q.userId}`;
    await log(db, q.userId, "account", "Began a new Abhyudaya cycle.");
  });
  r.json({ character: await hero(q.userId) });
});
app.delete("/api/account", auth, async (q, r) => {
  let u = await one(sql`select password_hash from users where id=${q.userId}`);
  if (
    !u ||
    !(await bcrypt.compare(String(q.body.password || ""), u.password_hash))
  )
    return fail(r, 401, "Confirm with your current password.");
  await sql`delete from users where id=${q.userId}`;
  r.setHeader(
    "Set-Cookie",
    "lifequest_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure",
  );
  r.status(204).end();
});
app.use(
  express.static(path.join(__dirname, "public"), { index: "index.html" }),
);
app.use((e, q, r, n) =>
  fail(
    r,
    e.s || 500,
    e.message || "The realm encountered an unexpected error.",
  ),
);
if (!process.env.VERCEL) app.listen(process.env.PORT || 3000);
module.exports = app;
