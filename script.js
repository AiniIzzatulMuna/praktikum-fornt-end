// =========================================================
// Formulir Pendaftaran Ekstrakurikuler — Validasi Real-Time
// =========================================================

const form = document.getElementById("regForm");
const stamp = document.getElementById("stamp");
const formNote = document.getElementById("formNote");
const serialEl = document.getElementById("serial");

// Nomor seri "tiket" dibuat acak setiap halaman dimuat — kosmetik saja.
serialEl.textContent = "EK-" + String(Math.floor(Math.random() * 9000) + 1000);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Setiap validator mengembalikan pesan error, atau string kosong jika valid.
const validators = {
  nama(value){
    const v = value.trim();
    if (v.length === 0) return "Nama tidak boleh kosong.";
    if (v.length < 3) return "Minimal 3 karakter.";
    return "";
  },
  email(value){
    const v = value.trim();
    if (v.length === 0) return "Email tidak boleh kosong.";
    if (!EMAIL_PATTERN.test(v)) return "Format email tidak valid.";
    return "";
  },
  password(value){
    if (value.length === 0) return "Password tidak boleh kosong.";
    if (value.length < 8) return "Minimal 8 karakter.";
    return "";
  },
  konfirmasi(value){
    const pass = document.getElementById("password").value;
    if (value.length === 0) return "Konfirmasi password wajib diisi.";
    if (value !== pass) return "Tidak sama dengan password.";
    return "";
  },
  ekskul(value){
    if (!value) return "Pilih salah satu kegiatan.";
    return "";
  }
};

function getFieldEls(name){
  const wrapper = form.querySelector(`[data-field="${name}"]`);
  return {
    wrapper,
    input: wrapper.querySelector("input, select"),
    msg: wrapper.querySelector(".field__msg")
  };
}

function validateField(name){
  const { wrapper, input, msg } = getFieldEls(name);
  const error = validators[name](input.value);

  wrapper.classList.remove("is-valid", "is-invalid");

  if (error){
    wrapper.classList.add("is-invalid");
    msg.textContent = error;
  } else {
    wrapper.classList.add("is-valid");
    msg.textContent = name === "ekskul" ? "Kegiatan dipilih." : "Terlihat baik.";
  }
  return !error;
}

function clearFieldState(name){
  const { wrapper, msg } = getFieldEls(name);
  wrapper.classList.remove("is-valid", "is-invalid");
  msg.textContent = "";
}

const fieldNames = Object.keys(validators);

// Validasi berjalan saat pengguna mengetik (real-time) begitu ia mulai mengisi,
// dan saat kolom kehilangan fokus.
fieldNames.forEach((name) => {
  const { input } = getFieldEls(name);

  input.addEventListener("input", () => {
    if (input.value.length === 0){
      clearFieldState(name);
    } else {
      validateField(name);
    }
    // Password berubah -> konfirmasi perlu dicek ulang.
    if (name === "password"){
      const { input: confInput } = getFieldEls("konfirmasi");
      if (confInput.value.length > 0) validateField("konfirmasi");
    }
  });

  input.addEventListener("blur", () => {
    if (input.value.length > 0) validateField(name);
  });
});

// Mencegah reload halaman & memvalidasi semua kolom saat submit.
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const results = fieldNames.map((name) => validateField(name));
  const allValid = results.every(Boolean);

  if (!allValid){
    formNote.textContent = "Masih ada kolom yang perlu diperbaiki sebelum tiket bisa dicetak.";
    formNote.style.color = "var(--coral)";

    const firstInvalid = form.querySelector(".is-invalid input, .is-invalid select");
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  // Semua valid: tampilkan stempel & pesan sukses, lalu reset formulir.
  formNote.textContent = "Pendaftaran berhasil! Tiketmu sudah sah.";
  formNote.style.color = "var(--teal)";

  stamp.classList.remove("show");
  void stamp.offsetWidth; // reset animasi jika dikirim berkali-kali
  stamp.classList.add("show");

  setTimeout(() => {
    form.reset();
    fieldNames.forEach(clearFieldState);
  }, 1600);
});


// =========================================================
// LOKET TANYA — chatbot dua lapis
//
// Lapis 1 (offline): kata kunci + toleransi salah ketik. Tahu persis
//   isi halaman ini — daftar ekskul, jadwal, dan kondisi formulir —
//   dan bisa ikut mengisikan kolom. Selalu jalan, tanpa internet.
// Lapis 2 (AI): kalau kunci API diisi lewat tombol gerigi di kepala
//   panel, semua pertanyaan di luar urusan formulir dikirim ke model
//   bahasa, jadi topik apa pun bisa dijawab. Bila gagal atau kunci
//   kosong, otomatis kembali ke lapis 1.
// =========================================================

const chatPanel   = document.getElementById("chatPanel");
const chatToggle  = document.getElementById("chatToggle");
const chatClose   = document.getElementById("chatClose");
const chatLog     = document.getElementById("chatLog");
const chatChips   = document.getElementById("chatChips");
const chatForm    = document.getElementById("chatForm");
const chatInput   = document.getElementById("chatInput");
const chatStatus  = document.getElementById("chatStatus");
const chatSetupBtn   = document.getElementById("chatSetupBtn");
const chatSetup      = document.getElementById("chatSetup");
const setupProvider  = document.getElementById("setupProvider");
const setupKey       = document.getElementById("setupKey");
const setupModel     = document.getElementById("setupModel");
const setupSave      = document.getElementById("setupSave");
const setupClear     = document.getElementById("setupClear");

const LABEL = {
  nama: "Nama Lengkap",
  email: "Email",
  password: "Password",
  konfirmasi: "Konfirmasi Password",
  ekskul: "Pilihan Ekstrakurikuler"
};

// 1. NORMALISASI TEKS
// ---------------------------------------------------------
const SLANG = {
  gmn:"gimana", gmna:"gimana", bgmn:"bagaimana", gimna:"gimana",
  ga:"tidak", gak:"tidak", nggak:"tidak", ngga:"tidak", enggak:"tidak", engga:"tidak", tdk:"tidak",
  yg:"yang", sy:"saya", gw:"saya", gue:"saya", ane:"saya", km:"kamu", lu:"kamu", lo:"kamu",
  kpn:"kapan", brp:"berapa", bs:"bisa", bsa:"bisa", klo:"kalau", kalo:"kalau",
  dmn:"dimana", hrs:"harus", jd:"jadi", utk:"untuk", buat:"untuk", dgn:"dengan",
  sm:"sama", blm:"belum", udh:"sudah", udah:"sudah", sdh:"sudah",
  mksh:"terima kasih", makasi:"terima kasih", thx:"terima kasih", tq:"terima kasih",
  ekskull:"ekskul", ekstra:"ekskul", ekstrakulikuler:"ekstrakurikuler",
  pw:"password", pass:"password", sandi:"password",
  dftr:"daftar", regis:"daftar", register:"daftar", signup:"daftar",
  bgt:"banget", knp:"kenapa", napa:"kenapa", emg:"memang", emang:"memang",
  apaan:"apa", apasih:"apa", aja:"saja", doang:"saja",
  jadwl:"jadwal", jdwl:"jadwal", jadual:"jadwal", tmpt:"tempat", tmpat:"tempat"
};

function normalkan(teks){
  const bersih = teks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+\-*/().,:%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return bersih
    .split(" ")
    .map((kata) => kata.replace(/^[.,:]+|[.,:]+$/g, ""))
    .map((kata) => SLANG[kata] || kata)
    .join(" ");
}

// Jarak Levenshtein dipakai supaya "jadwl" atau "pramka" tetap terbaca.
function jarak(a, b){
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  let baris = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++){
    let prev = baris[0];
    baris[0] = i;
    for (let j = 1; j <= n; j++){
      const simpan = baris[j];
      baris[j] = Math.min(
        baris[j] + 1,
        baris[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = simpan;
    }
  }
  return baris[n];
}

function miripSalahKetik(kata, target){
  if (target.length < 5 || Math.abs(kata.length - target.length) > 2) return false;
  return jarak(kata, target) <= (target.length >= 8 ? 2 : 1);
}

// ---------------------------------------------------------
// 2. PENGETAHUAN TIAP EKSKUL
// ---------------------------------------------------------
const EKSKUL = [
  {
    nama: "Volly", nilai: "basket",
    alias: ["volly", "voli", "bola voli", "volley", "voly"],
    minat: ["olahraga", "fisik", "bola", "tim", "keringat", "lompat"],
    deskripsi: "Latihan servis, passing, smash, dan main setengah lapangan tiap pertemuan.",
    jadwal: "Selasa & Kamis, 15.00–17.00", tempat: "lapangan belakang",
    bawa: "sepatu olahraga, kaus latihan, dan botol minum"
  },
  {
    nama: "Bahasa Jepang", nilai: "futsal",
    alias: ["jepang", "bahasa jepang", "nihongo", "jepun", "anime", "hiragana", "katakana"],
    minat: ["bahasa", "budaya", "anime", "manga", "menulis", "ngobrol"],
    deskripsi: "Mulai dari hiragana dan katakana, lalu percakapan harian dan budaya pop Jepang.",
    jadwal: "Rabu, 15.00–16.30", tempat: "ruang bahasa",
    bawa: "buku tulis bergaris dan pensil"
  },
  {
    nama: "Paduan Suara", nilai: "paduan-suara",
    alias: ["paduan suara", "paduan", "koor", "choir", "nyanyi", "vokal", "menyanyi"],
    minat: ["musik", "seni", "nyanyi", "suara", "tampil", "panggung"],
    deskripsi: "Latihan pernapasan, pembagian suara sopran sampai bas, dan lagu untuk upacara serta lomba.",
    jadwal: "Senin & Jumat, 15.00–16.30", tempat: "ruang musik",
    bawa: "botol minum, tanpa perlengkapan khusus"
  },
  {
    nama: "Pramuka", nilai: "pramuka",
    alias: ["pramuka", "penggalang", "scout", "kepramukaan"],
    minat: ["alam", "kemah", "organisasi", "petualangan", "kepemimpinan", "outdoor", "tali"],
    deskripsi: "Tali-temali, sandi, pionering, pertolongan pertama, dan berkemah tiap akhir semester.",
    jadwal: "Jumat, 14.00–16.30", tempat: "lapangan upacara",
    bawa: "seragam pramuka lengkap dan tongkat regu"
  },
  {
    nama: "PMR", nilai: "pmr",
    alias: ["pmr", "palang merah", "p3k", "kesehatan", "medis", "pertolongan pertama"],
    minat: ["kesehatan", "menolong", "medis", "perawat", "dokter", "sosial"],
    deskripsi: "Pertolongan pertama, pembalutan, perawatan keluarga, dan jaga pos kesehatan saat acara sekolah.",
    jadwal: "Kamis, 15.00–16.30", tempat: "ruang UKS",
    bawa: "buku catatan; alat peraga disediakan sekolah"
  },
  {
    nama: "MTQ", nilai: "english-club",
    alias: ["mtq", "tilawah", "qiraah", "mengaji", "ngaji", "tartil", "quran"],
    minat: ["agama", "quran", "tilawah", "lomba", "suara"],
    deskripsi: "Pembinaan tilawah, tajwid, dan makhraj, dengan persiapan lomba tingkat kecamatan.",
    jadwal: "Rabu, 15.00–16.30", tempat: "musala sekolah",
    bawa: "mushaf pribadi"
  },
  {
    nama: "Rohis", nilai: "robotika",
    alias: ["rohis", "rohani islam", "kajian", "keagamaan"],
    minat: ["agama", "kajian", "sosial", "organisasi", "bakti"],
    deskripsi: "Kajian rutin, kegiatan bakti sosial, dan kepanitiaan hari besar Islam di sekolah.",
    jadwal: "Jumat, 13.00–14.30", tempat: "musala sekolah",
    bawa: "buku catatan"
  },
  {
    nama: "Seni Tari", nilai: "seni-tari",
    alias: ["tari", "seni tari", "menari", "dance", "tarian"],
    minat: ["seni", "tari", "gerak", "budaya", "tampil", "panggung", "musik"],
    deskripsi: "Tari tradisional Jawa sebagai dasar, lalu garapan kreasi untuk pentas seni.",
    jadwal: "Selasa, 15.00–17.00", tempat: "aula sekolah",
    bawa: "kaus kaki, selendang latihan, dan pakaian yang nyaman"
  },
  {
    nama: "Jurnalis", nilai: "jurnalis",
    alias: ["jurnalis", "jurnalistik", "mading", "majalah dinding", "wartawan", "menulis berita", "pers"],
    minat: ["menulis", "membaca", "berita", "foto", "wawancara", "desain", "media"],
    deskripsi: "Menulis berita sekolah, wawancara narasumber, memotret kegiatan, dan menyusun mading tiap bulan.",
    jadwal: "Senin, 15.00\u201316.30", tempat: "ruang OSIS",
    bawa: "buku catatan kecil dan ponsel berkamera bila ada"
  }
];

function cariEkskul(teks){
  let ketemu = null, skor = 0;
  EKSKUL.forEach((e) => {
    e.alias.forEach((a) => {
      if (teks.includes(a) && a.length > skor){ skor = a.length; ketemu = e; }
    });
  });
  if (ketemu) return ketemu;

  // Toleransi salah ketik pada kata tunggal, misal "pramka" atau "padun suara".
  const kata = teks.split(" ");
  EKSKUL.forEach((e) => {
    e.alias.forEach((a) => {
      if (a.includes(" ")) return;
      kata.forEach((k) => { if (miripSalahKetik(k, a)) ketemu = e; });
    });
  });
  return ketemu;
}

function jawabEkskul(e, teks){
  if (/jadwal|kapan|hari|jam|waktu/.test(teks))
    return `${e.nama} latihan ${e.jadwal} di ${e.tempat}.`;
  if (/bawa|perlengkapan|alat|seragam|peralatan|baju/.test(teks))
    return `Untuk ${e.nama}, bawa ${e.bawa}.`;
  if (/dimana|tempat|ruang|lokasi/.test(teks))
    return `${e.nama} berlatih di ${e.tempat}, ${e.jadwal}.`;
  return `<strong>${e.nama}</strong><p>${e.deskripsi}</p><ul><li>Latihan: ${e.jadwal}</li><li>Tempat: ${e.tempat}</li><li>Bawa: ${e.bawa}</li></ul>`;
}

// ---------------------------------------------------------
// 3. AKSI: bot ikut mengisi dan memeriksa formulir
// ---------------------------------------------------------
function isiKolom(name, nilai){
  const { input } = getFieldEls(name);
  input.value = nilai;
  validateField(name);
  if (name === "password"){
    const { input: konf } = getFieldEls("konfirmasi");
    if (konf.value) validateField("konfirmasi");
  }
}

function periksaFormulir(){
  const kosong = [], salah = [];
  fieldNames.forEach((name) => {
    const nilai = getFieldEls(name).input.value;
    if (!nilai || !String(nilai).trim()) kosong.push(LABEL[name]);
    else {
      const pesan = validators[name](nilai);
      if (pesan) salah.push(`${LABEL[name]} — ${pesan}`);
    }
  });

  if (!kosong.length && !salah.length)
    return "Semua kolom sudah benar. Tinggal tekan <strong>Daftar Sekarang</strong>.";

  let html = "Hasil pemeriksaan formulirmu:";
  if (salah.length)  html += "<ul><li>" + salah.join("</li><li>") + "</li></ul>";
  if (kosong.length) html += `<p>Belum diisi: ${kosong.join(", ")}.</p>`;
  return html;
}

// Ditangani sebelum pencocokan topik, karena polanya spesifik.
function cobaAksi(asli, teks){
  // "namaku Budi" / "nama saya Budi Santoso"
  const nama = asli.match(/nama\s*(?:ku|saya|nya)?\s*(?:adalah|itu|:)?\s+([a-zA-Z.' ]{3,50})$/i);
  if (nama && /nama/.test(teks)){
    const isi = nama[1].trim().replace(/\s+/g, " ");
    isiKolom("nama", isi);
    return `Sudah kutulis <strong>${isi}</strong> di kolom Nama Lengkap. Cek dulu ejaannya, ya.`;
  }

  // "emailku budi@gmail.com"
  const email = asli.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email && /email|surel|gmail/.test(teks)){
    isiKolom("email", email[0]);
    return `Email <strong>${email[0]}</strong> sudah masuk ke formulir.`;
  }

  // "pilihkan pramuka" / "aku mau ikut seni tari"
  if (/pilih|ikut|masuk|ambil|daftarkan|gabung/.test(teks)){
    const e = cariEkskul(teks);
    if (e){
      isiKolom("ekskul", e.nilai);
      return `Pilihanmu kuubah ke <strong>${e.nama}</strong>. Latihannya ${e.jadwal} di ${e.tempat}.`;
    }
  }

  if (/kosongkan|reset|ulang dari awal|hapus semua|bersihkan/.test(teks)){
    form.reset();
    fieldNames.forEach(clearFieldState);
    return "Formulir sudah kukosongkan. Silakan isi ulang dari kolom nama.";
  }

  if (/(nomor|no) seri|serial/.test(teks)){
    if (/acak|ganti|baru|ulang/.test(teks)){
      serialEl.textContent = "EK-" + String(Math.floor(Math.random() * 9000) + 1000);
      return `Nomor seri diganti jadi ${serialEl.textContent}.`;
    }
    return `Nomor seri tiketmu ${serialEl.textContent}. Muncul otomatis, tidak perlu diisi sendiri.`;
  }

  if (/periksa|cek|koreksi|salah apa|merah|belum bisa daftar|tidak bisa daftar|gagal daftar|error|eror|invalid/.test(teks))
    return periksaFormulir();

  return null;
}

// ---------------------------------------------------------
// 4. REKOMENDASI, HITUNGAN, WAKTU
// ---------------------------------------------------------
function rekomendasi(teks){
  const kata = teks.split(" ").filter((k) => k.length >= 4);
  const skor = EKSKUL.map((e) => ({
    e,
    // Cocok bila kata minat disebut utuh, atau sebagai potongan kata
    // ("nulis" untuk "menulis", "olah raga" untuk "olahraga").
    n: e.minat.filter((m) => teks.includes(m) || kata.some((k) => m.includes(k))).length
  })).sort((a, b) => b.n - a.n);

  if (skor[0].n === 0)
    return "Boleh cerita dulu kamu lebih suka apa: olahraga, seni, bahasa, kegiatan keagamaan, organisasi di alam terbuka, atau kesehatan? Nanti kucarikan yang paling cocok.";

  const pilih = skor.filter((s) => s.n === skor[0].n).slice(0, 2);
  const nama = pilih.map((s) => `<strong>${s.e.nama}</strong>`).join(" atau ");
  return `Dari yang kamu sebut, ${nama} kelihatan paling cocok.<p>${pilih[0].e.deskripsi} Latihannya ${pilih[0].e.jadwal}.</p><p>Bilang saja "pilihkan ${pilih[0].e.nama.toLowerCase()}" kalau mau langsung kuisikan.</p>`;
}

function hitung(teks){
  if (!/[0-9]/.test(teks)) return null;
  const ekspresi = teks
    .replace(/tambah|plus/g, "+").replace(/kurang|minus/g, "-")
    .replace(/kali|dikali/g, "*").replace(/bagi|dibagi/g, "/")
    .replace(/berapa|hasil|hitung|\?|=/g, "")
    .replace(/,/g, ".").trim();

  if (!/^[\d\s+\-*/().]+$/.test(ekspresi)) return null;
  if (!/[+\-*/]/.test(ekspresi)) return null;

  try {
    const hasil = Function(`"use strict"; return (${ekspresi});`)();
    if (typeof hasil !== "number" || !isFinite(hasil)) return null;
    return `${ekspresi} = <strong>${Math.round(hasil * 1e6) / 1e6}</strong>`;
  } catch { return null; }
}

function waktuSekarang(teks){
  const now = new Date();
  if (/jam berapa|pukul berapa|waktu sekarang/.test(teks))
    return `Sekarang pukul ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.`;
  if (/tanggal berapa|hari apa|hari ini/.test(teks))
    return `Hari ini ${now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`;
  return null;
}

// ---------------------------------------------------------
// 5. DAFTAR TOPIK
// ---------------------------------------------------------
function daftarEkskul(){
  return EKSKUL.map((e) => e.nama);
}

const TOPIK = [
  { id:"salam", kunci:["halo","hai","hei","assalamualaikum","selamat pagi","selamat siang","selamat sore","selamat malam","permisi"],
    jawab:"Halo! Aku Kak Tiket, penjaga loket pendaftaran ekskul. Tanya apa saja soal kegiatan, jadwal, atau isi formulirnya.",
    lanjut:["Ekskul apa saja?","Cara daftar","Rekomendasikan untukku"] },

  { id:"identitas", kunci:["siapa kamu","kamu siapa","nama kamu","kamu bot","kamu robot","kamu manusia","kamu ai","kenalan"],
    jawab:"Aku Kak Tiket, program kecil di halaman ini. Bukan manusia, jadi jawabanku terbatas pada urusan pendaftaran ekskul, plus sedikit obrolan ringan.",
    lanjut:["Kamu bisa apa saja?"] },

  { id:"kemampuan", kunci:["bisa apa","kamu bisa","bantu apa","fitur","perintah","menu","bantuan","help"],
    jawab:"Yang bisa kulakukan:<ul><li>Menjelaskan tiap ekskul: isi latihan, jadwal, tempat, perlengkapan</li><li>Merekomendasikan kegiatan sesuai minatmu</li><li>Memeriksa formulir dan menyebut kolom yang bermasalah</li><li>Mengisikan nama, email, atau pilihan ekskul atas perintahmu</li><li>Menjawab soal biaya, syarat, batas waktu, dan jadwal umum</li></ul><p>Coba bilang \"namaku Budi\" atau \"pilihkan pramuka\".</p><p>Kalau kunci AI sudah diisi lewat tombol gerigi di atas, aku juga bisa menjawab topik di luar sekolah.</p>",
    lanjut:["Periksa formulirku","Rekomendasikan untukku"] },

  { id:"apa-kabar", kunci:["apa kabar","gimana kabar","sehat","kabarmu"],
    jawab:"Loket selalu siap, tidak pernah capek. Kamu sendiri sudah sampai kolom mana?",
    lanjut:["Periksa formulirku"] },

  { id:"cara-daftar", kunci:["cara daftar","gimana daftar","bagaimana daftar","langkah","prosedur","cara mendaftar","mau daftar","ingin daftar"],
    jawab:"Urutannya: isi nama lengkap, email aktif, password minimal 8 karakter, ulangi password yang sama, lalu pilih satu ekskul. Kalau semua kolom hijau, tekan <strong>Daftar Sekarang</strong> dan stempel Terdaftar muncul.",
    lanjut:["Ekskul apa saja?","Periksa formulirku"] },

  { id:"daftar-kegiatan", kunci:["ekskul apa saja","pilihan ekskul","daftar ekskul","kegiatan apa","ada apa saja","list ekskul","semua ekskul","apa saja ekskul"],
    jawab:() => `Ada ${EKSKUL.length} kegiatan yang dibuka tahun ini:` + "<ul><li>" + daftarEkskul().join("</li><li>") + "</li></ul><p>Sebut salah satu namanya kalau mau tahu detailnya.</p>",
    lanjut:["Rekomendasikan untukku","Jadwal semua ekskul"] },

  { id:"jadwal-umum", kunci:["jadwal","latihan kapan","hari apa latihan","jam berapa latihan","jadwal semua"],
    jawab:() => "Semua latihan setelah jam pelajaran:<ul><li>" +
      EKSKUL.map((e) => `${e.nama} — ${e.jadwal}`).join("</li><li>") + "</li></ul>",
    lanjut:["Ekskul apa saja?"] },

  { id:"satu-pilihan", kunci:["dua ekskul","lebih dari satu","boleh dua","ikut 2 ekskul","ikut dua ekskul","2 ekskul","ganti pilihan","pindah ekskul","ganti ekskul","dobel"],
    jawab:"Satu siswa satu kegiatan. Kalau mau berpindah, cukup pilih ulang di kolom Pilihan Ekstrakurikuler sebelum menekan tombol daftar, atau bilang \"pilihkan seni tari\" dan aku yang mengubahnya.",
    lanjut:["Rekomendasikan untukku"] },

  { id:"password", kunci:["password","kata sandi","konfirmasi password","password lemah","password kuat"],
    jawab:"Password minimal 8 karakter dan kolom konfirmasi harus persis sama, termasuk huruf besar-kecilnya. Kalau konfirmasi memerah, biasanya ada spasi tak sengaja di ujung.",
    lanjut:["Periksa formulirku"] },

  { id:"lupa-password", kunci:["lupa password","reset password","ganti password","kehilangan akun"],
    jawab:"Di formulir ini belum ada pemulihan password, jadi catat dulu passwordmu di tempat aman sebelum mengirim.",
    lanjut:[] },

  { id:"email", kunci:["email","gmail","surel","alamat email","email salah"],
    jawab:"Pakai email yang benar-benar kamu buka, formatnya nama@domain.com. Pengumuman kelompok latihan dikirim ke sana.",
    lanjut:["Periksa formulirku"] },

  { id:"biaya", kunci:["biaya","bayar","gratis","uang","iuran","berapa harga","mahal"],
    jawab:"Pendaftaran tidak dipungut biaya. Yang ditanggung sendiri hanya perlengkapan pribadi, misalnya sepatu olahraga atau seragam pramuka.",
    lanjut:["Perlengkapan apa yang dibawa?"] },

  { id:"syarat", kunci:["syarat","ketentuan","kelas berapa","boleh ikut","siapa saja boleh","persyaratan"],
    jawab:"Terbuka untuk kelas 7 sampai 9 tahun ajaran 2026/2027. Cukup punya email aktif dan izin orang tua untuk kegiatan di luar jam sekolah.",
    lanjut:["Cara daftar"] },

  { id:"batas-waktu", kunci:["kapan ditutup","batas","deadline","tutup","terakhir","sampai kapan"],
    jawab:"Formulir dibuka sampai akhir bulan ini. Pembagian kelompok latihan diumumkan pekan berikutnya lewat email.",
    lanjut:["Cara daftar"] },

  { id:"setelah-daftar", kunci:["setelah daftar","sesudah daftar","lalu apa","selanjutnya","pengumuman","diterima"],
    jawab:"Setelah stempel Terdaftar muncul, tunggu email berisi hari dan tempat latihan pertama. Datang 10 menit lebih awal di pertemuan perdana.",
    lanjut:["Jadwal semua ekskul"] },

  { id:"absen", kunci:["absen","izin","tidak hadir","bolos","sakit"],
    jawab:"Kalau berhalangan, izin ke pembina ekskul sehari sebelumnya. Tiga kali absen tanpa kabar membuat keanggotaan ditinjau ulang.",
    lanjut:["Hubungi pembina"] },

  { id:"keluar", kunci:["keluar","mundur","berhenti","resign","batal ikut","cabut"],
    jawab:"Mundur dari kegiatan bisa dilakukan sampai dua pekan pertama, cukup lapor ke pembina. Setelah itu sebaiknya diselesaikan sampai akhir semester.",
    lanjut:["Hubungi pembina"] },

  { id:"perlengkapan", kunci:["perlengkapan","bawa apa","peralatan","alat","seragam"],
    jawab:() => "Bawaan tiap kegiatan:<ul><li>" +
      EKSKUL.map((e) => `${e.nama} — ${e.bawa}`).join("</li><li>") + "</li></ul>",
    lanjut:["Ekskul apa saja?"] },

  { id:"lomba", kunci:["lomba","kompetisi","prestasi","turnamen","pentas","juara"],
    jawab:"Hampir semua kegiatan punya jalur lomba: Volly ke turnamen antarsekolah, MTQ dan Paduan Suara ke tingkat kecamatan, Seni Tari tampil di pentas seni, Pramuka ikut jambore. Anggota baru biasanya mulai dari tim cadangan dulu.",
    lanjut:["Rekomendasikan untukku"] },

  { id:"privasi", kunci:["data","aman","privasi","disimpan","bocor","server"],
    jawab:"Halaman ini berjalan di browser saja, jadi datamu tidak dikirim ke mana pun dan hilang saat halaman ditutup. Pada versi sekolah nanti, data hanya dibaca pembina.",
    lanjut:[] },

  { id:"kontak", kunci:["kontak","hubungi","panitia","guru","pembina","tanya orang","narahubung"],
    jawab:"Untuk bantuan langsung, temui pembina ekskul di ruang OSIS saat istirahat kedua, atau titip pesan lewat ketua kelas.",
    lanjut:[] },

  { id:"teknis", kunci:["halaman error","tidak muncul","stempel","tombol tidak jalan","macet","blank"],
    jawab:"Kalau tampilan tersendat, muat ulang halaman lalu isi lagi. Stempel Terdaftar hanya muncul setelah kelima kolom valid.",
    lanjut:["Periksa formulirku"] },

  { id:"candaan", kunci:["lucu","bercanda","garing","hibur","joke","lelucon"],
    jawab:"Kata panitia, tiket ini kedap air. Buktinya tiap kali ada yang menangis karena salah ketik password, kertasnya tetap kering.",
    lanjut:["Cara daftar"] },

  { id:"terima-kasih", kunci:["terima kasih","makasih","thanks","mantap","oke","sip","baik"],
    jawab:"Sama-sama. Kalau ada yang kurang jelas, loket ini tetap buka.",
    lanjut:[] },

  { id:"pamit", kunci:["dadah","bye","sampai jumpa","pamit","selesai","cukup"],
    jawab:"Sampai jumpa di latihan pertama. Jangan lupa tekan tombol daftar sebelum menutup halaman.",
    lanjut:[] }
];

// ---------------------------------------------------------
// 6. PENCOCOKAN
// ---------------------------------------------------------
function skorTopik(topik, teks, kata){
  let skor = 0;
  topik.kunci.forEach((kunci) => {
    if (kunci.includes(" ")){
      if (teks.includes(kunci)) skor += kunci.length * 2;
    } else {
      if (kata.includes(kunci)) skor += kunci.length + 2;
      else if (kata.some((k) => miripSalahKetik(k, kunci))) skor += kunci.length;
    }
  });
  return skor;
}

let topikTerakhir = null;

function cariJawaban(asli){
  const teks = normalkan(asli);
  const kata = teks.split(" ").filter(Boolean);

  if (!teks) return { html: "Tulis dulu pertanyaannya, ya." };

  // a. aksi formulir
  const aksi = cobaAksi(asli, teks);
  if (aksi) return { html: aksi, lanjut: ["Periksa formulirku","Cara daftar"] };

  // b. rekomendasi
  if (/rekomendasi|saran|cocok|bingung|pilih apa|yang mana|bagus apa|sebaiknya/.test(teks))
    return { html: rekomendasi(teks), lanjut: ["Ekskul apa saja?","Jadwal semua ekskul"] };

  // c. pertanyaan tentang satu ekskul tertentu
  const e = cariEkskul(teks);
  if (e){
    topikTerakhir = { jenis: "ekskul", data: e };
    return { html: jawabEkskul(e, teks), lanjut: [`Pilihkan ${e.nama}`, "Ekskul apa saja?"] };
  }

  // d. penyebutan minat tanpa kata "rekomendasi", misal "aku suka nyanyi"
  if (/suka|hobi|minat|senang|tertarik|pengen|ingin ikut/.test(teks)){
    const saran = rekomendasi(teks);
    if (!saran.startsWith("Boleh cerita"))
      return { html: saran, lanjut: ["Ekskul apa saja?", "Jadwal semua ekskul"] };
  }

  // e. waktu & hitungan
  const waktu = waktuSekarang(teks);
  if (waktu) return { html: waktu };
  const angka = hitung(teks);
  if (angka) return { html: angka };

  // f. lanjutan pendek: "jadwalnya?", "bawa apa?" — merujuk ekskul yang baru dibahas
  if (topikTerakhir?.jenis === "ekskul" && kata.length <= 3 &&
      /jadwal|kapan|dimana|tempat|bawa|alat|jam|hari/.test(teks)){
    return { html: jawabEkskul(topikTerakhir.data, teks) };
  }

  // g. topik umum
  const peringkat = TOPIK
    .map((t) => ({ t, s: skorTopik(t, teks, kata) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (peringkat.length){
    const t = peringkat[0].t;
    topikTerakhir = { jenis: "topik", data: t };
    return {
      html: typeof t.jawab === "function" ? t.jawab() : t.jawab,
      lanjut: t.lanjut
    };
  }

  // h. belum paham — tawarkan topik terdekat
  return {
    html: "Itu di luar yang kupelajari. Aku paling paham soal kegiatan ekskul, jadwal, syarat, dan isi formulir di halaman ini.",
    lanjut: ["Kamu bisa apa saja?","Ekskul apa saja?","Rekomendasikan untukku"]
  };
}


// ---------------------------------------------------------
// 7. LAPIS AI — supaya pertanyaan apa pun bisa dijawab
// ---------------------------------------------------------
const SIMPANAN = "loket-tanya-ai";

const MODEL_BAWAAN = {
  gemini: "gemini-2.0-flash",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  groq: "llama-3.3-70b-versatile"
};

function bacaKonfig(){
  try { return JSON.parse(localStorage.getItem(SIMPANAN) || "null"); }
  catch { return null; }
}

function simpanKonfig(konfig){
  try { localStorage.setItem(SIMPANAN, JSON.stringify(konfig)); } catch {}
}

function hapusKonfig(){
  try { localStorage.removeItem(SIMPANAN); } catch {}
}

function aiSiap(){
  const k = bacaKonfig();
  return Boolean(k && k.key);
}

// Konteks halaman ini diberikan ke model supaya jawabannya tetap nyambung
// dengan formulir, bukan jawaban umum yang melantur.
function instruksiSistem(){
  const daftar = EKSKUL
    .map((e) => `- ${e.nama}: ${e.deskripsi} Latihan ${e.jadwal} di ${e.tempat}. Bawa ${e.bawa}.`)
    .join("\n");

  return `Kamu "Kak Tiket", penjaga loket pada halaman pendaftaran ekstrakurikuler sebuah SMP.
Jawab dalam Bahasa Indonesia yang santai, sopan, dan ringkas (maksimal sekitar 120 kata).
Kamu boleh menjawab pertanyaan apa pun: pelajaran sekolah, pengetahuan umum, saran, atau obrolan ringan.
Kalau pertanyaannya soal halaman ini, pakai data berikut dan jangan mengarang:

Tahun ajaran 2026/2027, pendaftaran gratis, terbuka untuk kelas 7-9, satu siswa memilih satu kegiatan.
Formulir meminta nama lengkap (min. 3 huruf), email aktif, password min. 8 karakter, konfirmasi password, dan satu pilihan ekskul.
Pendaftaran ditutup akhir bulan ini; pengumuman kelompok latihan dikirim lewat email.
Kegiatan yang dibuka:
${daftar}

Kalau ditanya hal pribadi tentang pengguna yang tidak kamu ketahui, katakan terus terang.
Jangan memakai tabel. Boleh memakai daftar bertanda hubung bila memang perlu.`;
}

// Riwayat singkat dikirim ulang tiap permintaan supaya nyambung antarpesan.
const riwayat = [];

async function tanyaAI(pertanyaan){
  const konfig = bacaKonfig();
  const model = konfig.model || MODEL_BAWAAN[konfig.provider] || MODEL_BAWAAN.gemini;
  const potongan = riwayat.slice(-8);

  let url, opsi;

  if (konfig.provider === "gemini"){
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(konfig.key)}`;
    opsi = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: instruksiSistem() }] },
        contents: [
          ...potongan.map((m) => ({
            role: m.role === "bot" ? "model" : "user",
            parts: [{ text: m.teks }]
          })),
          { role: "user", parts: [{ text: pertanyaan }] }
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      })
    };
  } else {
    // OpenRouter dan Groq sama-sama memakai format OpenAI.
    url = konfig.provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
    opsi = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${konfig.key}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          { role: "system", content: instruksiSistem() },
          ...potongan.map((m) => ({
            role: m.role === "bot" ? "assistant" : "user",
            content: m.teks
          })),
          { role: "user", content: pertanyaan }
        ]
      })
    };
  }

  const res = await fetch(url, opsi);
  const data = await res.json().catch(() => ({}));

  if (!res.ok){
    const pesan = data?.error?.message || `kode ${res.status}`;
    throw new Error(pesan);
  }

  const teks = konfig.provider === "gemini"
    ? data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") 
    : data?.choices?.[0]?.message?.content;

  if (!teks) throw new Error("jawaban kosong dari model");
  return teks.trim();
}

// Markdown sederhana dari model diubah jadi HTML yang aman.
function keHTML(teks){
  const aman = teks
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const baris = aman.split("\n");
  let html = "", dalamList = false;

  baris.forEach((b) => {
    const t = b.trim();
    if (/^[-*]\s+/.test(t)){
      if (!dalamList){ html += "<ul>"; dalamList = true; }
      html += `<li>${t.replace(/^[-*]\s+/, "")}</li>`;
    } else {
      if (dalamList){ html += "</ul>"; dalamList = false; }
      if (t) html += `<p>${t}</p>`;
    }
  });
  if (dalamList) html += "</ul>";

  return html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function perbaruiStatus(){
  const konfig = bacaKonfig();
  if (!chatStatus) return;
  chatStatus.textContent = aiSiap()
    ? `Mode AI aktif (${konfig.provider})`
    : "Mode offline — isi kunci AI di gerigi";
}

// ---------------------------------------------------------
// 8. ALUR JAWABAN
// ---------------------------------------------------------
// Urutannya: aksi formulir dulu (harus akurat dan instan), lalu AI bila
// tersedia, dan kalau tidak, mesin kata kunci.
async function susunJawaban(asli){
  const teks = normalkan(asli);
  if (!teks) return { html: "Tulis dulu pertanyaannya, ya." };

  const aksi = cobaAksi(asli, teks);
  if (aksi) return { html: aksi, lanjut: ["Periksa formulirku", "Cara daftar"] };

  if (aiSiap()){
    try {
      const jawaban = await tanyaAI(asli);
      riwayat.push({ role: "user", teks: asli }, { role: "bot", teks: jawaban });
      return { html: keHTML(jawaban), lanjut: [] };
    } catch (err){
      const cadangan = cariJawaban(asli);
      return {
        html: cadangan.html + `<p class="bubble__note">Model AI tidak bisa dihubungi (${err.message}), jadi ini jawaban mode offline.</p>`,
        lanjut: cadangan.lanjut
      };
    }
  }

  return cariJawaban(asli);
}

// ---------------------------------------------------------
// 9. TAMPILAN PERCAKAPAN
// ---------------------------------------------------------
const SARAN_AWAL = ["Cara daftar", "Ekskul apa saja?", "Rekomendasikan untukku", "Periksa formulirku"];

function tampilkanChip(daftar){
  chatChips.innerHTML = "";
  (daftar && daftar.length ? daftar : SARAN_AWAL).slice(0, 4).forEach((teks) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = teks;
    chip.addEventListener("click", () => kirim(teks));
    chatChips.appendChild(chip);
  });
}

function tambahBubble(html, dari){
  const el = document.createElement("div");
  el.className = `bubble bubble--${dari}`;
  el.innerHTML = html;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

async function balas(teks){
  const titik = tambahBubble("<i></i><i></i><i></i>", "bot");
  titik.classList.add("bubble--typing");

  let hasil;
  try {
    hasil = await susunJawaban(teks);
  } catch (err){
    hasil = { html: "Ada yang tersendat di sini. Coba tanyakan sekali lagi." };
  }

  titik.remove();
  tambahBubble(hasil.html, "bot");
  tampilkanChip(hasil.lanjut);
}

function kirim(teks){
  const isi = String(teks).trim();
  if (!isi) return;
  tambahBubble(isi.replace(/&/g, "&amp;").replace(/</g, "&lt;"), "user");
  chatInput.value = "";
  balas(isi);
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  kirim(chatInput.value);
});

// ---------------------------------------------------------
// 10. PENGATURAN KUNCI AI
// ---------------------------------------------------------
function muatKonfigKeForm(){
  const konfig = bacaKonfig();
  if (!konfig) return;
  setupProvider.value = konfig.provider || "gemini";
  setupKey.value = konfig.key || "";
  setupModel.value = konfig.model || "";
}

if (chatSetupBtn){
  chatSetupBtn.addEventListener("click", () => {
    const tampil = chatSetup.hidden;
    chatSetup.hidden = !tampil;
    chatSetupBtn.setAttribute("aria-expanded", String(tampil));
    if (tampil) setupKey.focus();
  });

  setupProvider.addEventListener("change", () => {
    setupModel.placeholder = MODEL_BAWAAN[setupProvider.value];
  });

  setupSave.addEventListener("click", () => {
    const key = setupKey.value.trim();
    if (!key){
      tambahBubble("Kunci API masih kosong, jadi aku tetap di mode offline.", "bot");
      return;
    }
    simpanKonfig({
      provider: setupProvider.value,
      key,
      model: setupModel.value.trim()
    });
    perbaruiStatus();
    chatSetup.hidden = true;
    chatSetupBtn.setAttribute("aria-expanded", "false");
    tambahBubble("Mode AI menyala. Sekarang tanyakan apa saja, bukan cuma soal pendaftaran.", "bot");
    tampilkanChip(["Jelaskan fotosintesis", "Buatkan pantun ekskul", "Tips wawancara OSIS"]);
  });

  setupClear.addEventListener("click", () => {
    hapusKonfig();
    setupKey.value = "";
    riwayat.length = 0;
    perbaruiStatus();
    tambahBubble("Kunci dihapus. Aku kembali ke mode offline dan tetap bisa menjawab soal pendaftaran.", "bot");
    tampilkanChip(SARAN_AWAL);
  });
}

// ---------------------------------------------------------
// 11. BUKA / TUTUP PANEL
// ---------------------------------------------------------
function bukaChat(){
  chatPanel.hidden = false;
  chatToggle.setAttribute("aria-expanded", "true");
  if (chatLog.children.length === 0){
    const sapaan = aiSiap()
      ? "Selamat datang di loket. Mode AI aktif, jadi tanya apa saja — soal ekskul, pelajaran, atau hal lain."
      : "Selamat datang di loket. Aku siap menjawab soal ekskul dan formulir ini. Kalau mau aku bisa menjawab topik apa pun, isi kunci AI lewat tombol gerigi di atas.";
    tambahBubble(sapaan, "bot");
    tampilkanChip(SARAN_AWAL);
  }
  chatInput.focus();
}

function tutupChat(){
  chatPanel.hidden = true;
  chatToggle.setAttribute("aria-expanded", "false");
  chatToggle.focus();
}

chatToggle.addEventListener("click", bukaChat);
chatClose.addEventListener("click", tutupChat);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !chatPanel.hidden && chatSetup.hidden) tutupChat();
});

muatKonfigKeForm();
perbaruiStatus();

// Ucapan selamat setelah pendaftaran berhasil.
form.addEventListener("submit", () => {
  const semuaValid = fieldNames.every((name) => !validators[name](getFieldEls(name).input.value));
  if (semuaValid && !chatPanel.hidden){
    setTimeout(() => {
      tambahBubble(`Tiketmu sah, nomor seri ${serialEl.textContent}. Simpan nomornya dan tunggu email jadwal latihan pertama.`, "bot");
      tampilkanChip(["Setelah daftar bagaimana?", "Perlengkapan apa yang dibawa?"]);
    }, 700);
  }
});