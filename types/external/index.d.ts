declare module "common-tags" {
  export function stripIndent(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): string;
}

declare module "semver" {
  export interface SemVerOptions {
    loose?: boolean;
    includePrerelease?: boolean;
  }

  export type VersionInput = string | { version: string };

  export interface SemVerApi {
    lt: (
      v1: VersionInput,
      v2: VersionInput,
      optionsOrLoose?: boolean | SemVerOptions,
    ) => boolean;
  }

  const semver: SemVerApi;
  export const lt: SemVerApi["lt"];
  export default semver;
}
