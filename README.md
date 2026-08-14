# 🍷 La Cuenta de Mesa de Galanes

Dividí los gastos de la cena entre los galanes. Cada uno carga su gasto desde el celular y la app calcula quién pone y quién recibe.

## Setup

### 1. Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (o usá uno existente).
2. Andá a **SQL Editor** y pegá todo el contenido de `supabase-schema.sql`. Ejecutá.
3. Andá a **Settings > API** y copiá:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Local

```bash
cd la-cuenta
npm install
cp .env.local.example .env.local
# Editá .env.local con las claves de Supabase
npm run dev
```

Abrí `http://localhost:3000`.

### 3. Deploy a Vercel

1. Subí el proyecto a un repo en GitHub.
2. En [vercel.com](https://vercel.com), importá el repo.
3. En **Environment Variables** cargá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## Cómo se usa

1. Alguien toca **Nueva Cena** → se crea el evento con todos los integrantes.
2. Comparte el link en el grupo de WhatsApp.
3. Cada uno abre el link y carga lo que gastó en la pestaña **Gastos**.
4. En **Resultado** se ve la liquidación: quién pone, quién recibe, y las transferencias.
5. El botón **Copiar resumen** genera un texto listo para pegar en WhatsApp.

## Stack

- **Next.js 14** (App Router)
- **Supabase** (Postgres + Realtime)
- **Tailwind CSS**
- **Vercel** (hosting)
