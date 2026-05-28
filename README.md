# INTROVERT — Seedance Video Generator

Halaman web statis untuk generate video lewat **BytePlus / Volcengine ARK (Seedance)** dengan sistem kredit lokal.

> Bagian dari proyek **OTONASHI 「音無し」** — lihat `OTONASHI_EP1_WORKFLOW.md`.

## Fitur

- Sisa kredit ditampilkan di pojok kanan atas, disimpan di `localStorage` (klik **edit** untuk top-up manual).
- Prompt area dengan counter 1500 karakter.
- Pilih **model** (Seedance 1.0 Pro / Lite), **resolusi** (480p/720p/1080p), **durasi** (5/10/15 detik), **aspect ratio**, **seed**, **camera fixed**, **watermark**.
- Tabel harga (kredit/detik) dapat diedit. Default mengikuti tarif Pro: 720p = 15 kr/detik → 15 detik = **225 kredit**.
- Biaya generate dihitung otomatis dan dipotong dari saldo saat sukses.
- Riwayat hasil dengan preview video, tag metadata, dan tombol download.
- **Demo Mode** untuk mengetes alur UI tanpa hit API.

## Menjalankan

Karena ini halaman statis, cukup buka `index.html` di browser. Untuk dev lokal yang
lebih mulus (dialog `<dialog>` & `fetch` dari `file://` kadang bermasalah), jalankan:

```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

## Konfigurasi API

Buka panel **Pengaturan API** di bawah, lalu isi:

- **API Key**: bearer token dari [ark.bytepluses.com](https://ark.bytepluses.com) (international) atau [console.volcengine.com/ark](https://console.volcengine.com/ark) (CN). Disimpan lokal di browser.
- **Endpoint**: pilih preset BytePlus (`ap-southeast`) / Volcengine (`cn-beijing`), atau isi custom (mis. proxy kamu).

Format request mengikuti dokumentasi ARK *Content Generation Tasks*:

```
POST  {endpoint}                          → buat task, balik task id
GET   {endpoint}/{task_id}                → polling status (succeeded / failed / running)
```

Field `model` yang dipakai default:

- `doubao-seedance-1-0-pro-250528`
- `doubao-seedance-1-0-lite-t2v-250428`

Parameter Seedance (`--ratio`, `--resolution`, `--duration`, `--seed`, `--camerafixed`, `--watermark`)
disisipkan otomatis di akhir prompt sesuai konvensi ARK.

## Catatan CORS

BytePlus/Volcengine ARK **tidak** mengirim header CORS, jadi `fetch` langsung dari
browser akan diblokir oleh browser. Pilihannya:

1. **Proxy ringan** — deploy Cloudflare Worker / Vercel function / Express server kecil yang meneruskan request ke ARK dengan header `Access-Control-Allow-Origin: *`, lalu pasang URL-nya di field *Endpoint → Custom*.
2. **Server-side rendering** — bungkus halaman ini di backend yang sama (Express / Next.js API route) dan panggil ARK dari sana.
3. **Demo Mode** — untuk uji UI & alur kredit tanpa hit API sungguhan.

Contoh minimal Cloudflare Worker proxy:

```js
export default {
  async fetch(req, env) {
    const upstream = "https://ark.ap-southeast.bytepluses.com" + new URL(req.url).pathname;
    const headers = new Headers(req.headers);
    headers.set("Authorization", `Bearer ${env.ARK_API_KEY}`);
    const res = await fetch(upstream, { method: req.method, headers, body: req.body });
    const out = new Response(res.body, res);
    out.headers.set("Access-Control-Allow-Origin", "*");
    out.headers.set("Access-Control-Allow-Headers", "*");
    return out;
  },
};
```

## Keamanan

API key disimpan di `localStorage` — siapapun yang punya akses fisik / extension di
browser kamu bisa membacanya. Untuk produksi, simpan key di backend dan jangan kirim
ke frontend.
