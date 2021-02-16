
/**
 * JS file containing all helpers that you don't know what to with.
 */

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}