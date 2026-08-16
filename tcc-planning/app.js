(() => {
  const D = window.TCC;
  if (!D) {
    document.getElementById("view").innerHTML =
      "<p class='empty'>data.js did not load. Open this folder as files, not from a preview that blocks scripts.</p>";
    return;
  }

  const view = document.getElementById("view");
  const filtersEl = document.getElementById("filters");
  const q = document.getElementById("q");
  const state = { route: "home", q: "", filter: "all" };

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const hay = (obj) =>
    Object.values(obj)
      .filter((v) => v != null)
      .join(" ")
      .toLowerCase();

  const pillClass = (label) => {
    const t = String(label || "").toLowerCase();
    if (t.includes("high") || t.includes("reversed") || t.includes("not exempt") || t.includes("grant → refuse"))
      return "pill high";
    if (t.includes("verified") || t.includes("exempt") || t === "varied" || t.includes("strong"))
      return "pill verified";
    if (t.includes("medium") || t.includes("unclear") || t.includes("provisional"))
      return "pill medium";
    return "pill";
  };

  const pill = (label) =>
    label ? `<span class="${pillClass(label)}">${esc(label)}</span>` : "";

  const more = (rows) =>
    `<dl class="more">${rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join("")}</dl>`;

  const matchQ = (obj) => !state.q || hay(obj).includes(state.q);

  function setFilters(buttons, extra = "") {
    if (!buttons.length && !extra) {
      filtersEl.hidden = true;
      filtersEl.innerHTML = "";
      return;
    }
    filtersEl.hidden = false;
    filtersEl.innerHTML =
      buttons
        .map(
          ([id, label]) =>
            `<button type="button" data-f="${esc(id)}" class="${state.filter === id ? "on" : ""}">${esc(label)}</button>`
        )
        .join("") + extra;
    filtersEl.querySelectorAll("button[data-f]").forEach((b) => {
      b.onclick = () => {
        state.filter = b.dataset.f;
        render();
      };
    });
  }

  function cardsHtml(items, renderCard) {
    if (!items.length) return `<p class="empty">Nothing matches that search.</p>`;
    return `<div class="grid">${items.map(renderCard).join("")}</div>`;
  }

  function bindCards() {
    view.querySelectorAll(".card").forEach((el) => {
      el.addEventListener("click", () => el.classList.toggle("open"));
    });
  }

  function home() {
    setFilters([]);
    const rev = D.appeals.filter((a) => a.outcome.startsWith("reversed")).length;
    const s5ne = D.section5.filter((s) => s.outcome === "not exempt").length;
    view.innerHTML = `
      <h2>Two layers, not one story</h2>
      <p class="lede">${esc(D.meta.note)} The strongest file is Dundrum. County-wide numbers are context, not proof that every file was wrongly decided.</p>
      <div class="stats">
        <div class="stat"><b>${D.evidence.length}</b><span>Evidence items</span></div>
        <div class="stat"><b>${D.chronology.length}</b><span>Timeline events</span></div>
        <div class="stat"><b>${D.appeals.length}</b><span>Appeals 2023–24</span></div>
        <div class="stat"><b>${rev}</b><span>Board reversals</span></div>
        <div class="stat"><b>${D.section5.length}</b><span>Section 5 files</span></div>
        <div class="stat"><b>${s5ne}</b><span>Declared not exempt</span></div>
      </div>
      <div class="doors">
        <a class="door" href="#/timeline"><p class="kicker">Dundrum</p><h3>Timeline and evidence</h3><p>What happened on the hotel file, fact by fact. Click a card to open the detail.</p></a>
        <a class="door" href="#/appeals"><p class="kicker">County</p><h3>Appeals as cards</h3><p>104 Board decisions. Filter to reversals, retention, or housing.</p></a>
        <a class="door" href="#/section5"><p class="kicker">County</p><h3>Section 5 as cards</h3><p>274 exemption files. Filter exempt / not exempt / referred.</p></a>
        <a class="door" href="#/records"><p class="kicker">Next</p><h3>Records still needed</h3><p>FOI tracker and complaint grounds, without the 22-tab spreadsheet.</p></a>
      </div>
      <div class="note">
        <strong>The short version</strong>
        ACP held the IPAS / emergency reception use is development and not exempt. On 13 August 2026 the Council said it will not issue an Enforcement Notice at this stage. Retention is high in Tipperary (about 26.5% of applications, 2022–25) and the Board usually changes appealed decisions — most often by varying conditions, not by reversing them.
      </div>
    `;
  }

  function timeline() {
    setFilters([]);
    const items = D.chronology.filter(matchQ);
    view.innerHTML = `
      <h2>Dundrum timeline</h2>
      <p class="lede">One card per event. Click to see the follow-up. ${items.length} shown.</p>
      <div class="timeline">
        ${items
          .map(
            (e) => `
          <button type="button" class="card">
            <div class="meta">${pill(e.Date)} ${pill(e["Evidence status"])} <span class="ref">${esc(e["File / ref"] || "")}</span></div>
            <p>${esc(e.Event)}</p>
            ${more([
              ["Actor", e.Actor],
              ["Why it matters", e.Significance],
              ["Source", e.Source],
              ["Follow-up", e["Follow-up"]],
            ])}
          </button>`
          )
          .join("")}
      </div>`;
    bindCards();
  }

  function evidence() {
    const themes = ["all", ...Array.from(new Set(D.evidence.map((e) => e.Theme))).sort()];
    setFilters(themes.map((t) => [t, t === "all" ? "All themes" : t]));
    const items = D.evidence.filter((e) => matchQ(e) && (state.filter === "all" || e.Theme === state.filter));
    view.innerHTML = `
      <h2>Evidence</h2>
      <p class="lede">Each card is one proposition. Status is on the card; click for the gap and next action.</p>
      ${cardsHtml(
        items,
        (e) => `
        <button type="button" class="card">
          <div class="meta"><span class="ref">${esc(e.ID)}</span> ${pill(e.Theme)} ${pill(e.Status)} ${pill(e.Confidence)}</div>
          <h3>${esc(e["Entity/File"] || "")}</h3>
          <p>${esc(e.Proposition)}</p>
          ${more([
            ["Type", e["Evidence type"]],
            ["Source", e["Source / page"]],
            ["Complaint relevance", e["Complaint relevance"]],
            ["Gap", e["Contradiction / gap"]],
            ["Next action", e["Next action"]],
            ["URL", e["Source URL"]],
          ])}
        </button>`
      )}`;
    bindCards();
  }

  function issues() {
    setFilters([
      ["all", "All"],
      ["High", "High"],
      ["Medium", "Medium"],
    ]);
    const items = D.issues.filter((e) => matchQ(e) && (state.filter === "all" || e.Priority === state.filter));
    view.innerHTML = `
      <h2>Issues</h2>
      <p class="lede">What can be argued now, and what would be an overstatement. Click a card for the next test.</p>
      ${cardsHtml(
        items,
        (e) => `
        <button type="button" class="card">
          <div class="meta">${pill(e.Priority)} ${pill(e["Likely forum"])}</div>
          <h3>${esc(e.Issue)}</h3>
          <p>${esc(e["What is presently supported"])}</p>
          ${more([
            ["Not yet proved", e["What is not yet proved"]],
            ["Best record", e["Best primary record"]],
            ["Do not overstate", e["Risk of overstatement"]],
            ["Next test", e["Next test"]],
          ])}
        </button>`
      )}`;
    bindCards();
  }

  function appeals() {
    const buckets = [
      "all",
      "reversed grant → refuse",
      "reversed refuse → grant",
      "varied",
      "confirmed refuse",
      "confirmed grant",
      "other",
    ];
    setFilters(
      buckets.map((b) => [b, b === "all" ? "All outcomes" : b]),
      `<select id="yearSel">
        <option value="all">2023 and 2024</option>
        <option value="2023">2023</option>
        <option value="2024">2024</option>
      </select>
      <select id="typeSel">
        <option value="all">All types</option>
        <option value="PERMISSION">Permission</option>
        <option value="RETENTION">Retention</option>
      </select>
      <span class="count" id="ncount"></span>`
    );
    const yearSel = document.getElementById("yearSel");
    const typeSel = document.getElementById("typeSel");
    yearSel.value = state.year || "all";
    typeSel.value = state.type || "all";
    yearSel.onchange = () => {
      state.year = yearSel.value;
      render();
    };
    typeSel.onchange = () => {
      state.type = typeSel.value;
      render();
    };

    const items = D.appeals.filter((a) => {
      if (!matchQ(a)) return false;
      if (state.filter !== "all" && a.outcome !== state.filter) return false;
      if ((state.year || "all") !== "all" && String(a.year) !== state.year) return false;
      if ((state.type || "all") !== "all" && a.type !== state.type) return false;
      return true;
    });
    const ncount = document.getElementById("ncount");
    if (ncount) ncount.textContent = `${items.length} cases`;

    view.innerHTML = `
      <h2>Appeals 2023–24</h2>
      <p class="lede">Council decision versus An Bord Pleanála / An Coimisiún Pleanála. “Varied” means the Board granted with revised conditions — NOAC still counts that as confirmed.</p>
      ${cardsHtml(
        items,
        (a) => `
        <button type="button" class="card">
          <div class="meta">${pill(a.outcome)} ${pill(a.type)} ${a.flags ? pill(a.flags) : ""} <span class="ref">${esc(a.year)}</span></div>
          <h3>${esc(a.address || "No address")}</h3>
          <p>${esc(a.description || "")}</p>
          ${more([
            ["TCC ref", a.tcc],
            ["ABP / ACP", a.abp],
            ["Council", `${a.council || ""} ${a.councilDate || ""}`],
            ["Board", a.board],
            ["Decision date", a.date],
            ["Case page", a.url],
          ])}
        </button>`
      )}`;
    bindCards();
  }

  function section5() {
    const buckets = [
      "all",
      "exempt",
      "not exempt",
      "not development",
      "referred, no TCC declaration",
      "not in public harvest",
      "unclear",
    ];
    setFilters(
      buckets.map((b) => [b, b === "all" ? "All outcomes" : b]),
      `<select id="yearSel">
        <option value="all">All years</option>
        ${[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]
          .map((y) => `<option value="${y}">${y}</option>`)
          .join("")}
      </select>
      <span class="count" id="ncount"></span>`
    );
    const yearSel = document.getElementById("yearSel");
    yearSel.value = state.s5year || "all";
    yearSel.onchange = () => {
      state.s5year = yearSel.value;
      render();
    };
    const items = D.section5.filter((s) => {
      if (!matchQ(s)) return false;
      if (state.filter !== "all" && s.outcome !== state.filter) return false;
      if ((state.s5year || "all") !== "all" && String(s.year) !== state.s5year) return false;
      return true;
    });
    const ncount = document.getElementById("ncount");
    if (ncount) ncount.textContent = `${items.length} files`;
    view.innerHTML = `
      <h2>Section 5 declarations</h2>
      <p class="lede">Public PDF harvest, not a certified Council register. Dundrum S5/25/127 is the referral with no published TCC declaration.</p>
      ${cardsHtml(
        items,
        (s) => `
        <button type="button" class="card">
          <div class="meta"><span class="ref">${esc(s.ref)}</span> ${pill(s.outcome)} ${s.abp ? pill("ACP " + s.abp) : ""}</div>
          <h3>${esc(s.address || s.applicant || "No address")}</h3>
          <p>${esc(s.description || "")}</p>
          ${more([
            ["Applicant", s.applicant],
            ["Year", s.year],
            ["Received / decided", [s.received, s.decided].filter(Boolean).join(" · ")],
            ["TCC outcome (raw)", s.rawOutcome],
            ["ACP status", s.abpStatus],
            ["Declaration PDF", s.url],
            ["ACP page", s.abpUrl],
          ])}
        </button>`
      )}`;
    bindCards();
  }

  function pct(v) {
    if (v == null || v === "") return "—";
    if (typeof v === "number" && v <= 1) return `${(v * 100).toFixed(1)}%`;
    return String(v);
  }

  function county() {
    setFilters([]);
    const perfRows = D.performance
      .map(
        (r) => `<tr>
          <td>${esc(r.Year)}</td>
          <td>${esc(r["Appeals determined"] ?? "—")}</td>
          <td>${pct(r["Tipp confirmed %"])}</td>
          <td>${esc(r["Tipp open/closed ratio"] ?? "—")}</td>
          <td>${esc(r["National ratio"] ?? "—")}</td>
        </tr>`
      )
      .join("");
    const appRows = D.appendix
      .map(
        (r) => `<tr>
          <td>${esc(r.Year)}</td>
          <td>${esc(r["Appealed (n)"])}</td>
          <td>${pct(r["Confirmed as-is"])}</td>
          <td>${pct(r.Varied)}</td>
          <td>${pct(r.Reversed)}</td>
        </tr>`
      )
      .join("");
    view.innerHTML = `
      <h2>County context</h2>
      <p class="lede">Use this to keep Dundrum in proportion. The same tables are in the Google Drive spreadsheet if you need to export.</p>
      <div class="note"><strong>Retention</strong> ${esc(
        (D.retention[0] && D.retention[0].Value) || ""
      )} of Tipperary applications were coded RETENTION in 2022–25, versus 17.4% nationally.</div>
      <h3>NOAC performance</h3>
      <table>
        <thead><tr><th>Year</th><th>Appeals decided</th><th>Tipp confirmed (NOAC)</th><th>Open/closed</th><th>National ratio</th></tr></thead>
        <tbody>${perfRows}</tbody>
      </table>
      <h3>ABP Appendix 13B (confirmed as-is vs varied vs reversed)</h3>
      <table>
        <thead><tr><th>Year</th><th>Appealed</th><th>Confirmed as-is</th><th>Varied</th><th>Reversed</th></tr></thead>
        <tbody>${appRows}</tbody>
      </table>
      <h3>Findings</h3>
      ${cardsHtml(
        D.findings.filter(matchQ),
        (f) => `
        <button type="button" class="card">
          <div class="meta">${pill(f.Assessment)}</div>
          <h3>${esc(f.Finding)}</h3>
          <p>${esc(f.Evidence)}</p>
          ${more([
            ["How it helps", f["How it helps the complaint"]],
            ["Caution", f.Caution],
            ["Next test", f["Next test"]],
          ])}
        </button>`
      )}
      <h3>OPR points</h3>
      ${cardsHtml(
        D.opr.filter(matchQ),
        (o) => `
        <button type="button" class="card">
          <h3>${esc(o["OPR point"])}</h3>
          <p>${esc(o["What it proves"])}</p>
          ${more([
            ["Does not prove", o["What it does not prove"]],
            ["Dundrum", o["Dundrum relevance"]],
            ["Complaint use", o["Complaint use"]],
            ["Next test", o["Next evidence test"]],
          ])}
        </button>`
      )}
      <h3>Dundrum retentions 2025</h3>
      <div class="grid">
        ${["2560641", "2560642"]
          .map((id) => {
            const r = D.dundrumRetentions[id] || {};
            return `<button type="button" class="card">
              <div class="meta"><span class="ref">${esc(id)}</span> ${pill(r.Decision || r.Type || "retention")}</div>
              <h3>${esc(r["What it covers"] || id)}</h3>
              <p>${esc(r["What it does not cover"] || "")}</p>
              ${more(Object.entries(r))}
            </button>`;
          })
          .join("")}
      </div>
    `;
    bindCards();
  }

  function records() {
    setFilters([
      ["all", "All"],
      ["Open", "Open"],
      ["Part received", "Part received"],
      ["High", "High priority"],
    ]);
    const recs = D.records.filter((r) => {
      if (!matchQ(r)) return false;
      if (state.filter === "all") return true;
      if (state.filter === "High") return r.Priority === "High";
      return r.Status === state.filter;
    });
    const cgs = D.complaints.filter(matchQ);
    view.innerHTML = `
      <h2>Records and complaint grounds</h2>
      <p class="lede">This is the to-do list, not a finished submission. Click a card for wording and cautions.</p>
      <h3>Records needed</h3>
      ${cardsHtml(
        recs,
        (r) => `
        <button type="button" class="card">
          <div class="meta"><span class="ref">${esc(r.ID)}</span> ${pill(r.Priority)} ${pill(r.Status)}</div>
          <h3>${esc(r["Record / dataset"])}</h3>
          <p>${esc(r["Why needed"])}</p>
          ${more([
            ["Holder", r.Holder],
            ["Route", r["Access route"]],
            ["Period", r.Period],
            ["Suggested wording", r["Suggested wording / scope"]],
            ["Dependency", r.Dependency],
          ])}
        </button>`
      )}
      <h3>Proposed grounds</h3>
      ${cardsHtml(
        cgs,
        (c) => `
        <button type="button" class="card">
          <div class="meta"><span class="ref">${esc(c.ID)}</span> ${pill(c.Priority)} ${pill(c.Readiness)}</div>
          <h3>${esc(c["Proposed complaint ground"])}</h3>
          <p>${esc(c["Current factual support"])}</p>
          ${more([
            ["Unproved", c["What remains unproved / pending"]],
            ["Concern to test", c["Administrative concern to test"]],
            ["Remedy", c["Remedy sought"]],
            ["Route", c["Primary route"]],
            ["Drafting caution", c["Drafting caution"]],
          ])}
        </button>`
      )}
    `;
    bindCards();
  }

  const pages = { home, timeline, evidence, issues, appeals, section5, county, records };

  function render() {
    const route = state.route in pages ? state.route : "home";
    document.querySelectorAll(".nav a").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === route);
    });
    if (route === "home") q.value = "";
    pages[route]();
  }

  function readHash() {
    const raw = (location.hash || "#/home").replace(/^#\/?/, "");
    const route = raw.split("?")[0] || "home";
    if (route !== state.route) state.filter = "all";
    state.route = route;
    render();
  }

  q.addEventListener("input", () => {
    state.q = q.value.trim().toLowerCase();
    if (state.route === "home") {
      location.hash = "#/evidence";
      return;
    }
    render();
  });

  window.addEventListener("hashchange", readHash);
  if (!location.hash) location.hash = "#/home";
  readHash();
})();
