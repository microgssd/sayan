import 'server-only';
import { cookies } from 'next/headers';
import { dictionaries, isLang, LANG_COOKIE, type Lang } from '.';

/** The visitor's chosen language (English unless they picked another). */
export function getLang(): Lang {
  const v = cookies().get(LANG_COOKIE)?.value;
  return isLang(v) ? v : 'en';
}

export const getDict = (lang: Lang = getLang()) => dictionaries[lang];
