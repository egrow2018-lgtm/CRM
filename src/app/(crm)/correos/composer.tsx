"use client";

import { useRef, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { TEMPLATE_VARIABLES, editableDocToken, fillTemplate, fromEditable, renderBody, toEditable, type TemplateValues } from "@/lib/email-compose";

type Doc = { id: string; name: string; folder: string | null };
type Template = { id: string; name: string; subject: string; body: string; line: string | null };

/** Barra de herramientas y área de texto del mensaje (también se usa en las plantillas). */
export function MessageEditor({
  value,
  onChange,
  docs,
  rows = 12,
}: {
  value: string;
  onChange: (v: string) => void;
  docs: Doc[];
  rows?: number;
}) {
  const area = useRef<HTMLTextAreaElement>(null);

  function insert(text: string, wrap = false) {
    const el = area.current!;
    const { selectionStart: a, selectionEnd: b } = el;
    const selected = value.slice(a, b);
    const piece = wrap ? `**${selected || "texto"}**` : text;
    const next = value.slice(0, a) + piece + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = a + piece.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-100">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <button type="button" className="btn btn-sm font-bold" title="Negrita (selecciona el texto primero)" onClick={() => insert("", true)}>
          B
        </button>
        <select
          data-native
          className="input w-auto py-1 text-xs"
          value=""
          onChange={(e) => {
            const d = docs.find((x) => x.id === e.target.value);
            if (d) insert(editableDocToken(d.name));
          }}
        >
          <option value="">📄 Insertar documento…</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>{d.folder ? `${d.folder} · ` : ""}{d.name}</option>
          ))}
        </select>
        <select
          data-native
          className="input w-auto py-1 text-xs"
          value=""
          onChange={(e) => e.target.value && insert(`{{${e.target.value}}}`)}
        >
          <option value="">{"{ }"} Insertar dato…</option>
          {TEMPLATE_VARIABLES.map((v) => (
            <option key={v.key} value={v.key}>{v.label}</option>
          ))}
        </select>
      </div>
      <textarea
        ref={area}
        name="body"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full resize-y rounded-b-lg border-0 px-3 py-2 text-sm outline-none"
        placeholder="Escribe tu mensaje…"
      />
    </div>
  );
}

/** Vista previa con el formato final (los enlaces no funcionan aquí). */
export function MessagePreview({ text, docs, values }: { text: string; docs: Doc[]; values?: TemplateValues }) {
  const body = fromEditable(values ? fillTemplate(text, values) : text, docs);
  const html = renderBody(body, {
    doc: (id) => {
      const d = docs.find((x) => x.id === id);
      return d ? { name: d.name, href: "#" } : null;
    },
  });
  return (
    <div
      className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800 [&_a]:pointer-events-none"
      dangerouslySetInnerHTML={{ __html: html || '<span style="color:#94a3b8">La vista previa aparecerá aquí.</span>' }}
    />
  );
}

export function Composer({
  action,
  sender,
  initialTo,
  values,
  templates,
  docs,
  brands,
  initialBody,
  hidden,
  context,
}: {
  action: Parameters<typeof ActionForm>[0]["action"];
  sender: string;
  initialTo: string;
  values: TemplateValues;
  templates: Template[];
  docs: Doc[];
  brands: { value: string; label: string }[];
  initialBody: string;
  hidden: Record<string, string>;
  context: string | null;
}) {
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(initialBody);
  const [showCc, setShowCc] = useState(false);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return setTemplateId("");
    if (body.trim() && body !== initialBody && !confirm("¿Reemplazar el mensaje que escribiste por la plantilla?")) return;
    setTemplateId(id);
    setSubject(fillTemplate(t.subject, values));
    setBody(fillTemplate(toEditable(t.body, docs), values));
  }

  return (
    <ActionForm action={action} className="grid gap-4 lg:grid-cols-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="templateId" value={templateId} />
      <div className="space-y-3">
        {context && <p className="text-sm text-slate-500">{context}</p>}
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-sm">
          <span className="text-slate-500">De</span>
          <span className="truncate text-slate-700">{sender}</span>
          <label htmlFor="to" className="text-slate-500">Para</label>
          <span className="flex gap-2">
            <input id="to" name="to" required defaultValue={initialTo} className="input" placeholder="correo@cliente.com (varios separados por coma)" />
            {!showCc && <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setShowCc(true)}>CC</button>}
          </span>
          {showCc && (
            <>
              <label htmlFor="cc" className="text-slate-500">CC</label>
              <input id="cc" name="cc" className="input" placeholder="Copia (opcional)" />
            </>
          )}
          <label htmlFor="tpl" className="text-slate-500">Plantilla</label>
          <select id="tpl" value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="input">
            <option value="">Sin plantilla</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.line ? `${t.line} · ` : ""}{t.name}</option>
            ))}
          </select>
          <label htmlFor="subject" className="text-slate-500">Asunto</label>
          <input id="subject" name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
        </div>
        <MessageEditor value={body} onChange={setBody} docs={docs} />
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-sm">
          <label htmlFor="brand" className="text-slate-500">Diseño</label>
          <select id="brand" name="brand" defaultValue="" className="input">
            {brands.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Tip: selecciona un texto y pulsa <b>B</b> para ponerlo en negrita. Los documentos se envían como enlace con su nombre en negrita: sabrás quién
          lo abrió y cuánto tiempo pasó en cada página. Recibirás una copia en tu correo y un aviso cuando lo abran.
        </p>
        <SubmitButton pendingText="Enviando…">Enviar correo</SubmitButton>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">Vista previa</div>
        <div className="mb-2 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 px-4 py-2 text-sm">
          <b>{subject || "(sin asunto)"}</b>
        </div>
        <MessagePreview text={body} docs={docs} values={values} />
      </div>
    </ActionForm>
  );
}
