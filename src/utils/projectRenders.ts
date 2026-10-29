import type { ViewPresetName } from './cameraMath';

export type ProjectRenderId = 'lagoa' | 'lagoa2' | 'pasagem' | 'terraso';

export interface ProjectRenderItem {
  id: ProjectRenderId;
  title: string;
  shortLabel: string;
  subtitle: string;
  imageUrl: string;
  cameraView: ViewPresetName;
  hotspotPos: { x: number; y: number; z: number };
  rotationY: number;
}

export const PROJECT_RENDERS: readonly ProjectRenderItem[] = [
  {
    id: 'lagoa',
    title: 'Vista Panorámica desde la Laguna y Entorno Búzios',
    shortLabel: 'Laguna Panorámica',
    subtitle:
      'Implantación general frente a la Lagoa das Capivaras con morros y mar de Búzios al fondo, calles laterales y estacionamientos',
    imageUrl: '/assets/aistudio/Lagoa_f88fe289.jpg',
    cameraView: 'laguna',
    hotspotPos: { x: -9.5, y: 2.1, z: -38.4 },
    rotationY: 0.28,
  },
  {
    id: 'lagoa2',
    title: 'Frente a la Laguna y Pórtico de Acceso',
    shortLabel: 'Frente Laguna',
    subtitle:
      'Vista frontal desde la orla de la Lagoa das Capivaras — cruce peatonal, pórtico Vila Capivaras y restaurantes ancla',
    imageUrl: '/assets/aistudio/Lagoa2_9326774f.jpg',
    cameraView: 'laguna',
    hotspotPos: { x: 9.5, y: 2.1, z: -38.4 },
    rotationY: -0.28,
  },
  {
    id: 'pasagem',
    title: 'Paseo Peatonal Central',
    shortLabel: 'Paseo Peatonal',
    subtitle:
      'Galería interior ≥ 5 m (art. 26 LUOS) — locales en PB, flats en madera en PA, fuente central y palmeras',
    imageUrl: '/assets/aistudio/Vila_caipivaras_pasagem_35fc67ff.jpg',
    cameraView: 'paseo',
    hotspotPos: { x: -5.4, y: 2.0, z: -14.2 },
    rotationY: 0.35,
  },
  {
    id: 'terraso',
    title: 'Rooftop Fitness & Terraza con Vista a la Laguna y Mar de Búzios',
    shortLabel: 'Rooftop & Terraza',
    subtitle:
      'Terraza sobre gimnasio Vila Fit (P2) — área de calistenia, deck de madera y pérgola blanca con vista panorámica a la Lagoa das Capivaras y playas de Búzios',
    imageUrl: '/assets/aistudio/Terraso_f020d851.jpg',
    cameraView: 'rooftop',
    hotspotPos: { x: 11.4, y: 10.1, z: 20.6 },
    rotationY: -0.45,
  },
] as const;

export function getRenderById(id: ProjectRenderId): ProjectRenderItem {
  return PROJECT_RENDERS.find((r) => r.id === id) ?? PROJECT_RENDERS[0];
}

export function getRenderForView(
  view: ViewPresetName | null,
): ProjectRenderItem | undefined {
  if (!view) return undefined;
  return PROJECT_RENDERS.find((r) => r.cameraView === view);
}

export function getNextRenderId(currentId: ProjectRenderId): ProjectRenderId {
  const idx = PROJECT_RENDERS.findIndex((r) => r.id === currentId);
  const nextIdx = (idx + 1) % PROJECT_RENDERS.length;
  return PROJECT_RENDERS[nextIdx].id;
}

export function getPrevRenderId(currentId: ProjectRenderId): ProjectRenderId {
  const idx = PROJECT_RENDERS.findIndex((r) => r.id === currentId);
  const prevIdx = (idx - 1 + PROJECT_RENDERS.length) % PROJECT_RENDERS.length;
  return PROJECT_RENDERS[prevIdx].id;
}
