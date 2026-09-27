/** Profile fields that may carry a person's name (Auth0 standard claims plus common custom ones). */
export interface NamedUser {
  given_name?: string;
  name?: string;
  nickname?: string;
  preferred_username?: string;
  email?: string;
  user_metadata?: { full_name?: string; username?: string };
}

const EMAIL = /^[^\s@]+@[^\s@]+$/;

/** A usable name, or null for blanks and email addresses (Auth0 sets `name` to the email for password sign-ups). */
const usable = (value: unknown): string | null => {
  const text = typeof value === "string" ? value.trim() : "";
  return text && !EMAIL.test(text) ? text : null;
};

/** "jane.doe+civic@example.com" -> "Jane Doe"; null when the local part has no letters. */
export function nameFromEmail(email: string | undefined): string | null {
  const local = email?.split("@")[0]?.split("+")[0] ?? "";
  const words = local
    .split(/[._-]+/)
    .map((part) => part.replace(/\d+/g, ""))
    .filter((part) => /\p{L}/u.test(part));
  if (!words.length) return null;
  return words.map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()).join(" ");
}

/** The friendliest name for greetings: a real name first, then a username, then one derived from the email. */
export function displayNameFor(user: NamedUser | undefined | null): string | null {
  if (!user) return null;
  // Auth0 defaults `nickname` to the email's local part ("jane.doe"); prefer the prettified form of that.
  const nickname = user.nickname?.trim() === user.email?.split("@")[0] ? null : usable(user.nickname);
  return (
    usable(user.given_name) ??
    usable(user.user_metadata?.full_name) ??
    usable(user.name) ??
    usable(user.user_metadata?.username) ??
    usable(user.preferred_username) ??
    nickname ??
    nameFromEmail(user.email)
  );
}
