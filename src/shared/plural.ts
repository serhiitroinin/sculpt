/** `plural(1, "part")` is "1 part"; `plural(2, "part")` is "2 parts". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}
