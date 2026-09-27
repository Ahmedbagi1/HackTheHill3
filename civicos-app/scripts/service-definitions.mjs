import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

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
      const fields = [...service.form.primary.fields, ...service.form.verification.fields]
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

export function definitionSql(definitions) {
  const literal = (value) => `'${value.replaceAll("'", "''")}'`;
  const rows = definitions.map(({ id, ...definition }) =>
    `    (${literal(id)}, ${literal(JSON.stringify(definition))}::jsonb)`).join(',\n');
  return `-- Generated from the existing service forms by scripts/service-definitions.mjs.
-- Static form schemas only; never user data. Once applied, do not edit this
-- migration: publish later catalog changes through a new migration.
create function civicos_private.service_definition(p_service_id text)
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
