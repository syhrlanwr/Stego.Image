import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { decodeImage } from "../utils/decode";

/**
 * Decode page — lets the user upload a stego image and extract the hidden file.
 *
 * Encryption toggle (must match what was used during encoding):
 *   ON  → decodeImage will decrypt the payload using the provided password.
 *   OFF → decodeImage will skip decryption and decompress directly.
 *         The password field is hidden when encryption is OFF.
 */
function Decode() {
  const [image, setImage] = useState(null);
  const [password, setPassword] = useState("");
  const [useEncrypt, setUseEncrypt] = useState(true); // must match encode-time setting
  const [outputFile, setOutputFile] = useState(null); // { url, name, mimeType, blob }
  const [pdfVerification, setPdfVerification] = useState(null); // { loading, error, result }
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef();
  const imageInputRef = useRef();

  /**
   * Sets the selected image and clears any previous decode result.
   * @param {File} file
   */
  const selectImage = (file) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      return;
    }
    setImage(file);
    setOutputFile(null);
    setPdfVerification(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    selectImage(e.dataTransfer.files[0]);
  };
  const handleDragOver = (e) => e.preventDefault();

  /**
   * Toggles encryption on/off.
   * Clears the password field when turning encryption off.
   */
  const handleToggleEncrypt = () => {
    setUseEncrypt((prev) => {
      if (prev) setPassword("");
      return !prev;
    });
  };

  /**
   * Detects whether a decoded file is a PDF.
   * @param {string|null} fileName
   * @param {string|null} mimeType
   * @returns {boolean}
   */
  const isPdfFile = (fileName, mimeType) => {
    const normalizedName = (fileName || "").toLowerCase();
    return mimeType === "application/pdf" || normalizedName.endsWith(".pdf");
  };

  /**
   * Verifies a PDF document using the Cloudflare Worker proxy.
   * @param {Blob} blob
   * @param {string} fileName
   */
  const verifyPdfTte = async (blob, fileName) => {
    if (!blob || !isPdfFile(fileName, blob.type)) {
      setPdfVerification(null);
      return null;
    }

    setPdfVerification({ loading: true, error: null, result: null });

    try {
      const pdfFile = new File([blob], fileName || "document.pdf", {
        type: "application/pdf",
      });

      const formData = new FormData();
      formData.append("file", pdfFile, fileName || "document.pdf");

      const response = await fetch("https://apiproxy.fair-csff7.workers.dev/verify-pdf", {
        method: "POST",
        body: formData,
      });

      const rawText = await response.text();
      let result = null;

      if (rawText) {
        try {
          result = JSON.parse(rawText);
        } catch {
          result = { rawResponse: rawText };
        }
      }

      if (!response.ok) {
        throw new Error(
          result && result.message ? result.message : `Verification failed (${response.status})`,
        );
      }

      setPdfVerification({ loading: false, error: null, result });
      return result;
    } catch (error) {
      setPdfVerification({
        loading: false,
        error: error.message || "Failed to verify PDF signature.",
        result: null,
      });
      return null;
    }
  };

  /**
   * Loads the stego image, then calls decodeImage.
   * Passes password when encryption is ON, or null when OFF —
   * the decode utility uses this to decide whether to decrypt.
   */
  const handleDecode = () => {
    if (!image) {
      alert("Please upload a stego image.");
      return;
    }

    if (useEncrypt && !password) {
      alert(
        "Please enter the decryption password, or turn off encryption if the image was not encrypted.",
      );
      return;
    }

    setLoading(true);
    setOutputFile(null);
    setPdfVerification(null);

    const objectUrl = URL.createObjectURL(image);
    const img = new window.Image();
    img.src = objectUrl;

    img.onload = async () => {
      try {
        const { blob, fileName } = await decodeImage(
          img,
          canvasRef.current,
          useEncrypt ? password : null,
        );

        const finalBlob = new Blob([blob], { type: blob.type || "application/octet-stream" });
        const finalObjectUrl = URL.createObjectURL(finalBlob);

        const extractedFile = {
          url: finalObjectUrl,
          name: fileName,
          mimeType: finalBlob.type,
          blob: finalBlob,
        };

        setOutputFile(extractedFile);

        if (isPdfFile(fileName, finalBlob.type)) {
          await verifyPdfTte(finalBlob, fileName);
        }
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      alert("Failed to load image. Ensure it is a valid image file.");
      setLoading(false);
      URL.revokeObjectURL(objectUrl);
    };
  };

  const isPdfOutput = outputFile && isPdfFile(outputFile.name, outputFile.mimeType);

  return (
    <div className="decode-container container py-5">
      {/* HELMET */}
      <Helmet>
        <title>Extract Hidden File from Image Online — Steganography Decoder | Stego.Image</title>
        <meta
          name="description"
          content="Extract and decrypt files hidden inside images. Upload your stego image and password to recover the original file. Fully client-side."
        />
        <link rel="canonical" href="https://stegoimage.pages.dev/decode" />
      </Helmet>

      {/* Page header */}
      <div className="text-center text-white mb-4">
        <h1>Dekode Data dari Image</h1>
        <p>Ekstrak data tersembunyi dari gambar steganografi</p>
      </div>

      <div className="row g-4">
        {/* Stego image drop zone */}
        <div className="col-md-8 offset-md-2">
          <label className="label-text">Gambar Stego</label>
          <div
            className="drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => imageInputRef.current.click()}
          >
            <p className="mb-0">Select or drop stego image</p>
            {image && <span className="file-name">{image.name}</span>}
            <input
              type="file"
              accept="image/*"
              hidden
              ref={imageInputRef}
              onChange={(e) => selectImage(e.target.files[0])}
            />
          </div>
        </div>

        {/* ── Encryption Toggle ── */}
        <div className="col-md-8 offset-md-2">
          <div className="encrypt-toggle-row">
            {/* Left: label + status badge */}
            <div className="encrypt-toggle-label">
              <span className="label-text mb-0">Encryption</span>
              <span
                className={`encrypt-badge ${useEncrypt ? "badge-on" : "badge-off"}`}
              >
                {useEncrypt ? "🔒 AES-256 ON" : "🔓 OFF"}
              </span>
            </div>

            {/* Right: toggle switch */}
            <button
              type="button"
              className={`encrypt-toggle-btn ${useEncrypt ? "toggle-on" : "toggle-off"}`}
              onClick={handleToggleEncrypt}
              aria-pressed={useEncrypt}
              aria-label="Toggle decryption"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {/* Contextual hint — reminds user to match encode-time setting */}
          <p className="encrypt-hint">
            {useEncrypt
              ? "Gambar tersebut telah disandikan dengan enkripsi. Masukkan kata sandi yang digunakan saat penyandian."
              : "Gambar tersebut dikodekan tanpa enkripsi. Tidak diperlukan kata sandi untuk mengekstraknya."}
          </p>
        </div>

        {/* Password field — only shown when encryption is ON */}
        {useEncrypt && (
          <div className="col-md-8 offset-md-2">
            <label className="label-text">Decryption Password</label>
            <input
              type="password"
              className="form-control custom-input"
              placeholder="Enter the password used during encoding"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        {/* Decode button */}
        <div className="col-12 text-center">
          <button
            className="primary-btn"
            onClick={handleDecode}
            disabled={loading}
          >
            {loading && (
              <span className="spinner-border spinner-border-sm me-2" />
            )}
            {loading ? "Decoding…" : "Execute Decoding"}
          </button>
        </div>

        {/* Output — shown after successful extraction */}
        {outputFile && (
          <div className="col-12 mt-4">
            <div className="output-box text-center">
              <h5>File Extracted Successfully</h5>
              <p>{outputFile.name}</p>
              {isPdfOutput && (
                <div className="mt-4 text-start">
                  <label className="label-text">PDF Preview</label>
                  <iframe
                    title="Decoded PDF preview"
                    src={outputFile.url}
                    style={{
                      width: "100%",
                      minHeight: "700px",
                      border: "1px solid #d9d9d9",
                      borderRadius: "8px",
                      background: "#fff",
                    }}
                  />
                </div>
              )}
              <div className="d-flex justify-content-center gap-3 flex-wrap mt-3">
                <a
                  href={outputFile.url}
                  download={outputFile.name}
                  className="primary-btn"
                >
                  Download File
                </a>

                {isPdfOutput && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => verifyPdfTte(outputFile.blob, outputFile.name)}
                  >
                    Verify PDF TTE
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PDF TTE verification results */}
        {pdfVerification && (
          <div className="col-12 mt-4">
            <div className="output-box text-start">
              <h5>PDF TTE Verification</h5>

              {pdfVerification.loading && <p>Checking digital signature…</p>}

              {pdfVerification.error && (
                <div className="alert alert-danger mb-0">
                  {pdfVerification.error}
                </div>
              )}

              {pdfVerification.result && (
                <div>
                  <p className="mb-2">
                    <strong>Document ID:</strong> {pdfVerification.result.documentId || "-"}
                  </p>
                  <p className="mb-2">
                    <strong>Status:</strong>{" "}
                    {pdfVerification.result.verificationStatus?.join(", ") || "-"}
                  </p>
                  <p className="mb-2">
                    <strong>Has Signature:</strong>{" "}
                    {pdfVerification.result.documentHasSignature ? "Yes" : "No"}
                  </p>
                  <p className="mb-2">
                    <strong>Message Code:</strong>{" "}
                    {pdfVerification.result.messageCode || "-"}
                  </p>

                  {pdfVerification.result.signatures?.[0]?.basicInfo && (
                    <div className="info-box mt-3">
                      <p>Signature Details</p>
                      <ul className="mb-0 ps-3">
                        <li>
                          <strong>Name:</strong>{" "}
                          {pdfVerification.result.signatures[0].basicInfo.signatureName || "-"}
                        </li>
                        <li>
                          <strong>Signer:</strong>{" "}
                          {pdfVerification.result.signatures[0].basicInfo.signerName || "-"}
                        </li>
                        <li>
                          <strong>Time:</strong>{" "}
                          {pdfVerification.result.signatures[0].basicInfo.signerTime || "-"}
                        </li>
                        <li>
                          <strong>Reason:</strong>{" "}
                          {pdfVerification.result.signatures[0].basicInfo.reason || "-"}
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas used by the steganography engine */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Instructions */}
      <div className="info-box mt-5">
        <h5>⚠️ Harap baca sebelum melakukan dekode</h5>
        <ul>
          <li>
            Gunakan format <strong>PNG</strong> atau <strong>BMP</strong> saja. Jika Anda menerima file ZIP, ekstrak terlebih dahulu.
          </li>
          <li>
            Pengaturan harus sama dengan yang digunakan saat proses enkripsi.
          </li>
          <li>
            Enkripsi <strong>AKTIF</strong>: masukkan kata sandi yang tepat seperti yang digunakan saat enkripsi. <strong>NONAKTIF</strong>: tidak memerlukan kata sandi.
          </li>
          <li>Kata sandi atau pengaturan yang salah akan menyebabkan file rusak atau tidak menghasilkan apa pun.</li>
          <li>
            Jika hasil decode adalah file PDF, file akan tampil langsung di dalam
            halaman web menggunakan object URL browser. Tidak disimpan ke server.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Decode;
