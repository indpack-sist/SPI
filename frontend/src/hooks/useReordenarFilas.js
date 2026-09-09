import { useRef, useState } from 'react';

export default function useReordenarFilas(setFilas) {
  const origenRef = useRef(null);
  const [indiceArrastrado, setIndiceArrastrado] = useState(null);

  const limpiarArrastre = () => {
    origenRef.current = null;
    setIndiceArrastrado(null);
  };

  const finalizarArrastre = (event) => {
    event.preventDefault();
    limpiarArrastre();
  };

  const iniciarArrastre = (event, index) => {
    origenRef.current = index;
    setIndiceArrastrado(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));

    // El navegador normalmente mostraría solo el asa como imagen de arrastre.
    // Usamos la fila completa para que producto, cantidad y precio acompañen al cursor.
    const fila = event.currentTarget.closest('tr');
    if (fila) event.dataTransfer.setDragImage(fila, 24, fila.offsetHeight / 2);
  };

  const moverDuranteArrastre = (event, index) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const origen = origenRef.current;
    if (origen === null) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const insertarDespues = event.clientY > rect.top + rect.height / 2;
    const puntoInsercion = index + (insertarDespues ? 1 : 0);
    const nuevaPosicion = origen < puntoInsercion ? puntoInsercion - 1 : puntoInsercion;
    if (nuevaPosicion === origen) return;

    const cuerpoTabla = event.currentTarget.parentElement;
    const posicionesPrevias = new Map(
      Array.from(cuerpoTabla?.children || []).map(fila => [fila, fila.getBoundingClientRect().top])
    );

    origenRef.current = nuevaPosicion;
    setIndiceArrastrado(nuevaPosicion);
    setFilas(filas => {
      if (origen < 0 || origen >= filas.length) return filas;
      const posicionFinal = Math.max(0, Math.min(nuevaPosicion, filas.length - 1));
      const nuevasFilas = [...filas];
      const [filaMovida] = nuevasFilas.splice(origen, 1);
      nuevasFilas.splice(posicionFinal, 0, filaMovida);
      return nuevasFilas;
    });

    // Anima desde la ubicación anterior hasta la nueva después de que React
    // haya reordenado las filas. Así el desplazamiento no se percibe como un salto.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      requestAnimationFrame(() => {
        Array.from(cuerpoTabla?.children || []).forEach(fila => {
          const posicionAnterior = posicionesPrevias.get(fila);
          if (posicionAnterior === undefined) return;
          const desplazamiento = posicionAnterior - fila.getBoundingClientRect().top;
          if (Math.abs(desplazamiento) < 1) return;
          fila.animate?.(
            [
              { transform: `translateY(${desplazamiento}px)` },
              { transform: 'translateY(0)' }
            ],
            { duration: 170, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
          );
        });
      });
    }
  };

  return {
    indiceArrastrado,
    iniciarArrastre,
    moverDuranteArrastre,
    finalizarArrastre,
    cancelarArrastre: limpiarArrastre
  };
}
