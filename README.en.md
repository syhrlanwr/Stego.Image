<p align="center">
  <img src="public/logo.png" alt="Logo Stego.Image" width="220" />
</p>

<h1 align="center">Stego.Image</h1>

<p align="center">
  <strong>Hide Any File Inside an Image — Encrypted, Compressed, and Invisible to the Human Eye.</strong><br/>
  100% Client-Side. Zero Servers. Zero Data Uploads. Absolute Privacy in Your Browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-2ea44f?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/React-19.3-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-6%2F8-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Security-AES--256%20%2B%20PBKDF2-orange?style=flat-square" alt="Security" />
  <img src="https://img.shields.io/badge/Architecture-Zero--Knowledge-purple?style=flat-square" alt="Zero-Knowledge" />
</p>

<p align="center">
  <a href="README.md"><img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1ee-1f1e9.svg" width="18" height="18" valign="middle" alt="ID" /> <strong>Bahasa Indonesia</strong></a> | <a href="README.en.md"><img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1ec-1f1e7.svg" width="18" height="18" valign="middle" alt="GB" /> <strong>English Version</strong></a>
</p>

---

## 📑 Table of Contents

- [About Stego.Image](#-about-stegoimage)
- [Zero-Knowledge Architecture & Philosophy](#-zero-knowledge-architecture--philosophy)
- [System Pipeline Architecture](#-system-pipeline-architecture)
  - [1. Encoding Pipeline (Embedding)](#1-encoding-pipeline-embedding)
  - [2. Decoding Pipeline (Extraction)](#2-decoding-pipeline-extraction)
- [Binary Wire Format Specification](#-binary-wire-format-specification)
  - [Binary Stream Layout](#binary-stream-layout)
  - [Plaintext Block Structure Details](#plaintext-block-structure-details)
- [Core Mechanisms & Technical Components](#-core-mechanisms--technical-components)
  - [1. DEFLATE Compression (Pre-Encryption)](#1-deflate-compression-pre-encryption)
  - [2. AES-256 Encryption & PBKDF2 Key Derivation](#2-aes-256-encryption--pbkdf2-key-derivation)
  - [3. LSB (Least Significant Bit) Steganography](#3-lsb-least-significant-bit-steganography)
  - [4. Opaque Pixel Isolation & Alpha Filtering](#4-opaque-pixel-isolation--alpha-filtering)
  - [5. Image Capacity Formulation](#5-image-capacity-formulation)
- [Deep Reverse Engineering Insights](#-deep-reverse-engineering-insights)
  - [Mitigating Social Media Lossy Compression Corruption](#mitigating-social-media-lossy-compression-corruption)
  - [Analysis of Interface Encryption Toggle vs Engine Behavior](#analysis-of-interface-encryption-toggle-vs-engine-behavior)
  - [Canvas Rendering Integrity Without Anti-Aliasing](#canvas-rendering-integrity-without-anti-aliasing)
- [Project Structure](#-project-structure)
- [Usage Guide](#-usage-guide)
  - [Hiding Files (Encode)](#hiding-files-encode)
  - [Extracting Files (Decode)](#extracting-files-decode)
- [Installation & Local Development](#-installation--local-development)
- [Knowledge Base Modules](#-knowledge-base-modules)
- [Contributing & License](#-contributing--license)

---

## 💡 About Stego.Image

**Stego.Image** is an advanced, modern steganography web application enabling users to conceal arbitrary digital files (text documents, PDFs, ZIP archives, audio clips, videos, or source code) inside lossless PNG images without inducing any visible degradation detectable by the human visual system.

The application couples two independent security pillars (*Defense in Depth*):
1. **Steganography (Security through Obscurity):** Conceals the *existence* of sensitive data within spatial pixel noise across the carrier image.
2. **Cryptography (Mathematical Confidentiality):** Safeguards the *content* using military-grade **AES-256-CBC** symmetric encryption hardened with **PBKDF2-SHA256 (100,000 iterations)** key derivation. Even if anomalous bits are analytically identified (e.g., via Chi-Square statistical steganalysis or raw bit extraction), the extracted payload remains indistinguishable from uniform pseudorandom noise and is mathematically unreadable without the authentic passphrase.

---

## 🛡️ Zero-Knowledge Architecture & Philosophy

Stego.Image is engineered under uncompromising zero-knowledge privacy guarantees:

```
[Client Device] ──── (100% Client-Side Web APIs) ────> [PNG Output / Restored File]
       │
       ✕  ZERO DATA TRANSMITTED ACROSS NETWORK
       ▼
[Server / Cloudflare] ─── Serves Static Assets Exclusively (HTML/JS/CSS)
```

- **No Backend / Zero Server APIs:** All image processing, DEFLATE compression, cryptographic key derivation, and spatial bit manipulation execute exclusively inside the browser's local JavaScript runtime.
- **Native Web Standards:** Relies strictly on standard HTML5 Canvas 2D APIs (`getImageData`, `putImageData`), TypedArrays (`Uint8Array`, `ArrayBuffer`), `TextEncoder`/`TextDecoder`, and Object URLs.
- **Plausible Deniability:** Zero plaintext metadata is embedded into the carrier image. All critical metadata (original filename, MIME type, payload length) is encrypted inside the single unified ciphertext envelope alongside the compressed file content. The resulting stego image exhibits identical EXIF/PNG structural metadata and is visually indistinguishable from any ordinary image.

---

## 🔄 System Pipeline Architecture

### 1. Encoding Pipeline (Embedding)

Sequential transformation stages for embedding a secret file into a cover image in `src/utils/stego.js`:

1. **File Buffer Ingestion:** The secret payload is read via browser file APIs as an `ArrayBuffer` and normalized into a `Uint8Array` binary view.
2. **Data Compression (Pre-Encryption):** Raw binary payload is compressed using the **DEFLATE** algorithm via `pako` (`src/utils/compression.js`) to maximize pixel capacity prior to entropy maximization caused by encryption.
3. **Unified Plaintext Block Assembly:** Metadata and compressed payload are marshaled into a continuous byte sequence:
   - **Magic Signature:** `0x53, 0x54, 0x47, 0x4F` (`"STGO"`).
   - **Filename Metadata:** 4-byte string length + UTF-8 encoded filename bytes.
   - **MIME Type Metadata:** 4-byte string length + UTF-8 encoded MIME type bytes.
   - **Original Uncompressed Size:** 4-byte `uint32` uncompressed file size.
   - **Payload:** Raw bytes from DEFLATE-compressed file payload.
4. **Cryptographic Salt Generation:** A fresh 16-byte cryptographically secure random salt is generated (`CryptoJS.lib.WordArray.random(16)`).
5. **Key Derivation (KDF):** A 256-bit symmetric encryption key is derived from the user passphrase and random salt via **PBKDF2-SHA256 (100,000 iterations)** (`src/utils/encryption.js`).
6. **AES-256-CBC Encryption:** The entire plaintext block is encrypted with AES-256 using a salt-derived IV, yielding a Base64-encoded ciphertext string.
7. **Envelope Stream Packaging:** Ciphertext bytes are prepended with the 16-byte PBKDF2 salt, prefixed with a 4-byte `uint32` Big-Endian integer denoting the exact encrypted envelope byte length.
8. **Bit Serialization:** Every stream byte is sequentially converted into 8 individual bits from Most Significant Bit (MSB) to Least Significant Bit (LSB).
9. **Cover Image Pixel Extraction:** HTML5 Canvas renders the cover image and extracts raw pixel buffer data using `ctx.getImageData`.
10. **Pixel Capacity Validation:** The system tallies all fully opaque pixels (`alpha === 255`) and confirms that the payload bitstream fits within the available pixel budget ($\text{opaquePixels} \times 3$).
11. **Spatial Bit Embedding (LSB Substitution):** Serialized bits are sequentially written into bit 0 of the Red (R), Green (G), and Blue (B) color channels of each eligible opaque pixel (`pixels[i + j] = (pixels[i + j] & 254) | bit`).
12. **Rasterization & Export:** Modified pixel memory is flushed back to the Canvas context (`ctx.putImageData`) and rendered to a lossless PNG Data URL (`canvas.toDataURL("image/png")`). Users can download the direct PNG or generate a protective ZIP bundle via `src/utils/downloadZip.js`.

### 2. Decoding Pipeline (Extraction)

Sequential extraction and reconstruction stages in `src/utils/decode.js`:

1. **Non-Interpolated Image Rendering:** The stego image is drawn onto an off-screen HTML5 canvas element with `ctx.imageSmoothingEnabled = false` to strictly prevent anti-aliasing interpolation.
2. **Pixel Buffer Extraction:** RGBA color and alpha channels are extracted into browser memory using `ctx.getImageData`.
3. **LSB Bit Stream Harvesting:** The parser traverses all fully opaque pixels (`alpha === 255`) and samples bit 0 of channels R, G, and B (`pixel & 1`), assembling the raw bit stream.
4. **Byte Stream Reconstitution:** Bits are accumulated in groups of 8 (MSB to LSB) to reconstruct a continuous `Uint8Array` byte stream.
5. **Envelope Length Read:** The first 4 bytes are read as a Big-Endian `uint32` integer to determine the exact payload boundary.
6. **Salt & Ciphertext Demuxing:** The subsequent 16 bytes are extracted as the cryptographic salt, while trailing bytes represent the Base64-encoded ciphertext.
7. **Key Reconstruction:** The AES-256 key is re-derived by executing PBKDF2-SHA256 (100,000 iterations) using the extracted salt and the user-supplied passphrase.
8. **AES-256-CBC Decryption:** The Base64 ciphertext is decrypted. If the password is incorrect or bits have been corrupted, decryption fails gracefully at this stage.
9. **Magic Signature Verification ("STGO"):** The first 4 bytes of the decrypted plaintext buffer are evaluated. If they do not exactly match `0x53, 0x54, 0x47, 0x4F`, the operation is aborted and an error is thrown (*wrong password or corrupted image*).
10. **Metadata Deserialization:**
    - Reads 4-byte filename length and decodes original filename using `TextDecoder` (UTF-8).
    - Reads 4-byte MIME type length and decodes original MIME string (UTF-8).
    - Reads 4-byte original uncompressed file size integer.
11. **DEFLATE Decompression:** The remaining payload segment is inflated back to raw bytes via `pako.inflate` (`src/utils/compression.js`).
12. **Final Integrity Validation:** The size of decompressed binary data is asserted against the recorded original size metadata for 100% data integrity verification.
13. **Download Object Generation:** Reconstructed bytes are encapsulated into a native `Blob` tagged with the original MIME type, producing an Object URL ready for browser download.

---

## 📦 Binary Wire Format Specification

Stego.Image uses a compact, structured binary wire format. All multi-byte numerical fields are encoded as **32-bit unsigned integers (uint32) in Big-Endian network byte order**.

### Binary Stream Layout

Data injected into the image's LSB channels is divided into two distinct envelopes:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               OUTER BITSTREAM WRAPPER                                  │
├─────────────────────────┬──────────────────────────────────────────────────────────────┤
│ Offset (Bytes)          │ Field Description                                            │
├─────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 0x00 .. 0x03 (4 Bytes)  │ Encrypted Payload Length (uint32, Big-Endian)                │
│ 0x04 .. 0x13 (16 Bytes) │ Cryptographic PBKDF2 Salt (16 bytes random)                  │
│ 0x14 .. End             │ AES-256 Ciphertext (Base64 ASCII string encoded to bytes)    │
└─────────────────────────┴──────────────────────────────────────────────────────────────┘
```

### Plaintext Block Structure Details

Prior to AES-256 encryption, the payload and all file metadata are serialized into a single contiguous byte block (`plaintext`):

```
┌────────┬──────────────────────┬─────────────┬──────────────────────┬─────────────┬──────────────┬─────────────────────┐
│ 4 Byte │ 4 Byte               │ N Byte      │ 4 Byte               │ M Byte      │ 4 Byte       │ Remaining Bytes     │
├────────┼──────────────────────┼─────────────┼──────────────────────┼─────────────┼──────────────┼─────────────────────┤
│ "STGO" │ Filename Length (N)  │ Filename    │ MimeType Length (M)  │ MimeType    │ Orig. Size   │ Compressed Payload  │
│ Magic  │ (uint32 Big-Endian)  │ (UTF-8)     │ (uint32 Big-Endian)  │ (UTF-8)     │ (uint32 BE)  │ (DEFLATE / zlib)    │
└────────┴──────────────────────┴─────────────┴──────────────────────┴─────────────┴──────────────┴─────────────────────┘
```

1. **Magic Signature (`0x53 0x54 0x47 0x4F` / `"STGO"`):** Application signature constant. Because it is sealed within the encrypted payload, it acts as an integrated tamper detector and incorrect-password sentry. An invalid key produces scrambled noise, causing signature verification to immediately fail safely.
2. **Filename Field:** 4-byte uint32 Big-Endian length descriptor ($N$) followed by $N$ bytes of UTF-8 encoded filename string (e.g., `confidential_report.pdf`).
3. **MIME Type Field:** 4-byte uint32 Big-Endian length descriptor ($M$) followed by $M$ bytes of UTF-8 encoded MIME type string (e.g., `application/pdf` or `image/png`).
4. **Original Size:** 4-byte uint32 Big-Endian integer storing uncompressed file byte length, used during extraction to verify decompression integrity.
5. **Compressed Payload:** Raw binary payload compressed via the DEFLATE algorithm.

---

## 🔬 Core Mechanisms & Technical Components

### 1. DEFLATE Compression (Pre-Encryption)
- **Implementation:** `pako` library (`pako.deflate` & `pako.inflate`).
- **Shannon Information Entropy Principle:** Robust cryptographic ciphertexts exhibit near-maximal Shannon entropy with uniform bit distribution indistinguishable from true randomness. Mathematically, random high-entropy data **cannot be compressed**. Stego.Image therefore always executes DEFLATE compression **prior to** encryption.
- **Practical Benefit:** Reduces necessary pixel budget by 20% to 80% (especially effective for text files, source code, structured documents, and PDFs).

### 2. AES-256 Encryption & PBKDF2 Key Derivation
- **Algorithm:** AES-256 in Cipher Block Chaining (CBC) mode with PKCS#7 padding via `crypto-js`.
- **Key Derivation Function (KDF):** PBKDF2 (*Password-Based Key Derivation Function 2*) utilizing HMAC-SHA256 as its pseudo-random function.
- **KDF Parameters:**
  - Key Length: 256 bits (32 bytes / 8 words).
  - Iterations: **100,000 rounds** (delivering strong resistance against GPU-accelerated brute-force attacks).
  - Salt: **16 cryptographically secure random bytes** (`CryptoJS.lib.WordArray.random(16)`) generated per encoding session to neutralize pre-computed Rainbow Table attacks.
  - Initialization Vector (IV): Bound to the 16-byte random salt ensuring CBC ciphertext randomness across consecutive runs.

### 3. LSB (Least Significant Bit) Steganography
LSB spatial substitution replaces bit 0 of individual 8-bit color channels with secret bitstream values.

Example modification in an 8-bit color channel (range 0–255):
```
Original Byte Value: 202 (Binary: 11001010) -> Last bit = 0
Secret Data Bit    :   1
Stego Byte Value   : 203 (Binary: 11001011) -> Last bit = 1
Visual Variance    : +1 / 256 channel intensity level (0.39%), imperceptible to human vision.
```

Bitwise operation in codebase (`src/utils/stego.js`):
```javascript
// Clear LSB with bitwise AND 254 (0xFE), then insert secret bit
pixels[i + j] = (pixels[i + j] & 254) | bits[bitIndex++];
```

### 4. Opaque Pixel Isolation & Alpha Filtering
HTML5 Canvas returns pixel data as a flat, single-dimensional `Uint8ClampedArray` formatted as `[R, G, B, A, R, G, B, A, ...]`.
- Stego.Image **strictly utilizes** pixels with full opacity:
  ```javascript
  if (pixels[i + 3] === 255) { /* embed bits into R, G, B channels */ }
  ```
- **Technical Justification:**
  1. Prevents visual artifacts or edge-bleeding in translucent regions of PNG graphics.
  2. The Alpha channel (`pixels[i + 3]`) is **never modified**, maintaining transparent image geometry flawlessly.

### 5. Image Capacity Formulation
Theoretical carrier capacity is derived directly from total fully opaque pixel count:

$$\text{Capacity (Bytes)} = \left\lfloor \frac{N_{\text{opaque}} \times 3}{8} \right\rfloor$$

*Where:*
- $N_{\text{opaque}}$: Count of pixels exhibiting alpha value $\text{A} = 255$.
- Each opaque pixel offers 3 embeddable bit slots (1 bit each across Red, Green, and Blue).
- Divided by 8 to convert total available bits into bytes.

*Example Calculation:*
A standard Full HD cover image ($1920 \times 1080$) without transparency possesses $2,073,600$ opaque pixels:
$$\text{Capacity} = \frac{2,073,600 \times 3}{8} = 777,600 \text{ Bytes} \approx 759.37 \text{ KB}$$

---

## 🔍 Deep Reverse Engineering Insights

Technical discoveries from audits of the runtime pipeline and architecture:

### Mitigating Social Media Lossy Compression Corruption
- **Vulnerability Context:** Spatial LSB substitution is inherently non-robust against lossy transformations (e.g., automatic JPEG conversion, WebP recompression, or chroma subsampling enforced by messaging services such as WhatsApp, Telegram media upload, Instagram, or Discord). Such transformations alter color values, corrupting LSB bits and rendering decryption impossible.
- **Architectural Solution:** The team integrated `JSZip` and `file-saver` (`src/utils/downloadZip.js`) to provide **"Download ZIP (Safe Share)"**. When the PNG is transmitted within a `.zip` archive, social media networks treat the payload as an arbitrary binary document, preserving 100% of the carrier pixels bit-for-bit.

### Analysis of Interface Encryption Toggle vs Engine Behavior
- **Codebase Observations:**
  - The UI components (`src/pages/Encode.jsx` & `src/pages/Decode.jsx`) expose an encryption toggle control.
  - However, within the core engine modules (`src/utils/stego.js` & `src/utils/decode.js`), `encodeImage` calls `encryptData(plaintext, password)` directly, and `decodeImage` enforces a strict safeguard:
    ```javascript
    if (!password) {
      throw new Error("Password is required to decode this image.");
    }
    ```
- **Developer Takeaway:** The steganography engine is architected around mandatory cryptographic sealing. If the UI toggle is turned off, `null` password propagation causes decoding failures. It is strongly advised to **always keep encryption enabled and define a strong passphrase** for maximum security and extraction reliability.

### Canvas Rendering Integrity Without Anti-Aliasing
- During decoding in `src/utils/decode.js`, the canvas explicitly disables smoothing:
  ```javascript
  ctx.imageSmoothingEnabled = false;
  ```
- **Critical Function:** This prevents the browser rendering engine from applying bilinear or bicubic filtering while blitting the image onto the 2D canvas, guaranteeing exact preservation of original bit values.

---

## 📂 Project Structure

```plaintext
Stego.Image/
├── public/                       # Static public assets
│   ├── logo.png                  # Primary application logo
│   ├── OG-image.png              # Open Graph social banner
│   ├── robots.txt                # Search crawler configuration
│   ├── sitemap.xml               # SEO sitemap
│   └── _redirects                # Cloudflare Pages SPA rewrite rules
├── src/
│   ├── assets/                   # Internal module graphics & assets
│   ├── components/               # Reusable UI component modules
│   │   ├── Navbar.jsx            # Responsive navigation header
│   │   └── Footer.jsx            # GitHub-styled footer with version badge
│   ├── pages/                    # Route page views
│   │   ├── Home.jsx              # Landing page overview
│   │   ├── Encode.jsx            # Carrier embedding workflow
│   │   ├── Decode.jsx            # Carrier extraction & preview workflow
│   │   ├── About.jsx             # Project philosophy & security specs
│   │   └── learn/                # 7 Interactive educational modules
│   │       ├── HowSteganographyWorks.jsx
│   │       ├── LsbSteganography.jsx
│   │       ├── ImageSteganography.jsx
│   │       ├── Aes256Encryption.jsx
│   │       ├── SteganographyVsEncryption.jsx
│   │       ├── DetectHiddenData.jsx
│   │       └── UseCases.jsx
│   ├── utils/                    # Core mathematical & crypto utilities
│   │   ├── compression.js        # DEFLATE/inflate utilities via pako
│   │   ├── decode.js             # LSB stream extractor & binary parser
│   │   ├── downloadZip.js        # Safe-share archive builder via JSZip
│   │   ├── encryption.js         # AES-256-CBC & PBKDF2 crypto routines
│   │   └── stego.js              # LSB Canvas injection engine
│   ├── App.jsx                   # React Router configuration & Error Boundaries
│   ├── App.css                   # Custom styles & dark mode palette
│   ├── index.css                 # Global CSS rules & Bootstrap reset
│   └── main.jsx                  # React 19 application entry point
├── index.html                    # HTML5 shell & JSON-LD structured data
├── package.json                  # Dependencies & npm build scripts
├── vite.config.js                # Vite bundler configuration
└── CHANGELOG.md                  # Release version history
```

---

## 🚀 Usage Guide

### Hiding Files (Encode)
1. Navigate to the **Encode** tab in the top navigation bar.
2. Select and upload a **Cover Image** (uncompressed **PNG** or **BMP** formats are strongly recommended).
3. Review the **Estimated Image Capacity** indicator to ensure your carrier has adequate capacity.
4. Select the **Secret File** you wish to conceal.
5. Provide a resilient **Encryption Password**.
6. Click **Execute Encoding**.
7. When processing finishes:
   - Click **Download PNG** to store the stego image directly on your local device.
   - Click **Download ZIP (Safe Share)** if sending via instant messengers (WhatsApp, Discord, Telegram, etc.) to shield pixel bits against lossy compression.

### Extracting Files (Decode)
1. Navigate to the **Decode** tab in the top navigation bar.
2. Upload the **Stego Image** (the carrier PNG holding the concealed payload).
3. Enter the exact **Decryption Password** established during encoding.
4. Click **Execute Decoding**.
5. The original file will be decrypted, decompressed, and verified automatically, ready for immediate download with its original filename and extension.

> [!TIP]
> **Choosing an Optimal Cover Image:**
> Choose high-resolution images characterized by diverse color palettes, natural textures, or fine details (such as landscapes, foliage, or architectural photographs). Images featuring large uniform color blocks (e.g., solid white or black backgrounds) are noticeably more vulnerable to statistical histogram analysis (*visual steganalysis*).

---

## 🛠️ Installation & Local Development

Ensure **Node.js** (v18+) and **npm** are available on your workstation:

```bash
# 1. Clone the repository
git clone https://github.com/50RISHU/Stego.Image.git
cd Stego.Image

# 2. Install dependencies
npm install

# 3. Launch Vite local development server
npm run dev

# 4. Compile optimized production build
npm run build

# 5. Preview production build locally
npm run preview

# 6. Execute ESLint static code analysis
npm run lint
```

The local development server launches by default at `http://localhost:5173`.

---

## 📚 Knowledge Base Modules

Beyond utilitarian data hiding, Stego.Image serves as a comprehensive educational cybersecurity platform offering 7 interactive modules:

| Learning Module | Primary Technical Focus |
|---|---|
| **How Steganography Works** | Classical steganography history (invisible ink, scytale) through modern digital carrier techniques. |
| **LSB Steganography** | In-depth breakdown of bit 0 manipulation across 8-bit RGB color channels. |
| **Image Steganography** | Comparative behavior of image formats (lossless PNG vs lossy JPEG/WebP) regarding LSB persistence. |
| **AES-256 Encryption** | Symmetric block ciphers, initialization vectors, cryptographic salts, and PBKDF2 key strengthening. |
| **Steganography vs Encryption** | Comparative analysis: concealing existence of data vs securing confidential content. |
| **Detect Hidden Data** | Statistical steganalysis techniques (Chi-Square testing, spatial histograms, and Sample Pair Analysis). |
| **Use Cases** | Practical applications: protecting whistleblowers, digital media watermarking, and out-of-band credential exchange. |

---

## 🤝 Contributing & License

Community contributions are warmly welcomed! To contribute:
1. Fork this repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push your branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

Please review [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution standards and development workflow guidelines.

### License
This project is open-source software licensed under the **MIT License**. Refer to [LICENSE](LICENSE) for complete copyright terms and permissions.
