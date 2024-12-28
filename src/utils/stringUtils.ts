
/**
 * Checks if a string is blank (empty or contains only whitespace)
 * @param value string to check
 * @param defaultValue default value to return if value is blank
 * @returns value if not blank, defaultValue otherwise
 */
export function defaultIfBlank(value: string | undefined, defaultValue: string): string {
    return !value || value.trim() === '' ? defaultValue : value;
}
