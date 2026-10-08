# e-grow CRM

Un CRM simple hecho para e-grow. Toma de HubSpot solo lo que el equipo usa: un pipeline de negocios en tablero Kanban, contactos, empresas, actividades y tareas. A eso le suma un catálogo de productos y servicios por **línea de negocio**: E-learning, Rutalink, Ludus, Humand y las representaciones que vengan.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Inicio** | Indicadores (pipeline abierto, ponderado, ganado del año, tasa de cierre), valor por etapa, pipeline por línea de negocio, ganado por mes, mis tareas, negocios por cerrar y negocios sin actividad hace más de 30 días. |
| **Negocios** | Tablero Kanban con arrastrar y soltar, totales y cantidad ponderada por etapa (igual que en HubSpot), filtros por propietario, línea de negocio y fecha de cierre, búsqueda y vista de lista. Ficha con barra de etapas, productos cotizados (el valor se calcula solo), historial y tareas. |
| **Contactos / Empresas** | Fichas con negocios asociados, historial de actividades, enlace a WhatsApp y búsqueda. |
| **Actividades y tareas** | Notas, llamadas, reuniones, correos y tareas con fecha límite y responsable. Cada cambio de etapa queda registrado automáticamente. |
| **Líneas y productos** | Alta de nuevas líneas o representaciones y de su catálogo (producto o servicio, SKU y precio de lista). |
| **Importar HubSpot** | Importa CSV de empresas, contactos y negocios exportados de HubSpot, en español o inglés. Tiene modo simulación, omite duplicados y deduce la línea de negocio a partir del nombre. |
| **Configuración** | Usuarios, perfiles y etapas del pipeline (nombre, orden y probabilidad). |

### Perfiles

| Perfil | Permisos |
|---|---|
| **Administrador** | Todo, incluidos usuarios y etapas del pipeline. |
| **Gerente** | Ve y edita todo, elimina, administra el catálogo e importa datos. |
| **Gestor comercial** | Crea y edita contactos, empresas y negocios, y registra actividades. |
| **Proyectos** | Consulta todo, registra actividades y mueve negocios solo entre *Firma de Contrato*, *En Producción* y *Cerrado Ganado*. |

La matriz de permisos está en `src/lib/permissions.ts`.

### Etapas iniciales del pipeline

Contacto (10 %) → Presentación (30 %) → Cotización-Envío (40 %) → Revisión-Negociación (70 %) → Firma de Contrato (80 %) → En Producción (90 %) → Cerrado Ganado (100 %) / Cerrado Perdido (0 %).

## Tecnología

- [Next.js 15](https://nextjs.org) (App Router y Server Actions) con TypeScript.
- PostgreSQL con [Prisma](https://www.prisma.io).
- Tailwind CSS 4.
- Autenticación propia: contraseñas con bcrypt y sesión JWT en una cookie httpOnly.

## Puesta en marcha (desarrollo)

Requisitos: Node.js 20 o superior y PostgreSQL 14 o superior.

```bash
npm install
cp .env.example .env          # edita DATABASE_URL, AUTH_SECRET y el admin inicial
npm run db:migrate            # crea las tablas
npm run db:seed               # crea el admin, las etapas y las líneas de negocio con productos de ejemplo
npm run dev                   # http://localhost:3000
```

Inicia sesión con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`, y **cambia la contraseña** desde *Configuración*.

## Migrar desde HubSpot

1. En *Configuración*, crea los usuarios con el **mismo nombre** que tienen como propietarios en HubSpot (por ejemplo, "Andres Poveda").
2. En HubSpot, exporta en formato CSV las **Empresas**, los **Contactos** y los **Negocios**.
3. En *Importar HubSpot*, sube los archivos en ese orden. Primero con "Solo simular" y después de verdad.

## Producción

Cualquier hosting de Node.js con PostgreSQL sirve. Algunas opciones de bajo costo son Vercel con Neon o Supabase, Railway y Render.

```bash
npm run build
npm run db:deploy   # aplica migraciones
npm run db:seed     # solo la primera vez
npm start
```

Variables necesarias: `DATABASE_URL` y `AUTH_SECRET` (genera uno con `openssl rand -base64 32`).

## Scripts

| Script | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Pruebas unitarias (parser CSV del importador) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Base de datos |

## Próximas fases sugeridas

- Generación de cotizaciones en PDF desde los productos del negocio.
- Formularios web y captura de leads.
- Integración con correo (Gmail u Outlook) y WhatsApp.
- Automatizaciones: por ejemplo, crear una tarea al pasar a "Firma de Contrato".
- Reportes por vendedor y por línea de negocio con rangos de fechas.
