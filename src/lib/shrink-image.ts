/** Reduce la imagen en el navegador (máx. 1200 px de ancho) para que el correo no pese demasiado. */
export async function shrinkImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1200 / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG si es pequeña o tiene transparencia (logos); si no, JPEG que pesa menos
    const png = canvas.toDataURL("image/png");
    const data = file.type === "image/png" && png.length < 900_000 ? png : canvas.toDataURL("image/jpeg", 0.85);
    return { data, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
