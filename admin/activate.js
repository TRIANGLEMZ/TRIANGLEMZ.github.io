const activationForm = document.getElementById("activation-form");
const activationMessage = document.getElementById("activation-message");

function showActivationMessage(message, isError = false) {
  activationMessage.textContent = message;
  activationMessage.classList.toggle("error", isError);
}

async function hashActivationPassword(password, salt) {
  if (!crypto.subtle) throw new Error("Aktivasi memerlukan browser modern atau HTTPS.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt,
    iterations: 310000,
    hash: "SHA-256"
  }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function checkActivationState() {
  const admin = await window.portfolioLocalStore.getSetting("admin");
  if (!admin) return;
  document.getElementById("activation-title").textContent = "Login sudah diatur.";
  document.getElementById("activation-description").textContent = "Pengaturan baru tidak tersedia. Kembali ke halaman login.";
  activationForm.hidden = true;
}

activationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = document.getElementById("activation-submit");
  submitButton.disabled = true;
  try {
    if (await window.portfolioLocalStore.getSetting("admin")) {
      activationForm.hidden = true;
      throw new Error("Login sudah diatur di browser ini.");
    }
    const formData = new FormData(activationForm);
    const password = String(formData.get("password"));
    if (password.length < 12) throw new Error("Kata sandi harus memiliki minimal 12 karakter.");
    if (password !== formData.get("confirm_password")) throw new Error("Kedua sandi tidak sama.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await hashActivationPassword(password, salt);
    await window.portfolioLocalStore.setSetting("admin", {
      passwordHash,
      passwordSalt: Array.from(salt, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      passwordAlgorithm: "pbkdf2-sha256"
    });
    activationForm.hidden = true;
    document.getElementById("activation-title").textContent = "Login berhasil diatur.";
    document.getElementById("activation-description").textContent = "Sekarang kembali dan masuk menggunakan kata sandi yang dibuat.";
  } catch (error) {
    showActivationMessage(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

checkActivationState().catch((error) => {
  console.error("Gagal memeriksa aktivasi admin:", error);
  activationForm.hidden = true;
  showActivationMessage(`Gagal membuka penyimpanan lokal: ${error.message}`, true);
});
