const tabs=[...document.querySelectorAll('.app-tabs [role="tab"]')];
function activate(tab){
  const active=tabs.find(t=>t.getAttribute('aria-selected')==='true');
  if(active===tab)return;
  // Keep the controls visible if switching from the bottom of a long estimate.
  const bar=tab.parentElement;
  const start=bar.parentElement.getBoundingClientRect().top+window.scrollY;
  if(window.scrollY>start) window.scrollTo(0,start);
  for(const choice of tabs){
    const on=choice===tab;
    choice.setAttribute('aria-selected',String(on));
    choice.tabIndex=on?0:-1;
    document.getElementById(choice.getAttribute('aria-controls')).hidden=!on;
  }
  tab.focus({preventScroll:true});
}
tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>activate(tab));
  tab.addEventListener('keydown',e=>{
    const target={ArrowLeft:(i+tabs.length-1)%tabs.length,ArrowRight:(i+1)%tabs.length,Home:0,End:tabs.length-1}[e.key];
    if(target!==undefined){e.preventDefault();activate(tabs[target]);}
  });
});
