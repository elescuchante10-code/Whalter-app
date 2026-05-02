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

Cuando actives Pages en el repositorio (**Settings → Pages → Source: Deploy from a branch → `main` → `/ (root)`**), la app quedará en:

**https://elescuchante10-code.github.io/Whalter-app/**

Los enlaces `./styles.css`, `./app.js` y `./sourceText.js` ya son relativos y funcionan bajo esa URL.

## Desarrollo local

```powershell
cd "ruta\a\Whalter-app"
python -m http.server 5173
```

Abre `http://localhost:5173`.
