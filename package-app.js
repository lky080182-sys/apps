import {packages} from './packages.js';

const $=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('zh-HK',{minimumFractionDigits:2,maximumFractionDigits:2});
const cash=n=>fmt.format(n/100);
const asCents=n=>Math.round((n+Number.EPSILON*Math.max(1,Math.abs(n)))*100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const presets=new Map(packages.map(p=>[p.key,p]));
const changes=new Map();
const selectedByType={'公屋':packages.find(p=>p.key.startsWith('公屋')).key,'居屋':packages.find(p=>p.key.startsWith('居屋')).key};
const PROFIT=15;
let type='公屋',selected=presets.get(selectedByType[type]);
const keyLabel=k=>k.replace('_',' · ');
const makeQty=p=>p.lines.map(r=>String(r[3]));
const qtyFor=()=> {
  if(!changes.has(selected.key))changes.set(selected.key,makeQty(selected));
  return changes.get(selected.key);
};
function choose(p){
  selected=p;
  selectedByType[type]=p.key;
  $('status').hidden=true;
  renderOptions();
  renderLines();
}
function renderOptions(){
  document.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===type)));
  $('package-options').innerHTML=packages.filter(p=>p.key.startsWith(type)).map(p=>{
    const [size,kind]=p.key.slice(type.length).split('_');
    return `<button type="button" data-key="${esc(p.key)}" aria-pressed="${p===selected}" aria-label="${esc(keyLabel(p.key))}"><strong>${esc(size)}</strong><span>${esc(kind)}</span></button>`;
  }).join('');
}
function renderLines(){
  const quantities=qtyFor();
  const [title,...spec]=selected.spec.split(' | ');
  $('quote-package').textContent=keyLabel(selected.key);
  $('details-subtitle').textContent=`${title} · ${selected.lines.length} 項工序`;
  $('spec').textContent=spec.join(' · ');
  $('lines').innerHTML=selected.lines.map(([code,name,unit,qty,price,note],i)=>`
    <div class="line">
      <div class="description"><h3><span class="code">${esc(code)}</span> ${esc(name)}</h3><p>HK$ ${cash(asCents(price))} / ${esc(unit)}</p>${note?`<p class="line-note">${esc(note)}</p>`:''}</div>
      <label class="qty"><span>數量</span><input type="number" inputmode="decimal" min="0" max="1000000" step="any" data-row="${i}" aria-label="${esc(`${code} ${name} 數量（${unit}）`)}" aria-describedby="qty-help" value="${esc(quantities[i])}"></label>
      <div class="subtotal"><span>底價小計</span><strong data-subtotal="${i}"></strong></div>
    </div>`).join('');
  recalc();
}
function recalc(){
  const values=qtyFor();
  let base=0,invalid=false;
  for(const input of $('lines').querySelectorAll('[data-row]')){
    const i=Number(input.dataset.row),v=input.valueAsNumber;
    values[i]=input.value;
    const subtotal=$('lines').querySelector(`[data-subtotal="${i}"]`);
    if(!Number.isFinite(v)||!input.validity.valid){
      invalid=true;
      input.setAttribute('aria-invalid','true');
      subtotal.textContent='請核對數量';
    }else{
      input.removeAttribute('aria-invalid');
      const line=asCents(selected.lines[i][4]*v);
      base+=line;
      subtotal.textContent=`HK$ ${cash(line)}`;
    }
  }
  const profit=Math.round(base*PROFIT/100);
  $('base-total').textContent=invalid?'待確認':`HK$ ${cash(base)}`;
  $('profit-total').textContent=invalid?'待確認':`HK$ ${cash(profit)}`;
  $('package-total').value=invalid?'待確認':cash(base+profit);
  $('bottom-total').textContent=invalid?'請核對數量':`HK$ ${cash(base+profit)}`;
  $('reset').disabled=!values.some((q,i)=>q===''||Number(q)!==selected.lines[i][3]);
}
document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{
  if(type===b.dataset.type)return;
  type=b.dataset.type;
  choose(presets.get(selectedByType[type]));
}));
$('package-options').addEventListener('click',e=>{
  const btn=e.target.closest('[data-key]');
  if(!btn||selected.key===btn.dataset.key)return;
  choose(presets.get(btn.dataset.key));
  [...$('package-options').querySelectorAll('button')].find(b=>b.dataset.key===selected.key)?.focus({preventScroll:true});
});
$('lines').addEventListener('input',e=>{
  if(e.target.matches('[data-row]')){
    $('status').hidden=true;
    recalc();
  }
});
$('reset').addEventListener('click',()=>{
  changes.set(selected.key,makeQty(selected));
  renderLines();
  $('status').textContent='已還原此套餐嘅預設數量。';
  $('status').hidden=false;
});
renderOptions();renderLines();
