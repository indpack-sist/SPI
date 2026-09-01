import { useEffect, useState } from 'react';
import ubigeos from '../../data/ubigeos.json';

/**
 * Selector de UBIGEO en cascada Departamento → Provincia → Distrito.
 * Arma el código INEI de 6 dígitos (2 depto + 2 prov + 2 distrito) que SUNAT exige en la GRE.
 *
 * @param {string}   value     código de 6 dígitos actual (o '' si incompleto). Prellenable.
 * @param {function} onChange  (codigo6|'' , meta) — meta = {departamento, provincia, distrito} (nombres).
 * @param {boolean}  required
 */
export default function UbigeoSelector({ value = '', onChange, required = false }) {
  const [dep, setDep] = useState('');
  const [prov, setProv] = useState('');
  const [dist, setDist] = useState('');

  // Sincroniza desde un value externo completo (p. ej. prellenado desde la orden).
  useEffect(() => {
    if (value && value.length === 6 && value !== dist) {
      setDep(value.slice(0, 2));
      setProv(value.slice(0, 4));
      setDist(value);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const provincias = dep ? (ubigeos.provincias[dep] || []) : [];
  const distritos = prov ? (ubigeos.distritos[prov] || []) : [];

  const emit = (codigo) => {
    if (!onChange) return;
    const meta = codigo
      ? {
          departamento: ubigeos.departamentos.find((d) => d.codigo === codigo.slice(0, 2))?.nombre,
          provincia: (ubigeos.provincias[codigo.slice(0, 2)] || []).find((p) => p.codigo === codigo.slice(0, 4))?.nombre,
          distrito: (ubigeos.distritos[codigo.slice(0, 4)] || []).find((x) => x.codigo === codigo)?.nombre,
        }
      : {};
    onChange(codigo, meta);
  };

  const onDep = (e) => { setDep(e.target.value); setProv(''); setDist(''); emit(''); };
  const onProv = (e) => { setProv(e.target.value); setDist(''); emit(''); };
  const onDist = (e) => { const v = e.target.value; setDist(v); emit(v); };

  const depNombre = ubigeos.departamentos.find((d) => d.codigo === dep)?.nombre;
  const provNombre = provincias.find((p) => p.codigo === prov)?.nombre;
  const distNombre = distritos.find((x) => x.codigo === dist)?.nombre;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <div className="form-group">
          <label className="form-label">Departamento {required && '*'}</label>
          <select className="form-input" value={dep} onChange={onDep} required={required}>
            <option value="">Seleccione</option>
            {ubigeos.departamentos.map((d) => (
              <option key={d.codigo} value={d.codigo}>{d.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Provincia {required && '*'}</label>
          <select className="form-input" value={prov} onChange={onProv} required={required} disabled={!dep}>
            <option value="">Seleccione</option>
            {provincias.map((p) => (
              <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Distrito {required && '*'}</label>
          <select className="form-input" value={dist} onChange={onDist} required={required} disabled={!prov}>
            <option value="">Seleccione</option>
            {distritos.map((x) => (
              <option key={x.codigo} value={x.codigo}>{x.nombre}</option>
            ))}
          </select>
        </div>
      </div>
      {dist && (
        <p className="text-sm text-gray-600 mt-1">
          Ubigeo: <strong>{dist}</strong> · {depNombre} / {provNombre} / {distNombre}
        </p>
      )}
    </div>
  );
}
