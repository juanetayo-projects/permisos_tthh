import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { MESES, type CeldaCalor } from '@/domain/metricas'

/**
 * Mapa de calor área × mes.
 *
 * Se usa clic y no hover para abrir el detalle: en tablet —como se consulta en
 * la clínica— el hover no existe, y el patrón de "clic para ver el detrás del
 * dato" es el mismo del Panel Ejecutivo de SIAU.
 */
export function MapaCalor({
  areas,
  celdas,
  maximo,
  oscuro,
  onCelda,
  /** Qué se está contando. El módulo de ausentismo mide días, no solicitudes. */
  unidad = ['solicitud', 'solicitudes'],
}: {
  areas: string[]
  celdas: CeldaCalor[]
  maximo: number
  oscuro: boolean
  onCelda?: (area: string, mesIndice: number) => void
  unidad?: [singular: string, plural: string]
}) {
  const opciones = useMemo(() => {
    const textoColor = oscuro ? '#cbd5e1' : '#475569'

    return {
      tooltip: {
        position: 'top',
        formatter: (p: { data: [number, number, number] }) => {
          const [mes, area, valor] = p.data
          return `<b>${areas[area]}</b><br/>${MESES[mes]}: ${valor} ${valor === 1 ? unidad[0] : unidad[1]}`
        },
      },
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category',
        data: [...MESES],
        splitArea: { show: true },
        axisLabel: { color: textoColor, fontSize: 11 },
        axisLine: { lineStyle: { color: oscuro ? '#334155' : '#e2e8f0' } },
      },
      yAxis: {
        type: 'category',
        data: areas,
        splitArea: { show: true },
        axisLabel: { color: textoColor, fontSize: 11, width: 130, overflow: 'truncate' },
        axisLine: { lineStyle: { color: oscuro ? '#334155' : '#e2e8f0' } },
      },
      visualMap: {
        min: 0,
        max: maximo,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemHeight: 90,
        textStyle: { color: textoColor, fontSize: 10 },
        inRange: {
          // Degradado sobre el azul institucional.
          color: oscuro
            ? ['#1e293b', '#1d3f7a', '#16468E', '#2a63b8', '#4d86d8']
            : ['#F1F5FB', '#C9D8EF', '#8FAEDC', '#16468E', '#0D2D6B'],
        },
      },
      series: [
        {
          type: 'heatmap',
          data: celdas.map((c) => [c.mesIndice, areas.indexOf(c.area), c.valor]),
          label: {
            show: true,
            fontSize: 10,
            color: oscuro ? '#e2e8f0' : '#0f172a',
            formatter: (p: { data: [number, number, number] }) => (p.data[2] === 0 ? '' : String(p.data[2])),
          },
          itemStyle: { borderWidth: 2, borderColor: oscuro ? '#0f172a' : '#ffffff' },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(13,45,107,.4)' } },
        },
      ],
    }
  }, [areas, celdas, maximo, oscuro, unidad])

  if (areas.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay datos en el periodo seleccionado.
      </p>
    )
  }

  return (
    <ReactECharts
      option={opciones}
      style={{ height: Math.max(220, areas.length * 32 + 90) }}
      opts={{ renderer: 'canvas' }}
      onEvents={{
        click: (p: { data: [number, number, number] }) => {
          if (onCelda && Array.isArray(p.data)) onCelda(areas[p.data[1]], p.data[0])
        },
      }}
    />
  )
}
