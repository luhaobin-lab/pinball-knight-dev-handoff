/** The naming rule D11: the JS identifier of a Demo name. */
export function mangle(name: string): string;
/** Mangles every name; throws when two of them collide. */
export function mangleAll(names: readonly string[], where: string): string[];
