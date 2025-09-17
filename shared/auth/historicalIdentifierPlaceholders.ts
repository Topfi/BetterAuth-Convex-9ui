export type HistoricalIdentifierPlaceholder = {
  readonly username: string;
  readonly email: string;
};

export const historicalIdentifierPlaceholders: readonly HistoricalIdentifierPlaceholder[] =
  [
    { username: "AdaLovelace", email: "ada@example.com" },
    { username: "AlanTuring", email: "alan@example.com" },
    { username: "GraceHopper", email: "grace@example.com" },
    { username: "KatherineJohnson", email: "katherine@example.com" },
    { username: "HedyLamarr", email: "hedy@example.com" },
    { username: "DorothyVaughan", email: "dorothy@example.com" },
    { username: "ClaudeShannon", email: "claude@example.com" },
    { username: "GeorgeBoole", email: "george@example.com" },
  ];

export const pickRandomHistoricalIdentifierPlaceholder = (
  random: () => number = Math.random,
): HistoricalIdentifierPlaceholder => {
  const index = Math.floor(random() * historicalIdentifierPlaceholders.length);
  return (
    historicalIdentifierPlaceholders[index] ??
    historicalIdentifierPlaceholders[0]
  );
};

export const formatCombinedHistoricalPlaceholder = (
  placeholder: HistoricalIdentifierPlaceholder,
): string => `${placeholder.email} or ${placeholder.username}`;
