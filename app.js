(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const screens = $$(".screen");
  const overlays = $$(".backdrop");

  let timer = null;
  let afterConfirm = null; // what "Yes" does

  function showScreen(id) {
    screens.forEach((s) => s.classList.toggle("active", s.id === id));
  }
  function showOverlay(id) {
    overlays.forEach((o) => o.classList.toggle("active", o.id === id));
    if (id !== "loading") stopLoading();
  }
  function closeOverlays() {
    showOverlay(null);
  }

  // Loading overlay: wizard walks along the bar as it fills
  function startLoading(onDone) {
    const fill = $("#bar-fill"), wiz = $("#bar-wiz");
    const trackW = 288 - 24.2;
    let p = 0;
    showOverlay("loading");
    clearInterval(timer);
    timer = setInterval(() => {
      p = Math.min(1, p + 0.04);
      fill.style.visibility = "visible";
      fill.style.width = p * 288 + "px";
      wiz.style.left = 31 + p * trackW + "px";
      if (p >= 1) { clearInterval(timer); timer = null; onDone && onDone(); }
    }, 100);
  }
  function stopLoading() {
    clearInterval(timer);
    timer = null;
    const fill = $("#bar-fill"), wiz = $("#bar-wiz");
    if (fill) { fill.style.width = "0"; fill.style.visibility = "hidden"; }
    if (wiz) wiz.style.left = "31px";
  }

  // Browsers only let a script close tabs it opened itself, so closing usually fails.
  // When it does, tell the user with the error overlay instead of failing silently.
  function tryQuit() {
    window.close();
    setTimeout(() => { if (!window.closed) showOverlay("error"); }, 150);
  }

  function confirm(onYes) {
    afterConfirm = onYes;
    showOverlay("confirm");
  }

  // Row selection (delegated: rows on screens 2 and 3 are created at runtime)
  document.addEventListener("click", (e) => {
    const row = e.target.closest(".file-row");
    if (!row) return;
    $$(".file-row", row.closest("section")).forEach((r) => r.classList.remove("selected"));
    row.classList.add("selected");
    if (row.dataset.fid !== undefined) showPreview(files[Number(row.dataset.fid)]);
  });

  const actions = {
    donate: () => showOverlay("donation"),
    start: () => showScreen("frame-2"),
    exit: tryQuit,
    upload: () => $("#file-input").click(),
    // No files uploaded yet: tell the user with the error overlay instead of moving on
    "next-3": () => {
      if (!files.length) { showOverlay("error"); return; }
      renderReview(); showScreen("frame-3");
    },
    "next-4": () => { renderDeleteList(); showScreen("frame-4"); },
    keep: keepFile,
    // Deleting isn't possible in this prototype: after "Yes" show the error overlay
    delete: () => confirm(() => showOverlay("error")),
    restart: () => { resetSession(); showScreen("frame-1"); },
    quit: tryQuit,
    preview: () => showOverlay("error"),
    yes: () => { const f = afterConfirm; afterConfirm = null; closeOverlays(); f && f(); },
    no: () => { afterConfirm = null; closeOverlays(); },
    "close-overlay": closeOverlays,
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (el && actions[el.dataset.action]) actions[el.dataset.action]();
  });

  // ---------- Uploaded files: random category + realistic random metadata ----------
  const files = []; // { name, cat, size, type, modified }
  const CATS = ["good", "review", "danger"];
  const rand = (a, b) => a + Math.random() * (b - a);
  const KB = 1024, MB = KB * 1024;
  // extension -> [label, min bytes, max bytes]
  const KINDS = {
    pdf: ["PDF document", 60 * KB, 9 * MB], doc: ["Word document", 25 * KB, 2 * MB],
    docx: ["Word document", 20 * KB, 4 * MB], xls: ["Excel spreadsheet", 20 * KB, 3 * MB],
    xlsx: ["Excel spreadsheet", 15 * KB, 6 * MB], ppt: ["PowerPoint", 300 * KB, 20 * MB],
    pptx: ["PowerPoint", 300 * KB, 25 * MB], txt: ["Text File", 1 * KB, 150 * KB],
    md: ["Markdown File", 1 * KB, 80 * KB], csv: ["CSV File", 2 * KB, 15 * MB],
    json: ["JSON File", 1 * KB, 3 * MB], log: ["Log File", 2 * KB, 40 * MB],
    png: ["PNG image", 40 * KB, 8 * MB], jpg: ["JPEG image", 80 * KB, 7 * MB],
    jpeg: ["JPEG image", 80 * KB, 7 * MB], gif: ["GIF image", 20 * KB, 6 * MB],
    svg: ["SVG image", 1 * KB, 400 * KB], mp3: ["MP3 audio", 2 * MB, 14 * MB],
    wav: ["WAV audio", 8 * MB, 80 * MB], mp4: ["MP4 video", 8 * MB, 900 * MB],
    mov: ["QuickTime video", 15 * MB, 1500 * MB], zip: ["ZIP archive", 200 * KB, 300 * MB],
    rar: ["RAR archive", 200 * KB, 300 * MB], exe: ["Application", 300 * KB, 120 * MB],
    dll: ["Application extension", 20 * KB, 15 * MB], tmp: ["Temporary File", 1 * KB, 30 * MB],
    bak: ["Backup File", 50 * KB, 500 * MB], js: ["JavaScript File", 1 * KB, 900 * KB],
    html: ["HTML document", 1 * KB, 600 * KB], css: ["CSS stylesheet", 1 * KB, 300 * KB],
  };
  function fmtSize(b) {
    if (b < MB) return Math.max(1, Math.round(b / KB)) + " KB";
    if (b < 1024 * MB) return (b / MB).toFixed(1) + " MB";
    return (b / (1024 * MB)).toFixed(1) + " GB";
  }
  function fmtDate(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${p(d.getFullYear() % 100)}`;
  }
  function makeFile(name) {
    const m = /\.([^.]+)$/.exec(name);
    const ext = m ? m[1].toLowerCase() : "";
    const [type, lo, hi] = KINDS[ext] || [ext ? ext.toUpperCase() + " File" : "File", 10 * KB, 10 * MB];
    const bytes = Math.exp(rand(Math.log(lo), Math.log(hi))); // log-uniform: small files are more common
    const modified = new Date(Date.now() - Math.floor(rand(1, 3 * 365)) * 86400000); // within the last 3 years
    return { name, cat: CATS[Math.floor(Math.random() * 3)], size: fmtSize(bytes), type, modified: fmtDate(modified) };
  }

  function showPreview(f) {
    $("#frame-3 .pv-name").textContent = f.name;
    $("#frame-3 .pv-size").textContent = "Size: " + f.size;
    $("#frame-3 .pv-type").textContent = "Type: " + f.type;
    $("#frame-3 .pv-mod").textContent = "Modified: " + f.modified;
  }

  // Fill the three groups on screen 3 with the uploaded files (no files = keep the design placeholders)
  function renderReview() {
    if (!files.length) return;
    CATS.forEach((cat) => {
      const box = $(`#frame-3 [data-cat="${cat}"] .rows`);
      const mine = files.map((f, i) => [f, i]).filter(([f]) => f.cat === cat);
      box.replaceChildren();
      if (!mine.length) {
        const empty = document.createElement("button");
        empty.type = "button"; empty.className = "file-row empty"; empty.tabIndex = -1;
        empty.textContent = "No Files here";
        box.appendChild(empty);
        return;
      }
      mine.forEach(([f, i], k) => {
        const row = document.createElement("button");
        row.type = "button"; row.className = "file-row"; row.dataset.fid = String(i); row.title = f.name;
        const label = document.createElement("span");
        label.textContent = f.name; // textContent: file names are never parsed as HTML
        row.appendChild(label);
        if (mine.length > 1) {
          const n = document.createElement("span");
          n.className = "count"; n.textContent = `${k + 1}/${mine.length}`;
          row.appendChild(n);
        }
        box.appendChild(row);
      });
    });
    $$("#frame-3 .file-row").forEach((r) => r.classList.remove("selected"));
    const first = $("#frame-3 .file-row[data-fid]");
    if (first) { first.classList.add("selected"); showPreview(files[Number(first.dataset.fid)]); }
  }

  // ---------- Screen 4: files to keep / delete ----------
  function renderDeleteList() {
    const box = $("#frame-4 .inner");
    if (files.length) { // no uploads = keep the design placeholders
      box.replaceChildren();
      files.forEach((f) => {
        const row = document.createElement("button");
        row.type = "button"; row.className = "file-row file-row--dark"; row.title = f.name;
        const label = document.createElement("span");
        label.textContent = f.name; // textContent: file names are never parsed as HTML
        row.appendChild(label);
        box.appendChild(row);
      });
    }
    $$(".file-row", box).forEach((r) => r.classList.remove("selected"));
    const first = $(".file-row", box);
    if (first) first.classList.add("selected");
  }

  // Keep: take the selected file out of the list; when the list is empty go to the last screen
  function keepFile() {
    const box = $("#frame-4 .inner");
    const rows = $$(".file-row", box);
    if (!rows.length) { showScreen("frame-5"); return; }
    let i = rows.findIndex((r) => r.classList.contains("selected"));
    if (i < 0) i = 0;
    rows[i].remove();
    const left = $$(".file-row", box);
    if (!left.length) { showScreen("frame-5"); return; }
    const next = left[Math.min(i, left.length - 1)];
    next.classList.add("selected");
    next.scrollIntoView({ block: "nearest" });
  }

  // "Return to start" begins a fresh session: forget uploads and restore the design placeholders
  function resetSession() {
    files.length = 0;
    $("#upload-list").innerHTML = initial.uploadList;
    $("#upload-box").classList.remove("has-files");
    $("#frame-3 .list").innerHTML = initial.list3;
    $("#frame-4 .inner").innerHTML = initial.inner4;
    $$("#frame-3 .preview .meta p").forEach((p, i) => { p.textContent = initial.preview[i]; });
  }
  const initial = {
    uploadList: $("#upload-list").innerHTML,
    list3: $("#frame-3 .list").innerHTML,
    inner4: $("#frame-4 .inner").innerHTML,
    preview: $$("#frame-3 .preview .meta p").map((p) => p.textContent),
  };

  // Uploaded files appear as placeholder squares inside the upload box on screen 2
  const uploadList = $("#upload-list");
  function addUploadedFiles(names) {
    names.forEach((name) => {
      files.push(makeFile(name));
      const row = document.createElement("button");
      row.type = "button";
      row.className = "file-row";
      row.title = name;
      const label = document.createElement("span");
      label.textContent = name; // textContent: file names are never parsed as HTML
      row.appendChild(label);
      uploadList.appendChild(row);
    });
    $("#upload-box").classList.add("has-files");
    uploadList.scrollTop = uploadList.scrollHeight; // show the newest squares
  }

  // Picking a file shows the loading overlay, then adds it to the list on the upload screen
  $("#file-input").addEventListener("change", (e) => {
    const names = [...e.target.files].map((f) => f.name);
    e.target.value = "";
    if (!names.length) return;
    startLoading(() => { addUploadedFiles(names); closeOverlays(); });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOverlays();
  });

  // Hash routing so every design can be opened directly: #frame-1 … #frame-5, #confirm, #donation, #loading, #error
  function route() {
    const id = location.hash.slice(1);
    if (!id) return;
    if (id.startsWith("frame-")) { closeOverlays(); showScreen(id); }
    else if (id === "loading") startLoading();
    else if ($("#" + id)?.classList.contains("backdrop")) showOverlay(id);
  }
  window.addEventListener("hashchange", route);
  route();
})();
