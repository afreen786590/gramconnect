
const STORAGE_KEY = "gramconnect_demo_complaints_v1";

const groups = {
  Village: [
    "Water supply",
    "Road problems",
    "Streetlights",
    "Drainage",
    "Garbage collection",
    "Electricity",
    "Other village infrastructure"
  ],
  School: [
    "School bus / transportation",
    "School drinking water",
    "School toilets / sanitation",
    "Classroom / laboratory facilities",
    "Teacher / staff concern",
    "Other school issue"
  ],
  Community: [
    "Public health and sanitation",
    "Government service difficulty",
    "Public facilities",
    "Accessibility issue",
    "Other community service"
  ],
  Other: [
    "General community problem",
    "Suggestion / request"
  ]
};

const $ = id => document.getElementById(id);

let photoData = [];
let solutionPhotoData = "";
let audioData = "";
let mediaRecorder = null;
let audioChunks = [];
let currentLang = "en";

// STORAGE FUNCTIONS

function getComplaints() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function saveComplaints(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    alert("Browser storage is full. Please use smaller photos/audio.");
    return false;
  }
}

function makeId() {
  return "GC-" + new Date().getFullYear() + "-" +
    Math.floor(100000 + Math.random() * 900000);
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// CATEGORY DROPDOWN

function fillCategories(group, selectId = "category", selected = "") {
  const sel = $(selectId);

  if (!sel) return;

  sel.innerHTML =
    '<option value="">Select category</option>' +
    (groups[group] || []).map(c =>
      `<option value="${escapeHtml(c)}" ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`
    ).join("");
}

$("issueGroup").addEventListener("change", function () {
  fillCategories(this.value, "category");
});

$("qrGroup").addEventListener("change", function () {
  fillCategories(this.value, "qrCategory");
});

// IMAGE FUNCTIONS

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(Error("Choose an image file."));
    }

    if (file.size > 1024 * 1024) {
      return reject(Error("Each image must be under 1 MB."));
    }

    const r = new FileReader();

    r.onload = () => resolve(r.result);
    r.onerror = () => reject(Error("Could not read image."));

    r.readAsDataURL(file);
  });
}


function showPreviews(container, images) {
  const preview = $(container);

  if (!preview) {
    console.error("Preview container not found:", container);
    return;
  }

  preview.innerHTML = "";

  images.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Selected complaint photo";
    img.style.maxWidth = "150px";
    img.style.height = "auto";

    preview.appendChild(img);
  });
}

$("complaintPhotos").addEventListener("change", async e => {
  const input = e.target;
  const files = Array.from(input.files);
  alert("Photo selection detected: " + files.length);

  photoData = [];

  if (files.length > 2) {
    alert("You can select a maximum of 2 photos.");
    input.value = "";
    showPreviews("photoPreview", []);
    return;
  }

  try {
    for (const file of files) {
      photoData.push(await readImage(file));
    }

    showPreviews("photoPreview", photoData);

  } catch (err) {
    input.value = "";
    photoData = [];
    showPreviews("photoPreview", []);
    alert(err.message);
  }
});


$("solutionPhoto").addEventListener("change", async e => {
  solutionPhotoData = "";
  showPreviews("solutionPreview", []);

  if (e.target.files[0]) {
    try {
      solutionPhotoData = await readImage(e.target.files[0]);
      showPreviews("solutionPreview", [solutionPhotoData]);
    } catch (err) {
      e.target.value = "";
      alert(err.message);
    }
  }
});

// VOICE RECORDING


// VOICE RECORDING

$("startRecord").addEventListener("click", async () => {
  let stream;

  try {
    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Microphone is unavailable. Open the website using localhost in Chrome."
      );
    }

    if (!window.MediaRecorder) {
      throw new Error("Your browser does not support audio recording.");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, {
        type: mediaRecorder.mimeType || "audio/webm"
      });

      if (blob.size > 700 * 1024) {
        alert("Recording is too large. Record a shorter complaint.");
        audioData = "";
      } else {
        const reader = new FileReader();

        reader.onload = () => {
          audioData = reader.result;
          $("audioPreview").src = audioData;
          $("audioPreview").hidden = false;
          $("deleteAudio").hidden = false;
          $("recordStatus").textContent = "Recording ready";
        };

        reader.readAsDataURL(blob);
      }

      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();

    $("startRecord").disabled = true;
    $("stopRecord").disabled = false;
    $("recordStatus").textContent = "Recording...";

  } catch (err) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    alert("Recording error: " + err.name + "\n" + err.message);
    console.error("Microphone error:", err);
  }
});

$("stopRecord").addEventListener("click", () => {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    $("startRecord").disabled = false;
    $("stopRecord").disabled = true;
  }
});

$("deleteAudio").addEventListener("click", () => {
  audioData = "";

  $("audioPreview").removeAttribute("src");
  $("audioPreview").hidden = true;
  $("deleteAudio").hidden = true;
  $("recordStatus").textContent = "No recording";
});

// COMPLAINT SUBMISSION


$("complaintForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (mediaRecorder?.state === "recording") {
    return alert("Stop the voice recording before submitting.");
  }

  const item = {
    id: makeId(),
    name: $("reporterName").value.trim(),
    reporterType: $("reporterType").value,
    group: $("issueGroup").value,
    category: $("category").value,
    area: $("area").value.trim(),
    place: $("place").value.trim(),
    description: $("description").value.trim(),

    // Media upload will be added separately
    photos: [],
    audio: "",

    status: "Submitted",
    department: "",
    remarks: "",
    solutionPhoto: "",
    createdAt: new Date().toISOString(),

    history: [{
      status: "Submitted",
      note: "Complaint received.",
      at: new Date().toISOString()
    }],

    feedback: ""
  };

  const all = getComplaints();
  all.unshift(item);

  if (!saveComplaints(all)) return;

  try {
    await db.collection("complaintId")
      .doc(item.id)
      .set(item);

    $("submitMessage").innerHTML =
      `Complaint saved online! Your complaint ID is
      <strong>${item.id}</strong>. Please copy it to track progress.`;

    $("trackId").value = item.id;

    $("complaintForm").reset();

    photoData = [];
    audioData = "";

    showPreviews("photoPreview", []);

    $("audioPreview").hidden = true;
    $("deleteAudio").hidden = true;
    $("recordStatus").textContent = "No recording";

    fillCategories("");

    renderOfficerList();
    renderTrack(item);

  } catch (error) {
    console.error(error);
    alert("Online saving failed. Please check your internet and Firebase settings.");
  }
});


// COMPLAINT STATUS

function statusClass(s) {
  return s.replace(/\s+/g, "-");
}

// TRACK COMPLAINT

function renderTrack(c) {
  if (!c) {
    $("trackResult").innerHTML = "";
    return;
  }

  $("trackResult").innerHTML = `
    <article class="result-card">

      <div class="result-top">
        <strong>${escapeHtml(c.id)} • ${escapeHtml(c.category)}</strong>
        <span class="status ${statusClass(c.status)}">
          ${escapeHtml(c.status)}
        </span>
      </div>

      <p><b>Area:</b> ${escapeHtml(c.area)}
      ${c.place ? "• " + escapeHtml(c.place) : ""}</p>

      <p>${escapeHtml(c.description)}</p>

      ${c.photos?.length ? `
        <div class="evidence">
          ${c.photos.map(p =>
            `<img src="${p}" alt="Complaint evidence">`
          ).join("")}
        </div>
      ` : ""}

      ${c.audio ? `
        <p><b>Voice recording:</b></p>
        <audio controls src="${c.audio}"></audio>
      ` : ""}

      <p><b>Department:</b>
      ${escapeHtml(c.department || "Not assigned yet")}</p>

      <p><b>Officer response:</b>
      ${escapeHtml(c.remarks || "No officer update yet")}</p>

      ${c.solutionPhoto ? `
        <p><b>Officer solution photo:</b></p>
        <div class="evidence">
          <img src="${c.solutionPhoto}" alt="Solution evidence">
        </div>
      ` : ""}

      <div class="timeline">
        <strong>Progress history</strong>
        ${(c.history || []).map(h => `
          <div class="timeline-item">
            <b>${escapeHtml(h.status)}</b> —
            ${escapeHtml(h.note)}
            <br>
            <small>${new Date(h.at).toLocaleString()}</small>
          </div>
        `).join("")}
      </div>

      ${c.status === "Resolved" ? `
        <div class="feedback">
          <strong>Is your problem solved?</strong>
          <button class="btn btn-primary"
            onclick="giveFeedback('${c.id}', 'Solved')">
            Yes, solved
          </button>
          <button class="btn btn-secondary"
            onclick="giveFeedback('${c.id}', 'Not solved')">
            No, not solved
          </button>
        </div>
      ` : ""}

    </article>
  `;
}


$("trackForm").addEventListener("submit", e => {
  e.preventDefault();

  const c = getComplaints().find(x =>
    x.id.toLowerCase() === $("trackId").value.trim().toLowerCase()
  );

  $("trackResult").innerHTML = c
    ? ""
    : '<p class="form-message">No complaint found. Check the ID and try again.</p>';

  if (c) renderTrack(c);
});

// CITIZEN FEEDBACK

window.giveFeedback = (id, feedback) => {
  const all = getComplaints();
  const c = all.find(x => x.id === id);

  if (!c) return;

  if (feedback === "Not solved") {
    c.status = "Reopened";

    c.history.push({
      status: "Reopened",
      note: "Citizen reported that the problem is not solved.",
      at: new Date().toISOString()
    });

  } else {
    c.feedback = "Citizen confirmed: problem solved";

    c.history.push({
      status: c.status,
      note: "Citizen confirmed the problem is solved.",
      at: new Date().toISOString()
    });
  }

  saveComplaints(all);

  renderTrack(c);
  renderOfficerList();
};

// OFFICER DASHBOARD

function renderOfficerList() {
  const all = getComplaints();

  $("officerList").innerHTML = all.length
    ? all.map(c => `
      <article class="complaint-card">

        <div>
          <strong>${escapeHtml(c.id)} • ${escapeHtml(c.category)}</strong>

          <p>${escapeHtml(c.area)} —
          ${escapeHtml(c.description.slice(0, 110))}</p>

          <span class="status ${statusClass(c.status)}">
            ${escapeHtml(c.status)}
          </span>
        </div>

        <button class="btn btn-secondary"
        onclick="selectOfficer('${c.id}')">
          Review / update
        </button>

      </article>
    `).join("")
    : '<p class="muted">No demo complaints yet. Submit a test complaint first.</p>';
}

window.selectOfficer = id => {
  $("officerComplaintId").value = id;

  const c = getComplaints().find(x => x.id === id);

  if (c) {
    $("officerStatus").value =
      c.status === "Submitted" ? "Under Review" : c.status;

    $("department").value = c.department || "";
    $("officerRemarks").value = c.remarks || "";

    solutionPhotoData = c.solutionPhoto || "";

    showPreviews(
      "solutionPreview",
      solutionPhotoData ? [solutionPhotoData] : []
    );

    location.hash = "#officer";
  }
};

// SAVE OFFICER UPDATE

$("officerForm").addEventListener("submit", e => {
  e.preventDefault();

  const all = getComplaints();

  const c = all.find(x =>
    x.id === $("officerComplaintId").value.trim()
  );

  if (!c) {
    $("officerMessage").textContent = "Complaint ID not found.";
    return;
  }

  const old = c.status;

  c.status = $("officerStatus").value;
  c.department = $("department").value.trim();
  c.remarks = $("officerRemarks").value.trim();

  if (solutionPhotoData) {
    c.solutionPhoto = solutionPhotoData;
  }

  if (old !== c.status || c.remarks) {
    c.history.push({
      status: c.status,
      note: c.remarks || "Officer updated the complaint.",
      at: new Date().toISOString()
    });
  }

  if (!saveComplaints(all)) return;

  $("officerMessage").textContent = "Demo officer update saved.";

  renderOfficerList();

  if ($("trackId").value.trim() === c.id) {
    renderTrack(c);
  }
});

// QR CODE GENERATION

$("makeQr").addEventListener("click", () => {
  const raw = $("siteUrl").value.trim();

  try {
    const u = new URL(raw);

    if (!["https:", "http:"].includes(u.protocol)) {
      throw Error();
    }

    u.searchParams.set("group", $("qrGroup").value);
    u.searchParams.set("category", $("qrCategory").value);
    u.searchParams.set("area", $("qrArea").value.trim());

    const link = u.toString();

    $("qrOutput").innerHTML = `
      <img
        alt="QR code for complaint form"
        src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}"
      >

      <p>
        <b>QR destination:</b>
        <br>
        ${escapeHtml(link)}
        <br>
        <small>
          Scan with a phone camera to open the prefilled complaint form.
        </small>
      </p>
    `;

  } catch (e) {
    $("qrOutput").textContent =
      "Enter a valid public website URL beginning with https:// (or http:// for local testing).";
  }
});

// QR CODE PREFILL

function applyQrPrefill() {
  const p = new URLSearchParams(location.search);

  const g = p.get("group");
  const cat = p.get("category");
  const area = p.get("area");

  if (g && groups[g]) {
    $("issueGroup").value = g;
    fillCategories(g, "category", cat || "");
  }

  if (area) {
    $("area").value = area;
  }

  if (g || cat || area) {
    location.hash = "#submit";
  }
}

// LANGUAGE SWITCHING

$("languageBtn").addEventListener("click", () => {
  currentLang = currentLang === "en" ? "kn" : "en";

  document.querySelectorAll("[data-en]").forEach(el => {
    el.textContent = el.dataset[currentLang];
  });

  $("languageBtn").textContent =
    currentLang === "en" ? "ಕನ್ನಡ" : "English";
});

// FIREBASE OFFICER LOGIN

$("officerLoginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  $("loginMessage").textContent = "Checking login...";

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    $("loginMessage").textContent =
      "Login failed. Check your email and password.";
    console.error("Login error:", error);
  }
});

// VERIFY OFFICER ACCOUNT

auth.onAuthStateChanged(async user => {
  $("officerLogin").hidden = true;
  $("officerList").hidden = true;
  $("officerEditor").hidden = true;

  if (!user) {
    $("officerLogin").hidden = false;
    $("loginMessage").textContent = "";
    return;
  }

  try {
    const officerDoc = await db.collection("officers")
      .doc(user.uid)
      .get();

    if (
      !officerDoc.exists ||
      officerDoc.data().active !== true ||
      officerDoc.data().role !== "demo_officer"
    ) {
      alert("You are not authorized to access the Officer desk.");
      await auth.signOut();
      return;
    }

    $("officerLogin").hidden = true;
    $("officerList").hidden = false;
    $("officerEditor").hidden = false;

    renderOfficerList();

  } catch (error) {
    console.error("Officer verification error:", error);
    alert("Could not verify officer account. Please try again.");
    await auth.signOut();
  }
});

// OFFICER LOGOUT

$("officerLogout").addEventListener("click", async () => {
  await auth.signOut();
});

// INITIALIZE WEBSITE

fillCategories("", "category");
fillCategories("", "qrCategory");

applyQrPrefill();
renderOfficerList();
