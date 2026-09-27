# TEST GENERATOR (Netlify Edition)

Aplikasi pembuat butir soal asesmen bahasa Inggris berbasis **CEFR** dan **Barrett Taxonomy** dengan integrasi **Netlify Functions** dan sistem failover multi-kunci (**Gemini Key 1 -> Gemini Key 2 -> Groq Fallback**).

---

## 📁 Struktur Direktori

```text
test-generator-netlify/
├── netlify/
│   └── functions/
│       ├── generate.js       # Pembuat soal (Gemini 1 -> Gemini 2 -> Groq)
│       ├── extract.js        # Ekstraksi gambar OCR (Gemini 1 -> Gemini 2 -> Groq Vision)
│       └── health.js         # Endpoint status & verifikasi API Key
├── public/
│   └── index.html            # Antarmuka web (Aman: Tanpa API Key di frontend)
├── netlify.toml              # Konfigurasi routing API Netlify
├── package.json              # Konfigurasi Node (Native fetch, zero dependencies)
├── .env.example              # Contoh variabel lingkungan
└── README.md
```

---

## 🔑 Variabel Lingkungan (Environment Variables)

Masukkan kunci-kunci berikut di **Netlify Dashboard**:
`Site configuration` -> `Environment variables` -> `Add a variable`

| Nama Variabel | Wajib | Keterangan |
|---|---|---|
| `GEMINI_API_KEY_1` | Ya | API Key Google Gemini Utama |
| `GEMINI_API_KEY_2` | Ya | API Key Google Gemini Cadangan / Rotasi |
| `GROQ_API_KEY` | Ya | API Key Groq untuk failover (Qwen Series) |
| `GEMINI_MODEL` | Tidak | Default: `gemini-2.0-flash` (atau `gemini-1.5-flash`) |
| `GROQ_MODEL` | Tidak | Default: `qwen/qwen3.8-27b` (atau `qwen-2.5-32b`) |
| `GROQ_VISION_MODEL` | Tidak | Default: `qwen/qwen3.8-27b` (Multimodal/OCR) |

---

## 🚀 Cara Deploy ke Netlify

### Cara 1: Lewat GitHub (Paling Direkomendasikan)
1. Inisialisasi git dan upload folder ini ke repositori GitHub Anda:
   ```bash
   git init
   git add .
   git commit -m "Initial commit test generator"
   git branch -M main
   git remote add origin <URL_REPO_GITHUB_ANDA>
   git push -u origin main
   ```
2. Buka [app.netlify.com](https://app.netlify.com/).
3. Klik **"Add new site"** -> **"Import an existing project"** -> Pilih GitHub dan pilih repositori Anda.
4. Netlify akan otomatis membaca file `netlify.toml` (Publish directory: `public`, Functions directory: `netlify/functions`).
5. Sebelum atau sesudah deploy, buka **Site configuration** -> **Environment variables**, lalu tambahkan `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, dan `GROQ_API_KEY`.
6. Klik **Trigger Deploy** jika variabel baru saja ditambahkan.

### Cara 2: Lewat Netlify CLI
1. Pastikan Anda memiliki Node.js terinstal.
2. Jalankan perintah di terminal:
   ```bash
   npx netlify deploy --prod
   ```
3. Ikuti panduan login di terminal dan pilih create/link site.

---

## 💻 Cara Menjalankan di Lokal (Local Development)

1. Buat file `.env` di root folder (bisa copy dari `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Lalu isi nilai API Key Anda di `.env`.
2. Jalankan lokal server Netlify:
   ```bash
   npx netlify dev
   ```
3. Buka browser di `http://localhost:8888`.
