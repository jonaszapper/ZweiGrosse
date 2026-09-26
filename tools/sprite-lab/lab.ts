import { content as c } from '../../src/content/browser';
import { compose, toCanvas, type Mood, type SpriteStage } from '../../src/sprites/compose';
import type { Look } from '../../src/content/schema';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const moods: Mood[] = ['neutral', 'happy', 'sad', 'angry'];
let crowd: Look[] = [];

const randomLook = (): Look => ({ skin: pick(c.palette.skins), hair: pick(c.palette.hairs), hairStyle: pick(Object.keys(c.parts.hair)), outfit: pick(c.palette.outfits) });
const reroll = () => { crowd = Array.from({ length: 16 }, randomLook); draw(); };

function tile(look: Look, mood: Mood, label: string) {
  const z = +$<HTMLInputElement>('#zoom').value;
  const stage = $<HTMLSelectElement>('#stage').value as SpriteStage;
  const cv = toCanvas(compose(c, look, mood, stage, { outline: $<HTMLInputElement>('#outline').checked, shade: $<HTMLInputElement>('#shade').checked }));
  cv.style.width = `${cv.width * z}px`; cv.style.height = `${cv.height * z}px`;
  const f = document.createElement('figure'); f.append(cv); f.append(label); return f;
}

function section(title: string, tiles: HTMLElement[]) {
  const h = document.createElement('h2'); h.textContent = title;
  const g = document.createElement('div'); g.className = 'grid'; g.append(...tiles);
  $('#out').append(h, g);
}

function draw() {
  $('#out').innerHTML = '';
  const base: Look = { skin: c.palette.skins[1], hair: c.palette.hairs[3], hairStyle: 'bowl', outfit: c.palette.outfits[0] };
  section('Hair styles × moods', Object.keys(c.parts.hair).flatMap(h => moods.map(m => tile({ ...base, hairStyle: h }, m, `${h} / ${m}`))));
  section('Accessories', Object.keys(c.parts.accessory).map(a => tile({ ...base, accessory: a, hairStyle: a === 'combover' ? 'none' : base.hairStyle }, 'neutral', a)));
  section('Strangers', Object.values(c.strangers).filter(s => s.look).map(s => tile({ ...s.look!, accessory: s.accessory }, 'neutral', s.id)));
  section('Skin tones', c.palette.skins.map(skin => tile({ ...base, skin }, 'happy', skin)));
  section('Random crowd', crowd.map((l, i) => tile(l, moods[i % 4], '')));
}

['#zoom', '#stage', '#outline', '#shade'].forEach(s => $(s).addEventListener('input', draw));
$('#reroll').addEventListener('click', reroll);
reroll();
