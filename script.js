const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyYTZ5aZu0a-tBt48FXbWk6vsV1-ILH9Nzmy6PbIoJAa5X_Aic7dlXh-FQ_ETeivgRoOw/exec";

const form = document.querySelector("[data-attendance-form]");
const codigoInput = document.querySelector("#codigo");
const submitButton = document.querySelector("[data-submit]");
const buttonText = document.querySelector("[data-button-text]");
const buttonLoader = document.querySelector("[data-button-loader]");
const statusBox = document.querySelector("[data-status]");
const statusTitle = document.querySelector("[data-status-title]");
const statusMessage = document.querySelector("[data-status-message]");
const statusDetails = document.querySelector("[data-status-details]");
const clock = document.querySelector("[data-clock]");
const configAlert = document.querySelector("[data-config-alert]");

const formatter = new Intl.DateTimeFormat("es-SV", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "America/El_Salvador",
});

function updateClock() {
  if (clock) {
    clock.textContent = formatter.format(new Date());
  }
}

function isConfigured() {
  return (
    APPS_SCRIPT_URL.startsWith("https://script.google.com/macros/s/") &&
    !APPS_SCRIPT_URL.includes("PEGA_AQUI")
  );
}

function formatCodigo(value) {
  const digits = value.replace(/\D/g, "").slice(0, 9);

  if (digits.length <= 8) {
    return digits;
  }

  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

function isCompleteCodigo(value) {
  return /^\d{8}-\d$/.test(value);
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  buttonText.hidden = isLoading;
  buttonLoader.hidden = !isLoading;
  codigoInput.disabled = isLoading;
}

function setStatus(type, title, message, details = {}) {
  statusBox.hidden = false;
  statusBox.classList.remove("success", "error", "info");
  statusBox.classList.add(type);
  statusTitle.textContent = title;
  statusMessage.textContent = message;
  statusDetails.replaceChildren();

  const actionLabel = {
    entrada: "Entrada",
    salida: "Salida",
  }[details.action];

  const rows = [
    ["Empleado", details.empleado],
    ["Codigo", details.codigo],
    ["Fecha", details.fecha],
    ["Hora", details.hora],
    ["Marcacion", actionLabel],
  ].filter((row) => row[1]);

  rows.forEach(([label, value]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    statusDetails.append(term, description);
  });
}

async function sendMark(codigo) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ codigo }),
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    redirect: "follow",
  });

  const rawResponse = await response.text();
  let payload;

  try {
    payload = JSON.parse(rawResponse);
  } catch (error) {
    throw new Error("El Web App no devolvio una respuesta JSON valida.");
  }

  if (!response.ok) {
    throw new Error(payload.message || "El Web App rechazo la solicitud.");
  }

  return payload;
}

function getConnectionMessage(error) {
  if (error instanceof TypeError) {
    return "No se pudo conectar con Apps Script. Revisa que la implementacion este desplegada para cualquier usuario y que la URL termine en /exec.";
  }

  return error.message || "Ocurrio un error inesperado.";
}

updateClock();
setInterval(updateClock, 1000);

if (configAlert) {
  configAlert.hidden = isConfigured();
}

codigoInput.addEventListener("input", () => {
  codigoInput.value = formatCodigo(codigoInput.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const codigo = formatCodigo(codigoInput.value);
  codigoInput.value = codigo;

  if (!codigo) {
    setStatus("error", "Codigo requerido", "Ingresa el codigo del empleado.");
    codigoInput.focus();
    return;
  }

  if (!isCompleteCodigo(codigo)) {
    setStatus(
      "error",
      "Formato invalido",
      "Ingresa el codigo con formato 00000000-0.",
    );
    codigoInput.focus();
    return;
  }

  if (!isConfigured()) {
    setStatus(
      "error",
      "Falta configuracion",
      "Pega la URL del Web App de Apps Script en la constante APPS_SCRIPT_URL.",
    );
    return;
  }

  setLoading(true);
  setStatus("info", "Registrando", "Validando el codigo en Google Sheets...");

  try {
    const result = await sendMark(codigo);

    if (!result.ok) {
      setStatus("error", "Marcacion rechazada", result.message, result);
      return;
    }

    const title =
      result.action === "entrada" ? "Entrada registrada" : "Salida registrada";
    setStatus("success", title, result.message, result);
    codigoInput.value = "";
  } catch (error) {
    setStatus(
      "error",
      "No se completo la marcacion",
      getConnectionMessage(error),
    );
  } finally {
    setLoading(false);
    codigoInput.focus();
  }
});
