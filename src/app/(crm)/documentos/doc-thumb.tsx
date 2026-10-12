const EXT: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPT",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOC",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLS",
};

/** Miniatura de la primera página o, si no hay, el tipo de archivo. */
export function DocThumb({ src, mime, className = "h-8 w-12" }: { src: string | null; mime: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${className} shrink-0 rounded border border-slate-200 bg-white object-cover object-top`} />;
  }
  return (
    <span className={`${className} inline-flex shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400`}>
      {EXT[mime] ?? (mime.startsWith("image/") ? "IMG" : "ARCH")}
    </span>
  );
}
