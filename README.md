# Kitcha's Food

Ordering, catering, subscription and kitchen-management platform for Kitcha's Food (Alwarpet, Chennai, est. 2007).

## Stack

React 18/19 + Vite + TypeScript + Tailwind CSS + shadcn/ui-style components, Supabase (Postgres + Auth + RLS), react-router-dom, @tanstack/react-query, react-hook-form + zod, i18next.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase project URL + anon key
npm run dev
```

## Database

Schema lives in `supabase/migrations/` as plain SQL files, run in filename order against your Supabase project (SQL editor, or `supabase db push` with the CLI). See that folder's own notes for specifics.

## Status

This is a from-scratch rebuild in progress — see the project's task list for what's built and what's next.
