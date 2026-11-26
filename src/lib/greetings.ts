// "Hello" in the main language of a visitor's country (ISO code). A few hundred bytes instead of flag images.
const G: Record<string, string> = {
  in: 'Namaste', bd: 'Nomoshkar', np: 'Namaste', pk: 'Assalam-o-Alaikum', lk: 'Ayubowan',
  fr: 'Bonjour', be: 'Bonjour', ch: 'Grüezi', lu: 'Moien', mc: 'Bonjour',
  de: 'Hallo', at: 'Servus', nl: 'Hallo', dk: 'Hej', se: 'Hej', no: 'Hei', fi: 'Moi', is: 'Halló',
  es: 'Hola', mx: 'Hola', ar: 'Hola', co: 'Hola', cl: 'Hola', pe: 'Hola', ve: 'Hola', uy: 'Hola', ec: 'Hola',
  pt: 'Olá', br: 'Olá', it: 'Ciao', gr: 'Yassou', pl: 'Cześć', cz: 'Ahoj', sk: 'Ahoj', hu: 'Szia', ro: 'Salut',
  ua: 'Pryvit', ru: 'Privet', tr: 'Merhaba', il: 'Shalom',
  ae: 'Marhaba', sa: 'Marhaba', qa: 'Marhaba', kw: 'Marhaba', eg: 'Ahlan', ma: 'Salam', jo: 'Marhaba',
  jp: 'Konnichiwa', kr: 'Annyeong', cn: 'Nǐ hǎo', tw: 'Nǐ hǎo', hk: 'Nei hou', sg: 'Hello',
  th: 'Sawasdee', vn: 'Xin chào', id: 'Halo', my: 'Selamat datang', ph: 'Kumusta',
  ke: 'Jambo', tz: 'Jambo', za: 'Howzit', ng: 'Hello', gh: 'Akwaaba',
  us: 'Hey', ca: 'Hello', gb: 'Hello', ie: 'Dia duit', au: "G'day", nz: 'Kia ora',
};
export const greetingFor = (code: string) => G[code.toLowerCase()] ?? 'Hello';

/** 🇮🇳 from "in": two regional-indicator letters, drawn by the device's own emoji font. */
export const flagEmoji = (code: string) =>
  /^[a-z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';
