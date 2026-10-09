<p align="center"><img src="public/egrow-logo.png" alt="e-grow" width="260"></p>

# e-grow CRM

Un CRM simple hecho para e-grow. Toma de HubSpot solo lo que el equipo usa: un pipeline de negocios en tablero Kanban, contactos, empresas, actividades y tareas. A eso le suma un catálogo de productos y servicios por **línea de negocio**: E-learning, Rutalink, Ludus, Humand y las representaciones que vengan.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Inicio** | Indicadores (pipeline abierto, ponderado, ganado, tasa de cierre), valor por etapa, pipeline y ganado por línea de negocio, ganado por producto o servicio, ganado por año o por mes, mis tareas, negocios por cerrar y negocios sin actividad hace más de 30 días. Todo se puede filtrar por **año de cierre, línea de negocio, producto o servicio y propietario**. |
| **Negocios** | Tablero Kanban con arrastrar y soltar, totales y cantidad ponderada por etapa (igual que en HubSpot), filtros por año de cierre, línea de negocio, producto o servicio, propietario y rango de fechas, búsqueda y vista de lista. Ficha con barra de etapas, productos cotizados (el valor se calcula solo), historial y tareas. |
| **Contactos / Empresas** | Fichas con negocios asociados, historial de actividades, enlace a WhatsApp y búsqueda. |
| **Actividades y tareas** | Notas, llamadas, reuniones, correos y tareas con fecha límite y responsable. Cada cambio de etapa queda registrado automáticamente. |
| **Líneas y productos** | Alta de nuevas líneas o representaciones y de su catálogo (producto o servicio, SKU y precio de lista). |
| **Importar HubSpot** | Importa CSV de empresas, contactos y negocios exportados de HubSpot, en español o inglés. Tiene modo simulación, omite duplicados y deduce la línea de negocio a partir del nombre. |
| **Configuración** | Usuarios, perfiles y etapas del pipeline (nombre, orden y probabilidad). |

### Perfiles

| Perfil | Permisos | Equipo |
|---|---|---|
| **Administrador** | Todo, incluidos usuarios, etapas del pipeline e importación. | Andrés Poveda |
| **Gerente** | Ve y edita todo, elimina, administra el catálogo e importa datos. Todo menos gestionar usuarios. | — |
| **Gestión de negocios** | Crea clientes (contactos y empresas), negocios y productos, y da seguimiento a cada negocio. | María Isabel Piñeiros |
| **Gestión de proyectos** | Consulta todo y da seguimiento a la producción: mueve negocios entre *Firma de Contrato*, *En Producción* y *Cerrado Ganado*, y registra actividades y tareas. | Janine Salgado |

Los tres usuarios se crean automáticamente (`prisma/seed.ts`) con la contraseña temporal `SEED_INITIAL_PASSWORD`. Cada persona la cambia en **Mi perfil**, haciendo clic en su nombre abajo a la izquierda.

La matriz de permisos está en `src/lib/permissions.ts`.

### Etapas iniciales del pipeline

Contacto (10 %) → Presentación (30 %) → Cotización-Envío (40 %) → Revisión-Negociación (70 %) → Firma de Contrato (80 %) → En Producción (90 %) → Cerrado Ganado (100 %) / Cerrado Perdido (0 %).

## Tecnología

- [Next.js 15](https://nextjs.org) (App Router y Server Actions) con TypeScript.
- PostgreSQL con [Prisma](https://www.prisma.io).
- Tailwind CSS 4.
- Autenticación propia: contraseñas con bcrypt y sesión JWT en una cookie httpOnly.

## Publicación en Supabase + Vercel

Supabase guarda la base de datos y Vercel ejecuta la aplicación web. Los dos tienen plan gratuito.

### 1. Base de datos en Supabase

1. En [supabase.com](https://supabase.com), crea un proyecto (por ejemplo, `egrow-crm`; región *South America (São Paulo)* o *US East*) y guarda la contraseña de la base de datos.
2. Pulsa **Connect** (arriba) y copia dos cadenas de conexión, reemplazando `[YOUR-PASSWORD]` por la contraseña:
   - **Transaction pooler** (puerto 6543). Agrega al final `?pgbouncer=true&connection_limit=1` y úsala como `DATABASE_URL`.
   - **Session pooler** (puerto 5432). Úsala como `DIRECT_URL`.

### 2. Aplicación en Vercel

1. En [vercel.com](https://vercel.com), ingresa con GitHub, pulsa **Add New → Project** e importa el repositorio `egrow2018-lgtm/crm`.
2. En **Environment Variables** agrega:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena del *Transaction pooler* (paso 1) |
   | `DIRECT_URL` | La cadena del *Session pooler* (paso 1) |
   | `AUTH_SECRET` | Un texto largo y aleatorio (por ejemplo, el resultado de `openssl rand -base64 32`) |
   | `SEED_INITIAL_PASSWORD` | Contraseña temporal para los tres usuarios (mínimo 8 caracteres) |

3. Pulsa **Deploy**. El script `vercel-build` crea las tablas, carga las etapas, las líneas de negocio y los usuarios, y compila la aplicación.
4. Entra a la URL que te da Vercel (puedes conectar un dominio como `crm.e-growonline.com` en *Settings → Domains*).

### 3. Migrar desde HubSpot

1. Ingresa como Andrés y ve a **Importar HubSpot**.
2. Sube los CSV en este orden: **Empresas → Contactos → Negocios**. Hazlo primero con "Solo simular" y luego de verdad.
   - Los contactos se asocian a su empresa por el dominio del email corporativo (como en HubSpot) o por el nombre de la empresa.
   - Los duplicados se omiten, así que puedes volver a importar sin riesgo.
   - Los propietarios se emparejan por nombre ("Janine Salgado Torres" se asigna a "Janine Salgado"). Los registros de propietarios que ya no existen quedan a nombre de quien importa.
3. Cada persona cambia su contraseña en **Mi perfil**.

## Desarrollo local

Requisitos: Node.js 20 o superior y PostgreSQL 14 o superior (o una base de Supabase de pruebas).

```bash
npm install
cp .env.example .env          # completa DATABASE_URL, DIRECT_URL, AUTH_SECRET y SEED_INITIAL_PASSWORD
npm run db:migrate            # crea las tablas
npm run db:seed               # usuarios del equipo, etapas, líneas de negocio y productos de ejemplo
npm run dev                   # http://localhost:3000
```

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
