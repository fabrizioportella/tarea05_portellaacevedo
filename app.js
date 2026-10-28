"use strict";

const DB_NAME = "FiscalizacionPractica";
const DB_STORE = "projects";
const $ = (id) => document.getElementById(id);
const fields = ["code", "date", "place", "inspector", "entity"];
let activeId = null;
let projects = [];
let pendingFiles = [];
let toastTimer;

const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE, { keyPath: "id" });
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});

async function withDb(fn) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const req = fn(tx.objectStore(DB_STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function projectData() { return Object.fromEntries(fields.map((id) => [id, $(id).value.trim()])); }
function emptyProject() { return { id: uid(), ...projectData(), photos: [], updatedAt: new Date().toISOString() }; }
function currentProject() { return projects.find((p) => p.id === activeId); }
function esc(value) { const e = document.createElement("span"); e.textContent = value ?? ""; return e.innerHTML; }
function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&apos;"}[c])).replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/gu, "");
}
function notify(message, error = false) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").className = `toast show${error ? " error" : ""}`;
  toastTimer = setTimeout(() => $("toast").className = "toast", 3500);
}

async function loadProjects() {
  projects = await withDb((store) => store.getAll());
  projects.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  $("projectSelect").innerHTML = '<option value="">Seleccione…</option>' + projects.map((p) => `<option value="${p.id}">${esc(p.code || "Sin código")} · ${esc(p.place || "Sin lugar")}</option>`).join("");
  if (activeId) $("projectSelect").value = activeId;
}

function populate(p) {
  activeId = p.id;
  fields.forEach((id) => $(id).value = p[id] || "");
  $("projectSelect").value = p.id;
  renderPhotos();
  $("saveStatus").textContent = `Guardado ${new Date(p.updatedAt).toLocaleString("es")}`;
}

function validateProject() {
  if (!$("projectForm").reportValidity()) return false;
  return true;
}

async function saveProject(silent = false) {
  if (!validateProject()) return false;
  const p = currentProject();
  if (!p) { notify("No hay un proyecto activo", true); return false; }
  Object.assign(p, projectData(), { updatedAt: new Date().toISOString() });
  await withDb((store) => store.put(p));
  await loadProjects();
  $("saveStatus").textContent = "Guardado ahora";
  if (!silent) notify("Proyecto guardado correctamente");
  return true;
}

async function openProject(id) {
  if (!id) return;
  if (activeId && currentProject()) await saveProject(true).catch(() => {});
  const p = projects.find((item) => item.id === id);
  if (p) populate(p);
}

function newProject() {
  const p = emptyProject();
  p.code = p.date = p.place = p.inspector = p.entity = "";
  projects.unshift(p);
  populate(p);
  fields.forEach((id) => $(id).value = "");
  $("date").value = new Date().toISOString().slice(0, 10);
  $("saveStatus").textContent = "Proyecto nuevo";
  $("projectSelect").value = p.id;
  $("code").focus();
  notify("Complete los datos y guarde el proyecto");
}

async function persistAndRender(message) {
  await saveProject(true);
  renderPhotos();
  if (message) notify(message);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function dateTimeLabel(value) {
  return new Date(value).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

async function handleSelectedFiles(files, kind) {
  const valid = [...files].filter((file) => file.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|gif|bmp|webp)$/i.test(file.name));
  if (!valid.length) { notify("No se seleccionó ninguna imagen compatible", true); return; }
  pendingFiles = valid;
  $("previewDescription").value = valid.length > 1 ? `${valid.length} fotografías incorporadas` : "";
  $("previewImages").innerHTML = valid.map((file) => `<img src="${URL.createObjectURL(file)}" alt="Vista previa">`).join("");
  notify(kind === "camera" ? "Foto recibida. Revise la vista previa y confirme" : "Imagen recibida. Revise la vista previa y confirme");
  $("previewDialog").showModal();
}

async function normalizeForWord(file) {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
  if (!isHeic) return new Blob([await readFile(file)], { type: file.type || "image/jpeg" });
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = sourceUrl; });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  } finally { URL.revokeObjectURL(sourceUrl); }
}

async function confirmPhotos() {
  const p = currentProject();
  if (!p || !pendingFiles.length) return;
  const description = $("previewDescription").value.trim();
  try {
    const $confirm = $("confirmPhotoBtn");
    $confirm.disabled = true;
    for (const file of pendingFiles) {
      const blob = await normalizeForWord(file);
      p.photos.push({ id: uid(), blob, name: file.name, description, addedAt: new Date().toISOString() });
    }
    $("previewDialog").close();
    pendingFiles = [];
    await persistAndRender(`${p.photos.length} fotografía(s) guardada(s)`);
    $("previewImages").innerHTML = "";
  } catch (error) {
    console.error(error);
    notify("La imagen no pudo incorporarse", true);
  } finally { $("confirmPhotoBtn").disabled = false; }
}

function renderPhotos() {
  const p = currentProject();
  const photos = p?.photos || [];
  $("photoCount").textContent = `${photos.length} foto${photos.length === 1 ? "" : "s"}`;
  $("emptyState").hidden = photos.length > 0;
  $("photoList").innerHTML = photos.map((photo, index) => `
    <article class="photo-card">
      <img src="${photo.url || URL.createObjectURL(photo.blob)}" alt="Fotografía ${index + 1}">
      <div class="photo-info">
        <div class="section-heading"><strong>Foto ${index + 1}</strong><span class="status">Identificador ${esc(photo.id.slice(0,8))}</span></div>
        <p class="photo-meta">Incorporada: ${esc(dateTimeLabel(photo.addedAt))}</p>
        <label>Descripción<textarea class="photo-description" data-id="${photo.id}" rows="4" maxlength="1000">${esc(photo.description)}</textarea></label>
        <div class="photo-actions"><button data-action="download" data-id="${photo.id}" title="Descargar imagen" aria-label="Descargar fotografía">↓ Imagen</button><span>Orden</span><button data-action="up" data-id="${photo.id}" ${index === 0 ? "disabled" : ""} title="Subir" aria-label="Subir">↑</button><button data-action="down" data-id="${photo.id}" ${index === photos.length - 1 ? "disabled" : ""} title="Bajar" aria-label="Bajar">↓</button><button class="danger" data-action="delete" data-id="${photo.id}" title="Eliminar" aria-label="Eliminar">×</button></div>
      </div>
    </article>`).join("");
  photos.forEach((photo) => photo.url ||= URL.createObjectURL(photo.blob));
}

function downloadPhoto(photo, index) {
  const extension = photo.blob.type === "image/png" ? "png" : photo.blob.type === "image/gif" ? "gif" : photo.blob.type === "image/bmp" ? "bmp" : "jpg";
  const projectCode = (currentProject()?.code || "practica").replace(/[^a-z0-9_-]/gi, "_");
  const url = URL.createObjectURL(photo.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${projectCode}_foto_${String(index + 1).padStart(2, "0")}.${extension}`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  notify(`Descargando fotografía ${index + 1}`);
}

async function updatePhoto(id, action) {
  const p = currentProject();
  const index = p.photos.findIndex((x) => x.id === id);
  if (index < 0) return;
  if (action === "download") {
    downloadPhoto(p.photos[index], index);
    return;
  }
  if (action === "delete") {
    if (!confirm(`¿Eliminar la fotografía ${index + 1}?`)) return;
    p.photos.splice(index, 1);
  } else {
    const target = action === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= p.photos.length) return;
    [p.photos[index], p.photos[target]] = [p.photos[target], p.photos[index]];
  }
  await persistAndRender(action === "delete" ? "Fotografía eliminada" : "Orden actualizado");
}

async function saveDescriptions() {
  const p = currentProject();
  if (!p) return;
  document.querySelectorAll(".photo-description").forEach((input) => {
    const photo = p.photos.find((x) => x.id === input.dataset.id);
    if (photo) photo.description = input.value;
  });
  await saveProject(true);
}

async function prepareImage(blob) {
  const data = new Uint8Array(await blob.arrayBuffer());
  let kind = "jpeg";
  if (data[0] === 0x89 && data[1] === 0x50) kind = "png";
  else if (data[0] === 0x47 && data[1] === 0x49) kind = "gif";
  else if (data[0] === 0x42 && data[1] === 0x4d) kind = "bmp";
  const type = kind === "png" ? "image/png" : kind === "gif" ? "image/gif" : kind === "bmp" ? "image/bmp" : "image/jpeg";
  const bits = kind === "png" ? getPngSize(data) : kind === "jpeg" ? await getJpegSize(blob) : null;
  return { data, kind, type, cx: bits?.w || 1, cy: bits?.h || 1 };
}

function getPngSize(data) { return { w: (data[16]<<24|(data[17]<<16)|(data[18]<<8)|data[19]) >>> 0, h: (data[20]<<24|(data[21]<<16)|(data[22]<<8)|data[23]) >>> 0 }; }
async function getJpegSize(blob) {
  const bitmap = await createImageBitmap(blob);
  const result = { w: bitmap.width, h: bitmap.height }; bitmap.close?.(); return result;
}

const crcTable = (() => { const t=[]; for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;} return t; })();
function crc32(bytes) { let c=0xffffffff; for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
function dosTime(date) { return ((date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()/2))&0xffff; }
function dosDate(date) { return (((date.getFullYear()-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate())&0xffff; }
function utf8(text) { return new TextEncoder().encode(text); }

function zip(entries) {
  const chunks=[], central=[]; let offset=0;
  for (const entry of entries) {
    const name=utf8(entry.name), data=entry.data, crc=crc32(data), now=new Date();
    const local=new Uint8Array(30+name.length); const lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(6,0x0800,true); lv.setUint16(8,0,true); lv.setUint16(10,dosTime(now),true); lv.setUint16(12,dosDate(now),true); lv.setUint32(14,crc,true); lv.setUint32(18,data.length,true); lv.setUint32(22,data.length,true); lv.setUint16(26,name.length,true); local.set(name,30); chunks.push(local,data);
    const cd=new Uint8Array(46+name.length), cv=new DataView(cd.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true); cv.setUint16(8,0x0800,true); cv.setUint16(10,0,true); cv.setUint16(12,dosTime(now),true); cv.setUint16(14,dosDate(now),true); cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true); cv.setUint16(28,name.length,true); cv.setUint32(42,offset,true); cd.set(name,46); central.push(cd); offset += local.length+data.length;
  }
  const centralData=joinBytes(central), end=new Uint8Array(22), ev=new DataView(end.buffer); ev.setUint32(0,0x06054b50,true); ev.setUint16(8,entries.length,true); ev.setUint16(10,entries.length,true); ev.setUint32(12,centralData.length,true); ev.setUint32(16,offset,true);
  return joinBytes([...chunks,centralData,end]);
}
function joinBytes(parts){const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}

function relationshipXml(images) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${images.map((image,i)=>`<Relationship Id="rId${i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i+1}.${image.kind}"/>`).join("")}</Relationships>`;
}

function docParagraph(text, style) { return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`; }
function imageParagraph(index, image) {
  const maxW=6200000, maxH=8200000, scale=Math.min(maxW/image.cx,maxH/image.cy); const cx=Math.round(image.cx*scale), cy=Math.round(image.cy*scale);
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${index+1}" name="Fotografía ${index+1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${index+1}" name="foto${index+1}.${image.kind}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${index+2}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

async function exportDocx() {
  await saveDescriptions();
  const p = currentProject();
  if (!p) { notify("Seleccione o cree un proyecto antes de exportar", true); return; }
  if (!validateProject()) { notify("Complete todos los datos obligatorios del proyecto", true); return; }
  if (!p.photos.length) { notify("Incorpore al menos una fotografía", true); return; }
  const missingDescriptions = p.photos
    .map((photo, index) => photo.description.trim() ? null : index + 1)
    .filter(Boolean);
  if (missingDescriptions.length) {
    notify(`Agregue la descripción de la fotografía ${missingDescriptions.join(", ")}`, true);
    document.querySelectorAll('.photo-description').forEach((input, index) => {
      if (!input.value.trim() && missingDescriptions.includes(index + 1)) input.focus();
    });
    return;
  }
  const button = $("exportBtn"); button.disabled = true; button.textContent = "Generando documento…";
  try {
    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
      ImageRun, WidthType, AlignmentType, BorderStyle
    } = docx;
    const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
    const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
    const children = [
      new Paragraph({ text: `ANEXO FOTOGRÁFICO — ${p.code}`, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Fecha: ${p.date}`, spacing: { after: 120 } }),
      new Paragraph(`Lugar: ${p.place}`),
      new Paragraph(`Fiscalizador: ${p.inspector}`),
      new Paragraph({ text: `Establecimiento / unidad: ${p.entity}`, spacing: { after: 240 } })
    ];

    for (let i = 0; i < p.photos.length; i++) {
      const photo = p.photos[i];
      const image = await prepareImage(photo.blob);
      const fittedWidth = 650;
      const fittedHeight = Math.round(fittedWidth * image.cy / image.cx);
      const imageCell = new TableCell({
        columnSpan: 2,
        shading: { fill: "F6F7F8" },
        margins: { top: 240, bottom: 240, left: 240, right: 240 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: image.data, transformation: { width: fittedWidth, height: fittedHeight }, type: image.kind })]
        })]
      });
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        indent: { size: 0, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [imageCell] }),
          new TableRow({ children: [
            new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: `Foto N.º ${String(i + 1).padStart(2, "0")}`, bold: true })] })] }),
            new TableCell({ width: { size: 82, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph(photo.description || "")] })
          ] })]
      }));
    }

    const blob = await Packer.toBlob(new Document({ creator: "Aplicación de fiscalización", title: `Anexo fotográfico — ${p.code}`, sections: [{ children }] }));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Anexo_fotografico_${(p.code || "practica").replace(/[^a-z0-9_-]/gi, "_")}.docx`;
    link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    notify("Documento Word generado correctamente");
  } catch (error) { console.error(error); notify("No fue posible generar el Word", true); }
  finally { button.disabled = false; button.textContent = "Descargar anexo Word (.docx)"; }
}

["camera","gallery"].forEach((kind) => {
  $(`${kind}Btn`).addEventListener("click", () => {
    const input = $(`${kind}Input`);
    input.value = "";
    input.click();
  });
});
$("cameraInput").addEventListener("change", (e) => {
  handleSelectedFiles(e.target.files, "camera");
  e.target.value = "";
});
$("galleryInput").addEventListener("change", (e) => {
  handleSelectedFiles(e.target.files, "gallery");
  e.target.value = "";
});
$("cameraInput").addEventListener("cancel", () => notify("Captura cancelada. Puede continuar con el proyecto"));
$("galleryInput").addEventListener("cancel", () => notify("Selección cancelada. Puede continuar con el proyecto"));
$("confirmPhotoBtn").addEventListener("click", confirmPhotos);
$("cancelPreviewBtn").addEventListener("click", () => { $("previewDialog").close(); pendingFiles=[]; URL.revokeObjectURL($("previewImages").querySelector("img")?.src); notify("Incorporación cancelada"); });
$("closePreviewBtn").addEventListener("click", () => { $("previewDialog").close(); pendingFiles=[]; });
$("saveProjectBtn").addEventListener("click", () => saveProject());
$("newProjectBtn").addEventListener("click", newProject);
$("projectSelect").addEventListener("change", (e) => openProject(e.target.value));
$("photoList").addEventListener("change", (e) => { if(e.target.matches(".photo-description")) saveDescriptions(); });
$("photoList").addEventListener("click", (e) => { const button=e.target.closest("[data-action]"); if(button) updatePhoto(button.dataset.id,button.dataset.action); });
$("exportBtn").addEventListener("click", exportDocx);
fields.forEach((id) => $(id).addEventListener("input", () => $("saveStatus").textContent="Sin cambios"));

(async () => {
  try {
    await loadProjects();
    if (projects[0]) populate(projects[0]); else newProject();
  } catch (error) { console.error(error); notify("No fue posible iniciar el almacenamiento", true); }
})();
