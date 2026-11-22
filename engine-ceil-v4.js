import { config, items } from './catalog.js';

export const defaults = Object.fromEntries(Object.entries(config).map(([k,v]) => [k,v.default]));
export const itemMap = new Map(items.map(i => [i[1],i]));
export const extraKeys = ['loading','protection','cleaning','caulk','touchup'];
export const fmt = new Intl.NumberFormat('zh-HK',{minimumFractionDigits:0,maximumFractionDigits:2});
export const money = n => fmt.format(n);
export const cents = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const factorDetails = settings => {
  const n = k => config[k].options[settings[k]][1];
  return {site:n('site'),fin:n('payment')+n('risk'),profit:n('profit'),extras:extraKeys.reduce((t,k)=>t+n(k),0)};
};
export function rate(item, tier, supply, settings) {
  const {site,fin,profit,extras}=factorDetails(settings);
  return Math.ceil(item[6+tier*2+supply]*site*(1+profit+extras)*(1+fin));
}
