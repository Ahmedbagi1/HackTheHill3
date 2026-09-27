import type { ElementType } from "react";
import { useI18n } from "./i18nContext";

interface Props {
  text: string;
  as?: ElementType;
  className?: string;
  id?: string;
}

/**
 * Translated content block. When the active language has no translation yet
 * (Inuktitut and Anishinaabemowin drafts), the English text is marked with
 * lang="en" for screen readers and a visible "EN" tag.
 */
export default function Tx({ text, as: Tag = "span", className, id }: Props) {
  const { t, has, locale } = useI18n();
  const untranslated = locale !== "en" && !has(text);
  return (
    <Tag className={className} id={id} lang={untranslated ? "en" : undefined} data-untranslated={untranslated || undefined}>
      {t(text)}
    </Tag>
  );
}
