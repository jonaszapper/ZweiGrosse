import type { Content } from '../content/load';
import type { Look } from '../content/schema';
import { compose, spriteKey, toCanvas, type Mood, type SpriteStage } from '../sprites/compose';

const cache = new Map<string, string>();

/** A composed sprite as an image URL, for use in HTML screens. Scale it up with CSS `image-rendering: pixelated`. */
export function spriteUrl(c: Content, look: Look, mood: Mood = 'happy', stage: SpriteStage = 'sober') {
  const key = spriteKey(look, mood, stage);
  let url = cache.get(key);
  if (!url) { url = toCanvas(compose(c, look, mood, stage)).toDataURL(); cache.set(key, url); }
  return url;
}
