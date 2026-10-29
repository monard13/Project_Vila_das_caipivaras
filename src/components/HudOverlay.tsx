import React from 'react';
import type { ViewPresetName } from '../utils/cameraMath';
import {
  PROJECT_RENDERS,
  getRenderById,
  type ProjectRenderId,
} from '../utils/projectRenders';

export interface HudOverlayProps {
  activeView: ViewPresetName | null;
  sunset: boolean;
  showLabels: boolean;
  bloomEnabled: boolean;
  soundMuted: boolean;
  selectedRenderId: ProjectRenderId | null;
  renderCompareMode: boolean;
  hintVisible: boolean;
  loaderState: 'visible' | 'fading' | 'hidden';
  hudCollapsed: boolean;
  needleRef: React.RefObject<HTMLDivElement | null>;
  onSelectView: (view: ViewPresetName) => void;
  onToggleSunset: () => void;
  onToggleLabels: () => void;
  onToggleBloom: () => void;
  onToggleSound: () => void;
  onSelectRender: (id: ProjectRenderId | null) => void;
  onCycleRender: (dir: 'prev' | 'next') => void;
  onToggleRenderCompareMode: () => void;
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
  selectedRenderId,
  renderCompareMode,
  hintVisible,
  loaderState,
  hudCollapsed,
  needleRef,
  onSelectView,
  onToggleSunset,
  onToggleLabels,
  onToggleBloom,
  onToggleSound,
  onSelectRender,
  onCycleRender,
  onToggleRenderCompareMode,
  onExportPng,
  onToggleFullscreen,
  onToggleHudCollapsed,
}) => {
  const activeRender = selectedRenderId ? getRenderById(selectedRenderId) : null;

  return (
    <>
      {!hudCollapsed && (
        <div className="vc-left-stack">
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

          <section
            id="vc-renders-dock"
            className="vc-renders-dock"
            aria-label="Renders fotorrealistas integrados en la maqueta"
          >
            <div className="vc-renders-dock-head">
              <span>🖼️ Renders Fotorrealistas ({PROJECT_RENDERS.length})</span>
              <span className="vc-renders-dock-sub">Clic para ver y alinear 3D</span>
            </div>
            <div className="vc-renders-grid">
              {PROJECT_RENDERS.map((item) => {
                const isSelected = selectedRenderId === item.id;
                return (
                  <button
                    key={item.id}
                    id={`render-thumb-${item.id}`}
                    type="button"
                    data-render-id={item.id}
                    className={`vc-render-thumb ${isSelected ? 'active' : ''}`}
                    onClick={() => onSelectRender(isSelected ? null : item.id)}
                    title={`${item.title} — Clic para visualizar`}
                  >
                    <img src={item.imageUrl} alt={item.title} loading="eager" />
                    <span className="vc-render-thumb-label">{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <nav className="vc-controls" aria-label="Controles de cámara y escena">
        {!hudCollapsed && (
          <>
            <div className="vc-group" role="group" aria-label="Vistas predefinidas">
              <button
                id="v-aerea"
                type="button"
                data-view="aerea"
                className={activeView === 'aerea' ? 'on' : ''}
                title="Vista aérea"
                onClick={() => onSelectView('aerea')}
              >
                Vista aérea
              </button>
              <button
                id="v-paseo"
                type="button"
                data-view="paseo"
                className={activeView === 'paseo' ? 'on' : ''}
                title="A nivel de peatón dentro del paseo"
                onClick={() => onSelectView('paseo')}
              >
                En el paseo
              </button>
              <button
                id="v-laguna"
                type="button"
                data-view="laguna"
                className={activeView === 'laguna' ? 'on' : ''}
                title="Desde la Lagoa das Capivaras"
                onClick={() => onSelectView('laguna')}
              >
                Desde la laguna
              </button>
              <button
                id="v-rooftop"
                type="button"
                data-view="rooftop"
                className={activeView === 'rooftop' ? 'on' : ''}
                title="Rooftop fitness sobre el gimnasio"
                onClick={() => onSelectView('rooftop')}
              >
                Rooftop
              </button>
            </div>

            <div className="vc-group" role="group" aria-label="Opciones de visualización">
              <button
                id="b-renders"
                type="button"
                className={selectedRenderId !== null ? 'on' : ''}
                title="Abrir galería de renders fotorrealistas (tecla R)"
                aria-pressed={selectedRenderId !== null}
                onClick={() =>
                  onSelectRender(selectedRenderId !== null ? null : 'lagoa')
                }
              >
                🖼️ Renders ({PROJECT_RENDERS.length})
              </button>
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

      {activeRender && (
        <aside
          id="vc-render-modal"
          data-testid="render-viewer-modal"
          data-render-id={activeRender.id}
          className={`vc-render-modal ${renderCompareMode ? 'compare' : 'expanded'}`}
          aria-label={`Visor de render: ${activeRender.title}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onSelectRender(null);
            }
          }}
        >
          <div className="vc-render-panel">
            <div className="vc-render-header">
              <div className="vc-render-top-row">
                <div className="vc-render-eyebrow">
                  RENDER FOTORREALISTA · VISTA SINCRONIZADA 3D
                </div>
                <div className="vc-render-actions">
                  <button
                    id="b-render-compare"
                    type="button"
                    className="vc-render-btn"
                    onClick={onToggleRenderCompareMode}
                    title="Alternar entre vista ampliada y comparación con la maqueta 3D"
                  >
                    {renderCompareMode ? '🔍 Ampliar' : '📐 Comparar 3D'}
                  </button>
                  <button
                    id="b-render-sync-cam"
                    type="button"
                    className="vc-render-btn gold"
                    onClick={() => {
                      onSelectView(activeRender.cameraView);
                      onSelectRender(null);
                    }}
                    title="Cerrar el render y ver este ángulo en el diseño 3D"
                  >
                    📍 Ver en 3D
                  </button>
                  <button
                    id="b-render-close"
                    type="button"
                    className="vc-render-close"
                    onClick={() => onSelectRender(null)}
                    aria-label="Cerrar y volver al diseño 3D"
                    title="Cerrar y volver al diseño 3D (Esc)"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>

              <div className="vc-render-text-block">
                <h2 className="vc-render-title">{activeRender.title}</h2>
                <p className="vc-render-subtitle">{activeRender.subtitle}</p>
              </div>
            </div>

            <div className="vc-render-stage">
              <button
                id="b-render-prev"
                type="button"
                className="vc-render-nav prev"
                onClick={() => onCycleRender('prev')}
                aria-label="Render anterior"
                title="Render anterior"
              >
                ◀
              </button>
              <img
                src={activeRender.imageUrl}
                alt={activeRender.title}
                className="vc-render-main-img"
              />
              <button
                id="b-render-next"
                type="button"
                className="vc-render-nav next"
                onClick={() => onCycleRender('next')}
                aria-label="Siguiente render"
                title="Siguiente render"
              >
                ▶
              </button>
            </div>

            <div className="vc-render-strip">
              {PROJECT_RENDERS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  data-strip-render={r.id}
                  className={`vc-render-strip-item ${r.id === activeRender.id ? 'active' : ''}`}
                  onClick={() => onSelectRender(r.id)}
                >
                  <img src={r.imageUrl} alt={r.shortLabel} />
                  <span>{r.shortLabel}</span>
                </button>
              ))}
            </div>

            <div className="vc-render-mobile-footer">
              <button
                id="b-render-back-3d"
                type="button"
                className="vc-render-back-3d-btn"
                onClick={() => onSelectRender(null)}
              >
                ✕ Cerrar y volver al diseño 3D
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="vc-compass" aria-hidden="true">
        <div className="vc-needle" id="needle" ref={needleRef} />
      </div>

      {!hudCollapsed && (
        <div
          className="vc-hint"
          id="hint"
          style={{ opacity: hintVisible ? 1 : 0 }}
        >
          Arrastra para orbitar · rueda / pellizco para zoom · clic en tótems 📷 o miniaturas para ver renders
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
