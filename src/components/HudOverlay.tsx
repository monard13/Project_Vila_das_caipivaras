import React from 'react';
import type { ViewPresetName } from '../utils/cameraMath';

export interface HudOverlayProps {
  activeView: ViewPresetName | null;
  sunset: boolean;
  showLabels: boolean;
  bloomEnabled: boolean;
  soundMuted: boolean;
  hintVisible: boolean;
  loaderState: 'visible' | 'fading' | 'hidden';
  hudCollapsed: boolean;
  needleRef: React.RefObject<HTMLDivElement | null>;
  onSelectView: (view: ViewPresetName) => void;
  onToggleSunset: () => void;
  onToggleLabels: () => void;
  onToggleBloom: () => void;
  onToggleSound: () => void;
  onExportPng: () => void;
  onToggleFullscreen: () => void;
  onToggleHudCollapsed: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  activeView,
  sunset,
  showLabels,
  bloomEnabled,
  soundMuted,
  hintVisible,
  loaderState,
  hudCollapsed,
  needleRef,
  onSelectView,
  onToggleSunset,
  onToggleLabels,
  onToggleBloom,
  onToggleSound,
  onExportPng,
  onToggleFullscreen,
  onToggleHudCollapsed,
}) => {
  return (
    <>
      {!hudCollapsed && (
        <header className="vc-card" aria-label="Ficha del proyecto Vila Capivaras">
          <div className="vc-eyebrow">Idea A · Rediseño — render conceptual 3D</div>
          <h1>Vila Capivaras</h1>
          <div className="vc-sub">
            Paseo comercial-gastronómico · gym + rooftop · flats — Lagoa das Capivaras, Búzios (RJ)
          </div>
          <div className="vc-chips">
            <span className="vc-chip">
              ≈ <b>4.648 m²</b> · Lotes 4–9, Quadra C
            </span>
            <span className="vc-chip">
              Acceso único <b>frente a la laguna</b>
            </span>
            <span className="vc-chip">
              PB <b>~1.200 m²</b> comercial
            </span>
            <span className="vc-chip">
              P2 fondo: <b>gym ≈220 m²</b> + rooftop
            </span>
            <span className="vc-chip">
              PA <b>6–8 flats</b> · terrazas
            </span>
            <span className="vc-chip">
              <b>~60–70</b> plazas parking
            </span>
          </div>
        </header>
      )}

      <nav className="vc-controls" aria-label="Controles de cámara y escena">
        {!hudCollapsed && (
          <>
            <div className="vc-group" role="group" aria-label="Vistas predefinidas">
              <button
                id="v-aerea"
                type="button"
                className={activeView === 'aerea' ? 'on' : ''}
                title="Vista aérea"
                onClick={() => onSelectView('aerea')}
              >
                Vista aérea
              </button>
              <button
                id="v-paseo"
                type="button"
                className={activeView === 'paseo' ? 'on' : ''}
                title="A nivel de peatón dentro del paseo"
                onClick={() => onSelectView('paseo')}
              >
                En el paseo
              </button>
              <button
                id="v-laguna"
                type="button"
                className={activeView === 'laguna' ? 'on' : ''}
                title="Desde la Lagoa das Capivaras"
                onClick={() => onSelectView('laguna')}
              >
                Desde la laguna
              </button>
              <button
                id="v-rooftop"
                type="button"
                className={activeView === 'rooftop' ? 'on' : ''}
                title="Rooftop fitness sobre el gimnasio"
                onClick={() => onSelectView('rooftop')}
              >
                Rooftop
              </button>
            </div>

            <div className="vc-group" role="group" aria-label="Opciones de visualización">
              <button
                id="b-sunset"
                type="button"
                className={sunset ? 'on' : ''}
                title="Alternar luz de día / atardecer"
                onClick={onToggleSunset}
              >
                {sunset ? '☾ Día' : '☀ Atardecer'}
              </button>
              <button
                id="b-bloom"
                type="button"
                className={bloomEnabled ? 'on' : ''}
                title="Alternar post-procesado Bloom en luces y materiales (tecla B)"
                aria-pressed={bloomEnabled}
                onClick={onToggleBloom}
              >
                ✨ Bloom
              </button>
              <button
                id="b-labels"
                type="button"
                className={showLabels ? 'on' : ''}
                title="Mostrar u ocultar etiquetas"
                onClick={onToggleLabels}
              >
                Etiquetas
              </button>
              <button
                id="b-sound"
                type="button"
                className={!soundMuted ? 'on' : ''}
                title={
                  soundMuted
                    ? 'Activar música Bossa Nova (tecla M)'
                    : 'Silenciar música Bossa Nova (tecla M)'
                }
                aria-label={
                  soundMuted
                    ? 'Activar música Bossa Nova'
                    : 'Silenciar música Bossa Nova'
                }
                aria-pressed={!soundMuted}
                onClick={onToggleSound}
              >
                {soundMuted ? '🔇 Música' : '🎵 Música'}
              </button>
              <button
                id="b-png"
                type="button"
                className="icon"
                title="Exportar imagen PNG"
                aria-label="Exportar imagen PNG"
                onClick={onExportPng}
              >
                📸 PNG
              </button>
              <button
                id="b-full"
                type="button"
                className="icon"
                title="Pantalla completa"
                aria-label="Pantalla completa"
                onClick={onToggleFullscreen}
              >
                ⛶
              </button>
              <button
                id="b-zen"
                type="button"
                className="icon"
                title="Ocultar paneles superpuestos (Modo Zen)"
                aria-label="Ocultar paneles"
                onClick={onToggleHudCollapsed}
              >
                ▾ UI
              </button>
            </div>
          </>
        )}

        {hudCollapsed && (
          <div className="vc-group">
            <button
              id="b-zen-restore"
              type="button"
              className="on"
              title="Mostrar paneles de control"
              onClick={onToggleHudCollapsed}
            >
              ▴ Mostrar controles
            </button>
          </div>
        )}
      </nav>

      <div className="vc-compass" aria-hidden="true">
        <div className="vc-needle" id="needle" ref={needleRef} />
      </div>

      {!hudCollapsed && (
        <div
          className="vc-hint"
          id="hint"
          style={{ opacity: hintVisible ? 1 : 0 }}
        >
          Arrastra para orbitar · rueda / pellizco para zoom · clic derecho para desplazar
        </div>
      )}

      {!hudCollapsed && (
        <footer className="vc-legal">
          <b>Visualización conceptual no vinculante</b> — no constituye proyecto aprobado. Volumetría, áreas y plazas aproximadas,
          sujetas a verificación urbanística (LUOS Búzios: TO/TI y gabarito; <b>art. 26</b> — galería con acceso por un solo logradouro y
          circulación ≥ 5 m; Anexo 3 — estacionamiento: 1/25 m² comercio · 1/20 m² salón restaurante · 2/flat · academia según Anexo 3) y{' '}
          <b>ambiental (Termo de Preservação de Floresta IBDF, 1983</b>, averbado en las matrículas). Situación judicial: ver caveats del resumen ejecutivo.
          Marcas y locatarios mostrados son ficticios e ilustrativos.
        </footer>
      )}

      {loaderState !== 'hidden' && (
        <div
          className="vc-loader"
          id="loader"
          style={{ opacity: loaderState === 'fading' ? 0 : 1 }}
        >
          <h2>Vila Capivaras</h2>
          <div className="vc-bar">
            <i />
          </div>
          <p>Preparando la maqueta 3D…</p>
        </div>
      )}
    </>
  );
};
