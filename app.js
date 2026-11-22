import {config,items} from './catalog.js';
import {cents,defaults,itemMap,money,rate} from './engine.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modes=['二判 · 連工包料','二判 · 淨安裝','三判 · 連工包料','三判 · 淨安裝'];
const labels={site:'工地類型',payment:'收款期',risk:'壞帳風險',profit:'公司利潤',loading:'上料',protection:'保護',cleaning:'清場',caulk:'唧膠',touchup:'細油執色'};
const groups=[['site'],['payment','risk','profit'],['loading','protection','cleaning','caulk','touchup']];
const groupTitles=['工地','收款及利潤','工地附加費'];
const index=items.map(item=>({item,terms:`${item[1]} ${item[2]} ${item[0]} ${item[4]}`.normalize('NFKC').toLowerCase()}));
const perPage=7;
let selected=items[0], mode=0, settings={...defaults}, lines=[], pageNo=1, filtered=items, timer;

const cost=(item,m)=>rate(item,m>>1,m%2,settings);
const amount=(q,r)=>cents(q*r);
const validQty=input=>input.value!==''&&input.validity.valid&&Number.isFinite(input.valueAsNumber);
const priceFormat=n=>`HK$ ${money(n)}`;
const settingText=(key,label,value)=>key==='site'?`<span>${esc(label)}</span><small>×${value}</small>`:
  key==='payment'?`<span>${esc(label)}</span><small>${value?(value*100).toFixed(2)+'%':'0%'}</small>`:esc(label);

$('modes').innerHTML=modes.map((m,i)=>`<button type="button" data-mode="${i}" aria-pressed="${i===mode}">${m}</button>`).join('');
$('option-groups').innerHTML=groups.map((keys,i)=>`<div class="settings-group"><h3>${groupTitles[i]}</h3>${keys.map(key=>{
  const {options}=config[key];
  return `<fieldset class="option-field"><legend>${labels[key]}</legend><div class="choice-grid ${key==='site'?'sites':''}" data-setting-group="${key}">${options.map(([label,value],n)=>`<button type="button" data-setting="${key}" data-value="${n}" aria-pressed="${settings[key]===n}">${settingText(key,label,value)}</button>`).join('')}</div></fieldset>`;
}).join('')}</div>`).join('');

function switchView(view,moveFocus=false){
  const isSettings=view==='settings';
  $('calculator').hidden=isSettings;$('settings').hidden=!isSettings;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  if(moveFocus){
    $('show-calculator').scrollIntoView({block:'start'});
    $('show-calculator').focus({preventScroll:true});
  }
}
function filter(){
  const term=$('search').value.normalize('NFKC').toLowerCase().trim();
  const words=term.split(/\s+/).filter(Boolean);
  filtered=index.filter(({terms})=>words.every(w=>terms.includes(w))).map(x=>x.item);
  pageNo=1;renderItems();
}
function renderItems(){
  const pages=Math.max(1,Math.ceil(filtered.length/perPage)),start=(pageNo-1)*perPage;
  const rows=filtered.slice(start,start+perPage);
  $('item-count').textContent=filtered.length?`${filtered.length} 個項目 · ${start+1}–${start+rows.length}`:'0 個項目';
  $('items').innerHTML=rows.length?rows.map(i=>`<button type="button" class="item" data-item="${esc(i[1])}" aria-pressed="${selected===i}"><span class="code">${esc(i[1])}</span><span class="item-text"><strong>${esc(i[2])}</strong><small>${esc(i[3])}</small></span><span class="item-price">${priceFormat(cost(i,mode))}</span></button>`).join(''):
    '<p class="empty">搵唔到工程項目。試下用工程編號或者其他關鍵字。</p>';
  $('pager').innerHTML=pages>1?`<button type="button" class="button secondary" data-page="-1" ${pageNo===1?'disabled':''}>上一頁</button><span>第 ${pageNo}／${pages} 頁</span><button type="button" class="button secondary" data-page="1" ${pageNo===pages?'disabled':''}>下一頁</button>`:'';
}
function updateEditor(){
  const q=$('qty'),valid=validQty(q),price=cost(selected,mode),invalid=!valid&&(q.value!==''||q.validity.badInput);
  $('selected-name').textContent=`${selected[1]} · ${selected[2]}`;
  $('rate').textContent=`${priceFormat(price)} / ${selected[3]}`;
  $('unit').textContent=selected[3];
  $('preview-total').value=valid?money(amount(q.valueAsNumber,price)):'不適用';
  $('scope').textContent=selected[4]||'';$('scope').hidden=!selected[4];
  $('warning').hidden=selected[5]!=='C';$('qty-error').hidden=!invalid;
  if(invalid)q.setAttribute('aria-invalid','true');else q.removeAttribute('aria-invalid');
  $('add').disabled=!valid||q.valueAsNumber<=0;
}
const keyOf=(id,m)=>`${id}:${m}`;
function lineMarkup(l){
  const i=itemMap.get(l.id),key=keyOf(l.id,l.mode),r=cost(i,l.mode);
  return `<article class="line" data-line="${key}"><div class="line-head"><div><h3><span class="code">${esc(l.id)}</span> ${esc(i[2])}</h3><p>${modes[l.mode]} · <span data-line-rate>${priceFormat(r)}</span> / ${esc(i[3])}</p></div><button type="button" class="remove" data-remove="${key}" aria-label="移除 ${esc(l.id)} ${esc(modes[l.mode])}">移除</button></div><div class="line-tail"><label>數量 <input type="number" inputmode="decimal" min="0" max="10000000" step="any" data-quantity="${key}" aria-label="${esc(l.id)} ${esc(modes[l.mode])} 數量" value="${esc(l.invalidValue??l.qty)}"></label><strong data-line-total>${priceFormat(amount(l.qty,r))}</strong></div></article>`;
}
function renderQuote(){
  $('quote-lines').innerHTML=lines.length?lines.map(lineMarkup).join(''):'<p class="empty">未有工程項目。撳「加入報價合計」就可以開始。</p>';
  updateQuote();
}
function updateQuote(){
  let total=0, invalid=false;
  for(const l of lines){
    const el=document.querySelector(`[data-line="${keyOf(l.id,l.mode)}"]`),r=cost(itemMap.get(l.id),l.mode);
    const input=el.querySelector('input'),ok=validQty(input);
    el.querySelector('[data-line-rate]').textContent=priceFormat(r);
    el.querySelector('[data-line-total]').textContent=ok?priceFormat(amount(l.qty,r)):'請輸入有效數量';
    if(ok){input.removeAttribute('aria-invalid');total+=amount(l.qty,r);}
    else{input.setAttribute('aria-invalid','true');invalid=true;}
  }
  $('quote-count').textContent=`${lines.length} 項工程`;
  $('quote-total').textContent=invalid?'請核對數量':priceFormat(cents(total));
}
function status(message){
  clearTimeout(timer);$('add-status').hidden=false;$('add-status').textContent=message;
  timer=setTimeout(()=>$('add-status').hidden=true,3400);
}
function add(){
  const q=$('qty');
  if(!validQty(q)||q.valueAsNumber<=0)return;
  const line=lines.find(l=>l.id===selected[1]&&l.mode===mode);
  if(line){
    if(line.invalidValue!=null){status('請先更正報價清單內呢項工程嘅數量。');return;}
    if(line.qty+q.valueAsNumber>10000000){status('合計數量已達上限。');return;}
    line.qty=Number((line.qty+q.valueAsNumber).toPrecision(15));
  }else lines.push({id:selected[1],mode,qty:q.valueAsNumber});
  renderQuote();status(`已加入 ${selected[1]} · 共 ${lines.length} 項工程`);
}
function syncSettings(){
  document.querySelectorAll('[data-setting]').forEach(b=>b.setAttribute('aria-pressed',String(settings[b.dataset.setting]===Number(b.dataset.value))));
  renderItems();updateEditor();updateQuote();
}
$('search').addEventListener('input',filter);
$('search').addEventListener('search',filter);
$('search').addEventListener('keydown',e=>{
  if(e.key==='Enter')$('items').querySelector('[data-item]')?.click();
});
$('qty').addEventListener('input',updateEditor);
$('add').onclick=add;
$('back').onclick=()=>switchView('calculator',true);
$('reset-settings').onclick=()=>{settings={...defaults};syncSettings();};
$('quote-lines').addEventListener('input',e=>{
  const input=e.target.closest('[data-quantity]');
  if(!input)return;
  const line=lines.find(l=>keyOf(l.id,l.mode)===input.dataset.quantity);
  if(line){
    if(validQty(input)){line.qty=input.valueAsNumber;delete line.invalidValue;}
    else line.invalidValue=input.value;
  }
  updateQuote();
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b)return;
  if(b.dataset.view)switchView(b.dataset.view);
  if(b.dataset.page){
    pageNo+=Number(b.dataset.page);renderItems();
    (document.querySelector(`[data-page="${b.dataset.page}"]:enabled`)||$('search')).focus({preventScroll:true});
  }
  if(b.dataset.item){
    selected=itemMap.get(b.dataset.item);
    document.querySelectorAll('[data-item]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.item===selected[1])));
    updateEditor();
    if(matchMedia('(max-width: 720px)').matches){
      $('editor').scrollIntoView({block:'start'});
      $('editor').focus({preventScroll:true});
    }
  }
  if(b.dataset.mode!=null){
    mode=Number(b.dataset.mode);
    document.querySelectorAll('[data-mode]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn===b)));
    document.querySelectorAll('[data-item]').forEach(btn=>btn.querySelector('.item-price').textContent=priceFormat(cost(itemMap.get(btn.dataset.item),mode)));
    updateEditor();
  }
  if(b.dataset.setting){
    settings[b.dataset.setting]=Number(b.dataset.value);syncSettings();
  }
  if(b.dataset.remove){
    lines=lines.filter(l=>keyOf(l.id,l.mode)!==b.dataset.remove);
    renderQuote();
    const next=$('quote-lines').querySelector('button');
    if(next)next.focus({preventScroll:true});else $('add').focus({preventScroll:true});
  }
});
filter();updateEditor();renderQuote();
