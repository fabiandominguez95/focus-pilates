import React, { useState } from 'react';
import { useApp } from './store';
import { Sheet, Field } from './ui';
import { SlotPicker, useClassOps, useSlotCheck } from './classes';
import { RenewSheet } from './subs';
import { PersonaPicker } from './picker';
import { normPhone } from './util';

export function NuevaPersona({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { d, cfg, hoy, ins, toast } = useApp(); const ops = useClassOps(); const { check, node } = useSlotCheck();
  const [nombre, setNombre] = useState(''); const [cel, setCel] = useState(''); const [tutor, setTutor] = useState(''); const [modo, setModo] = useState<'prueba' | 'directo' | 'datos'>('prueba'); const [f, setF] = useState(hoy); const [h, setH] = useState(''); const [nota, setNota] = useState(''); const [busy, setBusy] = useState(false);
  const [renewP, setRenewP] = useState<any>(null);
  const dup = d.personas.find((p: any) => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  const guardar = async () => {
    if (!nombre.trim()) return; if (modo === 'prueba' && h && !(await check(f, h))) return;
    setBusy(true);
    try {
      const p = await ins('personas', { nombre: nombre.trim(), celular: normPhone(cel, cfg.pais_tel) || null, tutor_id: tutor || null, notas: nota || null, origen: 'app', fecha_alta: hoy, prueba_fecha: modo === 'prueba' && h ? f : null, sin_prueba: modo === 'directo' });
      if (modo === 'prueba' && h) await ops.crear({ persona_id: p.id, fecha: f, hora: h, tipo: 'prueba' });
      if (modo === 'directo') { setRenewP(p); return; }
      toast('Cliente creado'); onCreated(p.id);
    } catch (e: any) { toast('Error: ' + e.message); } finally { setBusy(false); }
  };
  if (renewP) return <RenewSheet persona={renewP} onClose={() => { onCreated(renewP.id); }} />;
  return (
    <Sheet title="Nuevo cliente" onClose={onClose}>{node}
      <div className="stack">
        <Field label="Nombre y apellido"><input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />{dup && <em className="warn">Ya existe alguien con ese nombre.</em>}</Field>
        <Field label="Celular" hint="Con o sin el 0 inicial; se guarda con código de país"><input inputMode="tel" value={cel} onChange={(e) => setCel(e.target.value)} /></Field>
        <Field label="Tutor (si es menor)" hint="Buscá a la persona; si todavía no está cargada, podés crearla desde acá."><PersonaPicker value={tutor} onChange={setTutor} /></Field>
        <Field label="Notas"><input value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
        <Field label="¿Cómo empieza?"><div className="chips wrap">{([['prueba', 'Clase de prueba'], ['directo', 'Se inscribe directo (sin prueba)'], ['datos', 'Solo guardar datos']] as const).map(([k, l]) => <button type="button" key={k} className={'chip' + (modo === k ? ' on' : '')} onClick={() => setModo(k)}>{l}</button>)}</div></Field>
        {modo === 'prueba' && <SlotPicker fecha={f} hora={h} onChange={(a, b) => { setF(a); setH(b); }} />}
        {modo === 'directo' && <div className="muted small">Al continuar elegís plan, monto, días y horarios.</div>}
        <button className="btn big" disabled={busy || !nombre.trim()} onClick={guardar}>{modo === 'directo' ? 'Continuar a inscripción →' : 'Crear'}</button>
      </div>
    </Sheet>
  );
}

