import { useRef, useState } from 'react';

export default function useReordenarFilas(setFilas) {
  const origenRef = useRef(null);
  const destinoRef = useRef(null);
  const [indiceArrastrado, setIndiceArrastrado] = useState(null);
  const [destinoArrastre, setDestinoArrastre] = useState(null);

  const limpiarArrastre = () => {
    origenRef.current = null;
    destinoRef.current = null;
    setIndiceArrastrado(null);
    setDestinoArrastre(null);
  };

  const iniciarArrastre = (event, index) => {
    origenRef.current = index;
    destinoRef.current = index;
    setIndiceArrastrado(index);
    setDestinoArrastre(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const marcarDestino = (event, index) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const insertarDespues = event.clientY > rect.top + rect.height / 2;
    const nuevoDestino = index + (insertarDespues ? 1 : 0);
    destinoRef.current = nuevoDestino;
    setDestinoArrastre(nuevoDestino);
  };

  const soltarFila = (event) => {
    event.preventDefault();
    const origen = origenRef.current;
    const destino = destinoRef.current;

    if (origen !== null && destino !== null) {
      setFilas(filas => {
        if (origen < 0 || origen >= filas.length) return filas;
        const nuevasFilas = [...filas];
        const [filaMovida] = nuevasFilas.splice(origen, 1);
        const destinoAjustado = Math.max(
          0,
          Math.min(origen < destino ? destino - 1 : destino, nuevasFilas.length)
        );
        nuevasFilas.splice(destinoAjustado, 0, filaMovida);
        return nuevasFilas;
      });
    }

    limpiarArrastre();
  };

  const obtenerPosicionDestino = (totalFilas) => {
    const origen = origenRef.current;
    const destino = destinoRef.current;
    if (origen === null || destino === null) return null;
    const destinoAjustado = origen < destino ? destino - 1 : destino;
    return Math.max(1, Math.min(destinoAjustado + 1, totalFilas));
  };

  return {
    indiceArrastrado,
    destinoArrastre,
    iniciarArrastre,
    marcarDestino,
    soltarFila,
    obtenerPosicionDestino,
    cancelarArrastre: limpiarArrastre
  };
}
