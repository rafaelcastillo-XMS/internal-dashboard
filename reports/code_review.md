# Revisión de código del dashboard

## Alcance y estado

Revisión del árbol local, incluidos los cambios pendientes de autorización. El usuario decidió aplazar los siguientes ajustes de Supabase. Las cinco tablas aún expuestas siguen siendo un pendiente; esta revisión no modifica base de datos, código funcional ni despliegues.

Se revisaron rutas Express, integración con proveedores, OAuth, renderizado/exportación de contenido y diferencias entre desarrollo y producción. La auditoría previa ejecutó 73 pruebas aprobadas, build aprobado y lint con 24 advertencias. No se repitió toda la suite porque no cambió el código funcional. Esos resultados no cubren por sí mismos las denegaciones de acceso ni el comportamiento de producción.

## 1. Alta — Rutas de integraciones ejecutables sin sesión

Evidencia: `server.js:140`, `server.js:176`, `server.js:186`, `server.js:341`, `server.js:375`, `server.js:425`. El servidor configura JSON y cabeceras, pero no un middleware general de autenticación. La protección React en `src/App.tsx:76` controla navegación, no peticiones directas a la API.

Prueba local: se importó el servidor sustituyendo `listen` para evitar abrir un puerto, usando un token ficticio de Monday y reemplazando `fetch` por una respuesta sintética. Se invocó el handler de `/api/monday/tasks/:taskId` con `headers: {}`. Resultado: una llamada al proveedor simulado; después respondió 404 porque el mock no contenía tareas. El rechazo esperado por ausencia de sesión no ocurrió. No se contactó Monday ni se usó un token real.

Impacto: lectura de información y consumo de cuotas si el servidor resulta accesible sin una barrera externa. La infraestructura desplegada no se inspeccionó. En `/api/monday/tasks`, el secreto opcional tampoco acredita identidad individual y el correo consultado viene del cliente (`server.js:155`, `:163`).

Corrección: middleware de validación de sesión, autorización de usuarios internos y de recursos, identidad derivada del usuario verificado y límites de frecuencia/concurrencia. Actualizar en conjunto los fetch del frontend para enviar sesión. No basta con proteger una ruta o añadir un secreto al JavaScript público. Mantener el callback n8n bajo su secreto específico.

## 2. Media — Redirección OAuth externa reproducible y state sin asociación a sesión

Evidencia: `server/googleAuth.js:35`, `:147`, `:229`, `:298`, `:336`. La validación acepta una ruta que empieza por barra y barra invertida. El navegador interpreta esa combinación como una URL de otro origen. `state` contiene solo JSON codificado y no una transacción de autenticación vinculada al navegador.

Prueba local sobre el callback registrado: se suministró state con retorno `/\\example.invalid` y sin código OAuth. El handler emitió una redirección que el parser URL resolvió a `https://example.invalid`. La rama de error permite reproducirlo sin credenciales de Google ni llamadas de red.

Corrección: retorno validado contra un origen fijo, rechazo de barras invertidas y caracteres de control; state aleatorio, de un solo uso, con expiración y vinculado a una sesión autorizada. La validación existente del correo esperado de Google limita el riesgo de sustitución de cuenta y debe conservarse.

## 3. Resuelto por retirada de funcionalidad — NotebookLM no tenía las rutas requeridas en producción

Actualización: a petición del usuario se retiraron el chat, el cliente API, el bridge Python, el plugin Vite y el icono. La aplicación ya no consulta sus campos de configuración. La evidencia siguiente describe el estado anterior. Las migraciones históricas y columnas remotas no se alteraron.

Evidencia: `src/features/clients/notebooklm.ts:26` solicita GET `/api/notebooklm/notebooks`; `:41` solicita POST `/api/notebooklm/query`. Las implementaciones están en `vite.config.ts:222`. `server.js` no registra estas rutas y su fallback GET (`:494`) devuelve el HTML de la SPA.

Prueba local: inspección de la tabla de rutas Express después de importar el servidor; ninguna ruta `/api/notebooklm` registrada.

Resultado esperado con el servidor de producción del repositorio: el listado recibe HTML y falla `response.json()`; la consulta POST tampoco encuentra su handler. Un proxy externo podría cambiar este comportamiento, pero no está definido en el servidor revisado.

Corrección: compartir handlers entre desarrollo y producción, disponer del bridge y sus dependencias en el runtime, y protegerlos con autenticación. Si NotebookLM se limita deliberadamente al entorno local, ocultar/deshabilitar esa función en producción con un estado explícito. Añadir respuesta JSON 404 para rutas `/api` desconocidas antes del fallback SPA.

## 4. Media — La eliminación de informes muestra éxito aunque falle la persistencia

Evidencia: `src/pages/seo/SEOClientReports.tsx:107`. `handleDelete` espera las promesas de Storage y base de datos, pero no comprueba sus campos `error`; después elimina el elemento del estado local incondicionalmente. El SDK puede devolver errores en esos campos sin rechazar la promesa.

Impacto: el usuario cree que se eliminó el informe aunque todavía exista. Si solo una operación funciona, quedan objetos huérfanos o filas con archivos inexistentes. La generación tiene un problema relacionado: sube el archivo (`:80`) y si falla el INSERT (`:83`) no elimina el objeto recién creado.

Corrección: comprobar cada resultado, mostrar el error real y refrescar el listado cuando se confirme la operación; definir recuperación ante fallos parciales. Limpiar el archivo recién subido cuando falle el alta del registro. Storage y PostgreSQL no constituyen una sola transacción, por lo que conviene que el flujo sea reintentable. Verificación actual: análisis de código; no se borraron ni crearon reportes reales.

## 5. Pendiente de validación de producción — Marcado de entrada llega al cargador de recursos de PDF

Evidencia: `server.js:462` acepta `payload` sin esquema; `server/pdfExport.js:28` lo envía a Python; `tools/pdf_export.py:360`, `:380` y `:382` lo insertan en `ReportLab.Paragraph`. Ese componente interpreta marcado, incluidos elementos de imagen.

Prueba local: se sustituyó `paraparser.ImageReader` por un interceptor que siempre bloquea. Un Paragraph con una etiqueta img dirigida a `https://example.invalid/audit.png` alcanzó el interceptor. No hubo solicitudes externas ni lecturas de archivos. La instalación local es ReportLab 4.4.10, mientras `requirements.txt` fija 4.2.0; la prueba no certifica el runtime desplegado ni demuestra acceso a un recurso privado.

Riesgo a investigar: solicitudes a recursos externos o lectura de imágenes locales si se permite que el marcado no confiable seleccione fuentes. La ruta también puede lanzar procesos Python sin autenticación ni límite de concurrencia en el código observado.

Corrección: escapar texto plano antes de crear Paragraph; si se necesita formato, definir una lista limitada de etiquetas y prohibir imágenes/recursos seleccionados por el usuario. Validar tamaños/cantidad de secciones, autenticar la ruta y limitar concurrencia. El timeout de 60 segundos y el uso de execFile con argumentos separados son controles positivos existentes.

## Cobertura y otros pendientes

- Las funciones Edge continúan usando la clave anon desde `src/lib/edgeFetch.ts:10`; su autorización de usuario debe resolverse en código, además de las políticas SQL aplazadas. Véase el hallazgo 03 del informe general.
- DOMPurify protege varios renders HTML. El audit previo identificó dependencias afectadas; actualizar y comprobar compatibilidad sigue pendiente. No se demostró un bypass XSS en el renderizado actual.
- `eslint.config.js` aplica las reglas principales a TS/TSX; no aporta esa misma cobertura a `server.js` y `server/*.js`. Un lint aprobado no valida esos archivos del backend.
- Existen implementaciones de rutas duplicadas en Vite y Express; la discrepancia NotebookLM muestra por qué conviene compartirlas y probar el servidor de producción.
- No se aplicaron correcciones. Orden propuesto: sesión/permisos API; OAuth; persistencia de informes; paridad de NotebookLM; límites y validación PDF; actualización de dependencias.
