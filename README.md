# Whalter-app — Formulario 1A (GCB)

Evaluación estática (HTML/CSS/JS) para la Guía 4 MEN: puntajes págs. 34–85, gráficas y clasificación por cuadro. Datos en `localStorage` del navegador.

## Contenido

| Archivo | Rol |
|--------|-----|
| `index.html` | Portada + dashboard y tarjeta de pregunta |
| `styles.css` | Paleta GCB (navy / rojo / amarillo) |
| `sourceText.js` | Texto base de preguntas (`window.__GCB_SOURCE_TEXT__`) |
| `app.js` | Parseo, navegación, puntaje, gráfica, matriz de régimen |

## GitHub Pages

URL del sitio: **https://elescuchante10-code.github.io/Whalter-app/**

Los enlaces `./styles.css`, `./app.js` y `./sourceText.js` son relativos y sirven bajo esa URL.

### Si ves “404 — There isn’t a GitHub Pages site here”

1. El repositorio debe ser **público** (o tu plan debe permitir Pages en privado).
2. Ve a **Settings → Pages** del repo en GitHub.
3. En **Build and deployment → Source**, elige **GitHub Actions** (no “Deploy from a branch” si quieres usar el flujo ya incluido).
4. Abre la pestaña **Actions**: debe aparecer el workflow **Deploy GitHub Pages** en verde tras el último push a `main`. Si falló, abre el run y revisa el log.
5. Espera 1–3 minutos tras el éxito y recarga la URL (a veces tarda un poco en propagarse).

Alternativa sin Actions: en **Pages → Source** elige **Deploy from a branch**, rama **`main`**, carpeta **`/ (root)`**, guarda y espera el despliegue.

## Desarrollo local

```powershell
cd "ruta\a\Whalter-app"
python -m http.server 5173
```

Abre `http://localhost:5173`.
