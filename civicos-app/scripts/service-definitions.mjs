import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Applied migrations are immutable. The first creates the catalog function;
// each later catalog revision replaces it in a new migration.
export const DEFINITION_MIGRATIONS = ['202609260002_service_definitions.sql', '202609270001_service_definitions_v2.sql'];
export const LATEST_DEFINITION_MIGRATION = DEFINITION_MIGRATIONS.at(-1);

const ruleNames = new Set(['sin', 'at-least-one-child', 'adult-voter', 'roll-number']);
const inputTypes = new Set(['text', 'email', 'tel', 'number', 'date', 'textarea',
  'select', 'radio', 'checkbox-group', 'checkbox', 'geotag', 'waste-lookup']);

// Load the existing catalog without loading .env files, starting HTTP, or running
// the app. No submitted data or deployment configuration enters this snapshot.
export async function readServiceDefinitions() {
  const vite = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false, envDir: false, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, ws: false },
  });
  try {
    const { SERVICES } = await vite.ssrLoadModule('/src/data/servicesData.js');
    const { SERVICE_CATEGORY } = await vite.ssrLoadModule('/src/data/categories.ts');
    return SERVICES.map((service) => {
      const fields = [service.form.primary, service.form.applicant, service.form.verification].filter(Boolean)
        .flatMap((section) => section.fields)
        .filter((field) => !['info', 'estimate'].includes(field.type));
      if (!SERVICE_CATEGORY[service.id] || new Set(fields.map((f) => f.name)).size !== fields.length) {
        throw new Error(`Missing category or duplicate fields: ${service.id}`);
      }
      const previousFields = new Set();
      for (const field of fields) {
        if (field.showIf?.conditions?.some((condition) => !previousFields.has(condition.name))) {
          throw new Error(`Visibility must depend on an earlier validated field: ${service.id}.${field.name}`);
        }
        previousFields.add(field.name);
      }
      return {
        id: service.id, title: service.title, category: SERVICE_CATEGORY[service.id],
        fields: fields.map((field) => {
          if (!inputTypes.has(field.type)
              || (field.showIf && !field.showIf.conditions)
              || (field.validate && !ruleNames.has(field.serverRule))
              || (field.pattern && /[^i]/.test(field.pattern.regex.flags))) {
            throw new Error(`Unsupported database validation: ${service.id}.${field.name}`);
          }
          return {
            name: field.name, label: field.reviewLabel ?? field.label, type: field.type,
            optional: Boolean(field.optional),
            maxLength: field.maxLength ?? (field.type === 'textarea' ? 1000 : 500),
            ...(field.options && { options: field.options.map(({ value, label }) => ({ value, label })) }),
            ...(field.showIf && { conditions: field.showIf.conditions }),
            ...(field.pattern && { pattern: field.pattern.regex.source, insensitive: field.pattern.regex.ignoreCase }),
            ...(field.serverRule && { rule: field.serverRule }),
            ...Object.fromEntries(['min', 'max', 'step', 'notAfterToday', 'notBeforeToday']
              .filter((key) => field[key] !== undefined).map((key) => [key, field[key]])),
          };
        }),
      };
    });
  } finally {
    await vite.close();
  }
}

export function definitionSql(definitions, { replace = false } = {}) {
  const literal = (value) => `'${value.replaceAll("'", "''")}'`;
  const rows = definitions.map(({ id, ...definition }) =>
    `    (${literal(id)}, ${literal(JSON.stringify(definition))}::jsonb)`).join(',\n');
  return `-- Generated from the existing service forms by scripts/service-definitions.mjs.
-- Static form schemas only; never user data. Once applied, do not edit this
-- migration: publish later catalog changes through a new migration.
${replace ? `-- Revision: forms aligned with official government intake (legal names, contact,
-- mailing vs. residential address, statutory declarations).
` : ''}create ${replace ? 'or replace ' : ''}function civicos_private.service_definition(p_service_id text)
returns jsonb
language sql immutable security invoker
set search_path = ''
as $definitions$
  select definition from (values
${rows}
  ) as catalog(service_id, definition) where service_id = p_service_id;
$definitions$;
revoke all on function civicos_private.service_definition(text) from public, anon, authenticated;
`;
}

/** The SQL expected in the latest catalog migration for the current forms. */
export const latestDefinitionSql = (definitions) => definitionSql(definitions, { replace: DEFINITION_MIGRATIONS.length > 1 });

// `node scripts/service-definitions.mjs` writes the latest catalog migration.
// Run it only while that migration is unapplied; otherwise add a new file name
// to DEFINITION_MIGRATIONS first.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = new URL(`../supabase/migrations/${LATEST_DEFINITION_MIGRATION}`, import.meta.url);
  await writeFile(target, latestDefinitionSql(await readServiceDefinitions()));
  console.log(`Wrote supabase/migrations/${LATEST_DEFINITION_MIGRATION}. Review it before applying.`);
}
