# Revisión de seguridad y estado del proyecto

Fecha: 18 de septiembre de 2026.

## Seguimiento posterior al primer cierre

El usuario ejecutó REVOKE de privilegios para anon/PUBLIC en las cuatro tablas inicialmente confirmadas y aportó resultados de verificación negativos para lectura y escritura. También confirmó que las pantallas revisadas siguen funcionando. Una nueva comprobación remota HEAD confirmó HTTP 401 en las cuatro tablas.

La ampliación de la comprobación identificó filas visibles bajo anon en otras cinco tablas: `seo_initial_findings`, `seo_ahrefs_snapshots`, `sem_guarantee_daily`, `sem_report_budgets` y `social_weekly_goals`. No se descargaron registros ni se probaron escrituras. Resultados en `reports/security-supabase-followup.json`.

`dashboard_user_roles` devuelve HTTP 404 desde la API. No demuestra ausencia en PostgreSQL: requiere comprobar catálogo y exposición. Se preparó `reports/supabase_security_diagnostic.sql`, una consulta de metadatos de solo lectura para ejecutar por el usuario. Su ejecución y la revisión de sus resultados están pendientes. Los hallazgos siguientes conservan la evidencia de la auditoría inicial; el cierre anterior actualiza parcialmente el hallazgo 01.

## Resumen ejecutivo

**El proyecto compila y sus pruebas pasan, pero no está listo para considerarse seguro.** Se confirmó acceso anónimo a filas de cuatro tablas del Supabase remoto. El código también contiene rutas de integración sin autenticación, funciones Edge sin autorización de usuario y defectos en el flujo OAuth. Los cambios locales de roles no cubren todas estas superficies.

Esta revisión no modificó código funcional, datos remotos, políticas, dependencias ni credenciales. No se enviaron correos ni se ejecutaron operaciones de pago o escritura contra integraciones.

## Git y verificaciones

- Remoto: `https://github.com/rafaelcastillo-XMS/internal-dashboard.git`.
- `git ls-remote origin HEAD refs/heads/main` confirmó que ambos apuntan a `588e0fd2411176b165f43712e3573ac38c0a5172`, igual que el HEAD local.
- Hay cambios locales previos: cuatro archivos modificados y archivos/directorios nuevos de autorización, pruebas y una migración. Estos cambios no forman parte del commit remoto. No se sobrescribieron.
- `npm test`: **73 pruebas, 13 archivos, todos aprobados**.
- `npm run build`: aprobado; esto no demuestra que todas las integraciones funcionen en producción.
- `npm run lint`: 0 errores y 24 advertencias, principalmente dependencias de hooks y Fast Refresh.
- `git diff --check`: sin problemas.
- `npm audit`: **19 paquetes afectados: 9 altos, 8 moderados, 2 bajos**.
- `npm audit --omit=dev`: **10 paquetes afectados: 5 altos, 4 moderados, 1 bajo**. Algunos paquetes del árbol de producción pueden usarse solo en compilación; estos conteos no equivalen a diez vulnerabilidades explotables del servidor.

## Hallazgos críticos

### 01. Acceso anónimo a información interna mediante Supabase

**Impacto:** una persona sin sesión del dashboard puede consultar información interna de informes y métricas; las migraciones también autorizan determinadas escrituras y eliminaciones anónimas.

Evidencia del código:

- `supabase/migrations/20260905000000_seo_client_reports.sql:22`: SELECT anónimo con `using (true)`; líneas 26 y 30 permiten INSERT y DELETE anónimos.
- `supabase/migrations/20260609000001_seo_onpage_audits.sql:23`: políticas anónimas de lectura, inserción y actualización.
- `supabase/migrations/20260709000000_seo_initial_audit_items.sql:23`: mismo patrón de permisos anónimos.
- `supabase/migrations/20260527000001_sem_daily_data.sql:16` y `:31`: políticas llamadas “Service role full access” sin cláusula `TO service_role`. El nombre no restringe el rol: la política se aplica a PUBLIC. También aparece en migraciones de métricas anuales, presupuestos, informes mensuales y objetivos sociales (`20260730000000_social_weekly_goals.sql:18`).

Verificación remota: solicitudes **HEAD**, usando solamente la clave pública anon del frontend, con `select=id&limit=1` y `Prefer: count=exact`. Se comprobó que el total visible es mayor que cero, sin descargar registros ni imprimir sus contenidos:

| Tabla | Respuesta | Filas visibles sin sesión |
| --- | --- | --- |
| seo_client_reports | 200 | Sí |
| seo_initial_audit_items | 206 | Sí |
| seo_onpage_audits | 206 | Sí |
| sem_ads_daily | 206 | Sí |
| clients | 200 | No en esta comprobación |

Un HTTP 200 por sí solo no prueba exposición: el hallazgo se apoya en el conteo positivo bajo el rol anónimo. Las escrituras remotas **no se probaron**; su riesgo se deriva del SQL versionado y requiere contrastar políticas y grants efectivos.

Corrección: retirar grants y políticas anónimas de datos internos; restringir lectura/escritura a miembros autorizados de `dashboard_user_roles`, con permisos por operación. Las políticas permisivas se combinan con OR: agregar otra política restrictiva sin eliminar las anteriores no corrige el problema. Conservar los procesos automáticos mediante credenciales de servidor. Probar acceso anónimo, usuario externo, usuario interno y administrador. [Documentación de RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Hallazgos altos

### 02. API Express sin validación general de sesión y permisos

Evidencia: `server.js:19` configura el servidor sin middleware de autenticación general; `server.js:140` consulta detalles de Monday por ID; `:176` y `:186` ejecutan IA; `:341` consulta Ahrefs; `:375` y `:393` consultan campañas Meta; `:425` y `:445` consultan reportes Google. Estos handlers no comprueban al usuario del dashboard. `server.js:155` protege el listado de Monday solo si existe un secreto opcional, y el correo a consultar sigue viniendo de `req.query.email`.

Impacto: si las rutas son alcanzables, puede haber acceso a datos y consumo de cuotas con las credenciales del servidor. No hay limitación de frecuencia visible en estas rutas. El control React de `DashboardAccessProvider` no protege llamadas HTTP directas.

Corrección: validar el access token de Supabase en servidor y el rol interno antes de invocar integraciones; derivar la identidad del usuario verificado; autorizar recursos y operaciones según el modelo interno. Añadir límites de frecuencia/concurrencia para IA, informes y exportaciones. Mantener callbacks con mecanismos específicos de autenticación. Verificar si existe protección adicional en el proxy: no se inspeccionó Dokploy ni se acredita exposición pública de estas rutas desplegadas. [Recomendaciones de Express](https://expressjs.com/en/advanced/best-practice-security/).

### 03. Funciones Edge usan credenciales privilegiadas sin autorizar al usuario

Evidencia:

- `supabase/functions/send-report-email/index.ts:90` acepta destinatario y contenido y llega a `client.send` sin validar usuario/rol.
- `supabase/functions/openai-ads/index.ts:91` acepta `clientId`; `:11` usa service role para obtener el token del cliente, sin autorización previa del solicitante.
- `supabase/functions/seo/index.ts:404` y `supabase/functions/sem/index.ts:671` ejecutan consultas con credenciales de servidor sin verificación de usuario; SEM también expone sincronización.
- `src/lib/edgeFetch.ts:10` envía el JWT público anon como Authorization, no la sesión del usuario. `server.js:126` repite este patrón para SEM.

Impacto: abuso de envío de correos, cuotas e información de clientes si el gateway deja pasar la clave pública. Verificar la firma de un JWT anon no acredita una sesión de usuario. La configuración desplegada del gateway no se inspeccionó y no se ejercitaron estos endpoints externos.

Corrección: enviar el token de sesión real, validar usuario y membresía interna en cada función, y comprobar autorización sobre el cliente antes de usar service role. Limitar envíos y consumo. `google-calendar` ya incluye `auth.getUser`, aunque también debe alinearse con los permisos internos.

### 04. Dependencias con avisos de seguridad vigentes

Evidencia: `package.json:24`, `:33`, `:50`, `:54`, `:55`, lockfile y resultados del registro npm durante esta revisión.

El árbol sin dependencias de desarrollo reporta `body-parser`, `dompurify`, `fflate`, `nanoid`, `postcss`, `postcss-selector-parser`, `qs`, `react-router`, `react-router-dom` y `ws`. La severidad del paquete es la del registro; la explotación concreta depende de opciones, rutas y uso real. Por ejemplo, avisos SSR/RSC de React Router no deben atribuirse automáticamente a esta SPA.

Corrección: actualizar versiones compatibles y volver a ejecutar pruebas/build/audit; revisar por separado la migración de Vite, para la que npm propone un cambio mayor. No ejecutar `npm audit fix --force` de forma indiscriminada. Archivos de evidencia guardados en `reports/security-audit-2026-09-18-npm.json` y `reports/security-audit-2026-09-18-npm-production.json`.

## Hallazgos medios

### 05. OAuth permite redirección fuera del sitio y no vincula state a una sesión

Evidencia: `server/googleAuth.js:35` solo comprueba que el retorno empiece con `/` y no con `//`. La ruta `/\\example.invalid` supera la validación; el parser URL del navegador interpreta la barra invertida y resuelve a un origen externo. Una prueba local sobre `decodeAuthReturnPath` y `appendAuthResult` confirmó la salida del origen. Los callbacks de `:298` y `:336` utilizan ese retorno también cuando falta el código OAuth.

Además, `:147` y `:229` generan state como JSON codificado, sin nonce aleatorio, caducidad o asociación al usuario. Los callbacks no verifican una transacción iniciada por una sesión autorizada. Existe una comprobación del correo de Google esperado en el intercambio; esto limita el escenario y no permite concluir que cualquier cuenta pueda sustituir el token.

Corrección: resolver el retorno con un origen fijo, exigir igualdad de origen y rechazar barras invertidas/control characters; generar state aleatorio de un solo uso, vinculado a sesión y con expiración. Restringir la reconexión a administradores.

### 06. Bucket de informes SEO configurado como público

Evidencia: `supabase/migrations/20260905000000_seo_client_reports.sql:46` crea `seo-reports` con `public = true`. Los reportes son documentos de clientes y las filas anteriores incluyen `storage_path`.

Impacto: quien conozca la URL puede descargar un objeto de un bucket público; las políticas de lectura autenticada no convierten ese bucket en privado. No se descargaron PDFs ni se comprobó la configuración vigente de Storage; este punto se confirma en el SQL.

Corrección: bucket privado y enlaces firmados de corta duración emitidos después de autorizar al solicitante. Si los documentos deben compartirse públicamente por decisión de negocio, definir explícitamente ese alcance.

### 07. Exclusiones de Docker incompletas para credenciales GBP

Evidencia: `.dockerignore:8` excluye `token.json` y `credentials.json`, pero no `token-gbp.json` ni `credentials-gbp.json`. `Dockerfile:8` realiza `COPY . .` en la etapa builder.

Impacto: un build local puede enviar esos archivos al builder e incorporarlos a su caché si contienen secretos. La imagen final copia `dist` y archivos seleccionados: no se comprobó que los secretos estén en la imagen final. El token GBP local no se consideró una filtración confirmada.

Corrección: excluir todas las variantes de tokens/credenciales y `.env.*`, manteniendo únicamente ejemplos necesarios; usar montajes en runtime. Como endurecimiento adicional, la imagen no declara `USER` y conviene ejecutar el servicio sin root y usar `npm ci` para instalaciones reproducibles.

## Aspectos positivos y límites

- `.env`, `.env.production`, credenciales de Google y tokens están ignorados por Git. Los nombres examinados no aparecen en el índice ni en el historial local consultado. Esto no certifica todos los objetos históricos ni secretos bajo otros nombres.
- Un escaneo de patrones sobre archivos versionados no detectó claves privadas ni los formatos de secretos de proveedores buscados. La comparación de valores privados de entorno con el bundle generado tampoco encontró coincidencias. Son comprobaciones acotadas, no una garantía de ausencia de secretos.
- Las claves Supabase anon son públicas por diseño; su presencia en el frontend no es por sí misma una filtración de service role.
- Se encontró uso de DOMPurify en los principales renders HTML; requiere actualización según el audit.
- El callback de resultados n8n rechaza llamadas cuando falta su secreto (`server.js:262`).
- Las invocaciones Python revisadas usan argumentos separados; la exportación tiene timeout y limpieza de temporales.
- La migración local de roles mejora clientes y perfiles, pero no modifica las políticas de reportes/métricas señaladas. Tampoco se verificó que esté aplicada completa en producción.
- Hay dependencia de objetos SQL no definidos en las migraciones disponibles, como la implementación original de `set_client_ad_token`. No se puede certificar una reconstrucción de base de datos desde cero con lo inspeccionado.
- Pendiente validar configuración real de Auth (registro y confirmación de correo), policies/grants completos, funciones privilegiadas existentes, Storage, gateway Edge, HTTPS/proxy/Dokploy, versiones desplegadas y advisories Python/Deno. No se hizo pentest exhaustivo ni pruebas destructivas.
- La exportación PDF pasa contenido a `ReportLab.Paragraph` (`tools/pdf_export.py:380`); conviene verificar/limitar etiquetas y recursos externos. No se confirmó SSRF o lectura de archivos y no se registra como vulnerabilidad demostrada.

## Orden recomendado

1. Corregir acceso anónimo a tablas y verificar RLS remota con pruebas positivas y negativas.
2. Aplicar autenticación/autorización consistente a Express y Edge; actualizar los consumidores del frontend.
3. Restringir informes Storage y corregir OAuth.
4. Actualizar dependencias y cerrar exclusiones de Docker.
5. Resolver advertencias y añadir pruebas de seguridad que comprueben denegaciones antes de desplegar los ajustes funcionales.
