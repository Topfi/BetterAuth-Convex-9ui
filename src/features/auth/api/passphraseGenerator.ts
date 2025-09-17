const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercase = "abcdefghijklmnopqrstuvwxyz";
const digits = "0123456789";
const symbols = "!@#$%^&*()-_=+[]{};:,<.>?";

const defaultLength = 24;

const categories = [uppercase, lowercase, digits, symbols] as const;
const allCharacters = categories.join("");

export function generatePassphrase(length: number = defaultLength): string {
  if (length < categories.length) {
    throw new Error("Length must allow all character categories.");
  }

  const result = new Array<string>(length);
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  // Ensure each category appears at least once for baseline entropy.
  categories.forEach((category, index) => {
    const charIndex = randomValues[index] % category.length;
    result[index] = category[charIndex] ?? category[0];
  });

  for (let index = categories.length; index < length; index += 1) {
    const value = randomValues[index];
    const charIndex = value % allCharacters.length;
    result[index] = allCharacters[charIndex] ?? lowercase[0];
  }

  // Shuffle to avoid predictable placement of guaranteed characters.
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomValues[index] % (index + 1);
    const temp = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = temp;
  }

  return result.join("");
}
