/* Arena mobile picker: compact summary, half sheet, full sheet.
   Desktop keeps its original structure. Only the body scrolls; actions stay visible. */
(function () {
  'use strict';
  const sheet=document.getElementById('sheet'), handle=document.getElementById('sheet-handle'), bar=document.getElementById('filterbar'), workspace=document.querySelector('.workspace');
  if(!sheet||!handle||!bar||!workspace)return;
  const body=sheet.querySelector('.sidebar-body'), query=matchMedia('(max-width:880px)'), motion=matchMedia('(prefers-reduced-motion:reduce)');
  handle.innerHTML='<span class="sheet-grip" aria-hidden="true"></span><span class="sheet-handle__title">Места и филтри</span><span class="sheet-handle__hint">Плъзнете или натиснете <b aria-hidden="true">↑</b></span>';
  // Ценовите категории и бутоните „Брой" и „Цена" живеят НАД картата, докато
  // панелът е затворен. Долу в панела не се виждат изобщо - а точно тогава
  // човек преразглежда решението си („исках 8, искам 6") и ги търси.
  const rail=document.createElement('div');rail.className='map-rail';rail.hidden=true;
  const railPills=document.createElement('div');railPills.className='map-rail__pills';railPills.hidden=true;
  // Категориите слизат в лист, който се вика с бутон. Постоянната лента с
  // хапчета изяждаше 47px от схемата, а пак не ги показваше всичките.
  const tierWrap=document.createElement('div');tierWrap.className='tier-sheet';tierWrap.hidden=true;
  // Цената е ЕДНО решение, не две. Плъзгачът стои най-отгоре и води: щом го
  // мръднеш, категориите под него сами светват и гаснат. Двата бутона („Цена"
  // и „Категории") станаха един, наречен „Цена".
  // Стрелката отгоре е дръжка: тап я затваря, а цялата карта се дърпа надолу
  // като чекмедже. Преди единственият изход беше „Готово" най-долу или
  // да се сетиш, че сивото над картата се натиска.
  tierWrap.innerHTML='<div class="tier-sheet__veil"></div><div class="tier-sheet__card" role="dialog" aria-modal="true" aria-label="Цена">'
    +'<button type="button" class="tier-sheet__grip" aria-label="Затворете"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg></button>'
    +'<p class="tier-sheet__head">Цена на билет</p><div class="tier-sheet__price"></div>'
    +'<p class="tier-sheet__head tier-sheet__head--2">Цените в залата</p><div class="tier-sheet__slot"></div>'
    +'<div class="tier-sheet__tables" hidden></div>'
    +'<button type="button" class="tier-sheet__ok">Готово</button></div>';
  const railChips=tierWrap.querySelector('.tier-sheet__slot'),
        priceSlot=tierWrap.querySelector('.tier-sheet__price');
  // Масите са друг продукт: 150-217 € на място срещу 30-80 € за място в
  // залата. Затова своя стълбица - иначе всяка маса би била еднакво „червена".
  (function tableLegend(){
    const box=tierWrap.querySelector('.tier-sheet__tables'),
          levels=window.VENUE&&window.VENUE.meta&&window.VENUE.meta.tableLevels,
          // Местата на масата идват от данните; 6 е само резервата, ако ги няма.
          TABLE_SEATS_FALLBACK=6,
          firstTable=window.VENUE&&window.VENUE.tables&&window.VENUE.tables.features&&window.VENUE.tables.features[0],
          tableSeats=Number(firstTable&&firstTable.properties&&firstTable.properties.seats)||TABLE_SEATS_FALLBACK;
    if(!box||!levels||!levels.length)return;
    box.hidden=false;
    // Числото в квадратчето е цялата маса, както в балончето на схемата.
    // Цената на място стои отдолу като факт, а не като обяснение: „Или по
    // 255-640 € на място. Натиснете цвят, за да видите тези маси." казваше
    // на глас това, което цветните бутони и без това показват.
    const naMqsto=levels.map(l=>Math.round(l.eurPerSeat)).filter(n=>n);
    // Цветовете не са само мостри: всеки води камерата при свободните маси от
    // своята категория, за да не се търси „коя беше червената" по схемата.
    box.innerHTML='<p class="tier-sheet__head tier-sheet__head--2">Цели маси, '+tableSeats+' места</p><div class="tier-sheet__ramp">'
      +levels.map(l=>'<button type="button" data-lvl="'+l.level+'" style="background:'+l.color+'" aria-label="Покажете масите по '+l.label+'"><i>'+l.label+'</i></button>').join('')+'</div>'
      +(naMqsto.length?'<p class="tier-sheet__note">'+Math.min.apply(null,naMqsto)+'-'+Math.max.apply(null,naMqsto)+' € на място</p>':'');
    box.querySelector('.tier-sheet__ramp').addEventListener('click',e=>{
      const b=e.target.closest('button[data-lvl]');if(!b)return;
      openTiers(false);
      if(window.__tableLevelGo)window.__tableLevelGo(Number(b.dataset.lvl));
    });
  })();
  const tierPill=document.createElement('button');tierPill.type='button';
  tierPill.className='fb-pill map-pill-tiers';tierPill.textContent='Цена';
  rail.append(railPills);workspace.prepend(rail);workspace.append(tierWrap);
  const filters=document.querySelector('.filters');
  function openTiers(open){
    tierWrap.hidden=!open;
    tierPill.setAttribute('aria-expanded',String(open));
    if(open)tierWrap.querySelector('.tier-sheet__ok').focus({preventScroll:true});else tierPill.focus({preventScroll:true});
  }
  // Плъзгачът се вгражда чак при първото отваряне: тогава границите на цените
  // вече са известни на двигателя.
  let priceWidget=null;
  function mountPriceOnce(){
    if(priceWidget||!window.UI||typeof window.UI.mountPrice!=='function')return;
    priceWidget=window.UI.mountPrice(priceSlot,priceMoved);
  }
  // Дръжката движи и чиповете: цените извън диапазона гаснат, тези вътре
  // светват. Иначе човек мести плъзгача, а отдолу продължава да свети
  // категория, която вече не търси.
  // Вдигнато е, докато плъзгачът сам пренарежда чиповете: иначе обратната
  // връзка веднага би дръпнала дръжката към границите на категориите.
  let otPlazgacha=false;
  function priceMoved(v){
    if(!window.UI||typeof window.UI.tiersInRange!=='function')return;
    otPlazgacha=true;setTimeout(()=>{otPlazgacha=false;},0);
    const искани=new Set(window.UI.tiersInRange(v.min,v.max,v.feesIncluded)),
          chips=Array.from(railChips.querySelectorAll('.chip:not(.chip-all)')),
          all=railChips.querySelector('.chip-all');
    if(!chips.length)return;
    // Целият диапазон значи „всички": тогава филтърът по категории пада, за да
    // няма два начина да се каже едно и също.
    if(chips.every(c=>искани.has(Number(c.dataset.tier)))){
      if(all&&!all.classList.contains('is-active'))all.click();
      return;
    }
    const трябва=chips.filter(c=>искани.has(Number(c.dataset.tier))!==c.classList.contains('is-active'));
    if(!трябва.length)return;
    // Всеки клик прерисува схемата, а с нея и самите чипове. Затова всички
    // освен последния се пипат наум, а истинският клик е един - той чете
    // състоянието на целия ред и го подава на двигателя веднъж.
    for(let i=0;i<трябва.length-1;i++)трябва[i].classList.toggle('is-active');
    трябва[трябва.length-1].click();
  }
  // Ръчен клик по категория. Двата филтъра се прилагат ЗАЕДНО, затова избор
  // извън диапазона на плъзгача не би върнал нито едно място. Вместо да
  // мълчи, диапазонът се разтяга точно до избраните категории.
  railChips.addEventListener('click',ev=>{
    if(otPlazgacha||!ev.target.closest('.chip'))return;
    setTimeout(()=>{
      if(!priceWidget||!window.UI||typeof window.UI.tierRange!=='function')return;
      const on=Array.from(railChips.querySelectorAll('.chip:not(.chip-all).is-active')).map(c=>Number(c.dataset.tier)),
            v=priceWidget.getValues(), r=window.UI.tierRange(on,v.feesIncluded);
      if(r&&(r.min!==v.min||r.max!==v.max))priceWidget.setAndApply(r.min,r.max);
    },0);
  });
  tierPill.addEventListener('click',()=>{const open=tierWrap.hidden;if(open)mountPriceOnce();openTiers(open);});
  tierWrap.querySelector('.tier-sheet__ok').addEventListener('click',()=>openTiers(false));
  (function dragToClose(){
    const card=tierWrap.querySelector('.tier-sheet__card'),grip=tierWrap.querySelector('.tier-sheet__grip');
    let d=null,ignoreClick=false;
    grip.addEventListener('click',()=>{if(ignoreClick){ignoreClick=false;return;}openTiers(false);});
    card.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.isPrimary===false)return;
      // Плъзгачът, полетата и бутоните си имат своя работа с пръста.
      if(e.target.closest('input,select,textarea,button:not(.tier-sheet__grip),a,.range-input'))return;
      d={id:e.pointerId,y:e.clientY,lastY:e.clientY,lastT:e.timeStamp,v:0,moved:false};
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove',e=>{
      if(!d||d.id!==e.pointerId)return;
      const dy=e.clientY-d.y,dt=e.timeStamp-d.lastT;
      if(dt>0)d.v=(e.clientY-d.lastY)/dt;
      d.lastY=e.clientY;d.lastT=e.timeStamp;d.moved ||= Math.abs(dy)>6;
      if(!d.moved)return;
      e.preventDefault();card.classList.add('is-dragging');
      card.style.transform='translateY('+Math.max(0,dy)+'px)';
    });
    function release(e){
      if(!d||d.id!==e.pointerId)return;
      const st=d;d=null;card.classList.remove('is-dragging');
      if(!st.moved){card.style.transform='';return;}
      ignoreClick=true;setTimeout(()=>{ignoreClick=false;},0);
      const dy=e.clientY-st.y;
      // Отпуснато надолу над третина от картата или с замах: затваря се.
      if(dy>card.clientHeight/3||(dy>24&&st.v>0.5)){
        card.style.transform='translateY(110%)';
        const done=()=>{card.style.transform='';openTiers(false);};
        matchMedia('(prefers-reduced-motion: reduce)').matches?done():card.addEventListener('transitionend',done,{once:true});
        setTimeout(()=>{if(!tierWrap.hidden)done();},260);
      } else card.style.transform='';
    }
    card.addEventListener('pointerup',release);card.addEventListener('pointercancel',release);
  })();
  tierWrap.querySelector('.tier-sheet__veil').addEventListener('click',()=>openTiers(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tierWrap.hidden)openTiers(false);});
  // Надписът носи състоянието: иначе трябва да отвориш листа, за да разбереш
  // дали филтърът е включен.
  function markTiers(){
    const chips=Array.from(railChips.querySelectorAll('.chip')),
          all=chips.find(c=>c.classList.contains('chip-all')),
          on=chips.filter(c=>c!==all&&c.classList.contains('is-active'));
    // Надписът за цената идва от самото хапче на двигателя: то вече смята дали
    // диапазонът стеснява нещо и как се изписва. Стесни ли, то води; иначе
    // говорят категориите.
    const engine=bar.querySelector('.fb-pill-price'),
          цена=engine?engine.textContent.trim():'Цена';
    tierPill.textContent=цена!=='Цена'?цена
      :(on.length?(on.length===1?on[0].textContent.trim():on.length+' категории'):'Цена');
    tierPill.classList.toggle('is-active',цена!=='Цена'||on.length>0);
  }
  // Височината на лентата се мери, а не се гадае: зумът и „Цялата зала" сядат
  // точно под нея и когато хапчетата се пренаредят.
  function syncRail(){
    rail.hidden=!active;
    railPills.hidden=!railPills.children.length;
    workspace.style.setProperty('--rail-h',(rail.hidden?0:Math.round(rail.offsetHeight))+'px');
    if(!active)openTiers(false);
  }
  new ResizeObserver(syncRail).observe(rail);
  function homeChips(){
    if(!filters)return;
    const home=active?railChips:filters, row=(active?filters:railChips).querySelector('.chip-row');
    // Само един ред: двигателят прави нов при смяна на филтър, старият си отива.
    if(row){home.querySelectorAll('.chip-row').forEach(old=>old.remove());home.append(row);}
    markTiers();
    syncRail();
  }
  new MutationObserver(markTiers).observe(railChips,{subtree:true,attributes:true,attributeFilter:['class']});
  // „Брой" и „Цена" се качват горе само докато панелът е затворен. В отворен
  // панел си остават на старото място - едно хапче, едно място, без двойници.
  // „Цена" вече не пътува горе - плъзгачът ѝ живее в панела на едно хапче с
  // категориите. Горе се качва само „Брой".
  const movable=root=>Array.from(root.querySelectorAll('.fb-pill'))
    .filter(pill=>!pill.classList.contains('fb-pill-rec')&&!pill.classList.contains('fb-pill-viewed')
      &&!pill.classList.contains('fb-pill-icon')&&!pill.classList.contains('fb-pill-price')
      &&!pill.classList.contains('map-pill-tiers'));
  function homePills(){
    const fresh=movable(bar);
    if(active&&mode==='peek'){if(fresh.length){railPills.textContent='';railPills.append(...fresh,tierPill);}}
    // Двигателят прави нови хапчета при всяка смяна на филтър: старите горе
    // вече не се обновяват, затова си отиват, вместо да лъжат с „Брой · 8".
    else if(fresh.length){railPills.textContent='';openTiers(false);}
    else{const moved=movable(railPills);
      // Редът долу си остава какъвто беше: ⚙ първо, после „Брой" и „Цена".
      if(moved.length)(bar.querySelector('.fb-pill-icon')||bar).after(...moved);
      railPills.textContent='';openTiers(false);}
    markTiers();
    syncRail();
  }
  // Двигателят пренаписва .filters и #filterbar при смяна на филтър: новите
  // хапчета трябва да се приберат горе, иначе изчезват след първия избор.
  if(filters)new MutationObserver(homeChips).observe(filters,{childList:true});
  new MutationObserver(homePills).observe(bar,{childList:true});

  const summary=document.createElement('div');summary.className='sheet-summary';
  summary.innerHTML='<div class="sheet-sum__line"><button type="button" class="sheet-summary__details" aria-label="Разгледайте избраните места"><strong>Изберете Вашето място</strong><span>Докоснете схемата</span></button><button type="button" class="sheet-sum__clear" hidden>Изчистете</button></div><div class="sheet-sum__seats" hidden></div><div class="sheet-sum__go"><button type="button" class="sheet-sum__redo" hidden>Други места</button><button type="button" class="sheet-summary__action">Намерете места</button></div>';
  sheet.append(summary);
  const details=summary.querySelector('.sheet-summary__details'), action=summary.querySelector('.sheet-summary__action'),
        seats=summary.querySelector('.sheet-sum__seats'), clear=summary.querySelector('.sheet-sum__clear'),
        line=summary.querySelector('.sheet-sum__line'),
        redo=summary.querySelector('.sheet-sum__redo'), goRow=summary.querySelector('.sheet-sum__go');
  const EYE='<svg class="seatchip__eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>';
  const X='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  // Редовете в списъка се пренаписват при всеки избор, затова чипът пази текста
  // и намира своя ред чак когато го натиснат.
  const rowKey=row=>(row.querySelector('.pk-sector')?.textContent||'')+'|'+(row.querySelector('.pk-seat')?.textContent||'');
  function rowFor(key){return Array.from(document.querySelectorAll('.pk-row')).find(row=>rowKey(row)===key)||null;}
  // Едно хапче на РЕД, не на място. Осем места в един ред са едно решение:
  // осем еднакви хапчета само пълнеха лентата с хоризонтален скрол.
  function groupSeats(){
    const groups=new Map();
    for(const row of document.querySelectorAll('.pk-row')){
      const sector=row.querySelector('.pk-sector')?.textContent||'',
            seat=(row.querySelector('.pk-seat')?.textContent||'').trim(),
            price=row.querySelector('.pk-price')?.textContent||'',
            match=seat.match(/^ред\s+([^,]+),\s*място\s+(\d+)$/),
            key=sector+'|'+(match?'ред '+match[1]:seat);
      if(!groups.has(key))groups.set(key,{sector:sector,row:match?match[1]:'',seats:[],keys:[],sum:0,priced:true});
      const group=groups.get(key);
      group.keys.push(rowKey(row));
      group.seats.push(match?Number(match[2]):seat);
      const amount=parseFloat((price||'').replace(/[^\d.,]/g,'').replace(',','.'));
      if(Number.isFinite(amount))group.sum+=amount;else group.priced=false;
      if(!group.pano&&row.querySelector('.pk-360:not(.is-off)'))group.pano=rowKey(row);
    }
    return Array.from(groups.values());
  }
  function seatSpan(group){
    if(!group.row)return String(group.seats[0]);
    const list=group.seats.slice().sort((a,b)=>a-b);
    if(list.length===1)return 'място '+list[0];
    const solid=list.every((n,i)=>i===0||n===list[i-1]+1);
    return 'места '+(solid?list[0]+' - '+list[list.length-1]:list.join(', '));
  }
  function paintSeats(){
    const groups=groupSeats();
    seats.textContent='';
    for(const group of groups){
      const chip=document.createElement('div');chip.className='seatchip';
      const head=group.sector+(group.row?' · ред '+group.row:''),
            span=seatSpan(group),
            money=group.priced&&group.sum?' · '+Math.round(group.sum)+' €':'',
            label='<span class="seatchip__txt"><b>'+head+'</b><i>'+span+money+'</i></span>';
      if(group.pano){
        const view=document.createElement('button');view.type='button';view.className='seatchip__view';
        view.innerHTML=EYE+label;
        view.setAttribute('aria-label',(window.SeatMap?.mode==='2d'?'На схемата: ':'Изглед от мястото: ')+head+', '+span);
        view.addEventListener('click',()=>rowFor(group.pano)?.querySelector('.pk-360:not(.is-off)')?.click());
        chip.append(view);
      } else {
        const flat=document.createElement('span');flat.className='seatchip__view is-flat';flat.innerHTML=label;
        chip.append(flat);
      }
      const kill=document.createElement('button');kill.type='button';kill.className='seatchip__x';
      kill.innerHTML=X;
      kill.setAttribute('aria-label',group.seats.length===1?'Премахнете '+head+', '+span
        :'Премахнете '+group.seats.length+' места: '+head);
      // Списъкът се пренаписва след всяко махане, затова редът се търси наново.
      kill.addEventListener('click',()=>{for(const key of group.keys)rowFor(key)?.querySelector('.pk-x')?.click();});
      chip.append(kill);
      seats.append(chip);
    }
    seats.hidden=!groups.length;
    clear.hidden=groups.length<2;
    seats.classList.toggle('is-scroller',seats.scrollWidth-seats.clientWidth>4);
  }
  clear.addEventListener('click',()=>document.querySelector('.pk-clear')?.click());
  let mode='peek', selected=[], count=0, active=false, drag=null, frame=0, settle=0, ignoreClick=false, viewportWidth=innerWidth;
  // С избрани места лентата носи чиповете. Трите ѝ реда не се свиват (CSS),
  // затова височината на листа се мери по тях, а не обратното.
  function summaryHeight(){
    const style=getComputedStyle(summary), gap=parseFloat(style.rowGap)||0;
    const rows=[line,seats,goRow].filter(el=>el&&el.offsetHeight>0);
    return rows.reduce((sum,el)=>sum+el.offsetHeight,0)+gap*(rows.length-1)
      +parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
  }
  const heights=()=>{const height=workspace.clientHeight;
    const peek=count
      ? Math.min(height*.55,Math.max(180,handle.offsetHeight+summaryHeight()+2))
      : Math.min(156,Math.max(132,height*.18));
    return {peek:peek,half:Math.max(320,height*.66),full:Math.max(320,height-4)};};
  function paintHeight(height){workspace.style.setProperty('--sheet-h',Math.round(height)+'px');}
  // Скрол ли е или свършва тук: ръбът избледнява само докато има още отдолу.
  function markScroll(){
    const more=body.scrollHeight-body.clientHeight-body.scrollTop>6;
    body.classList.toggle('has-more',active&&mode!=='peek'&&more);
  }
  body.addEventListener('scroll',markScroll,{passive:true});
  function go(next,focus=false){
    if(!active)return;
    mode=next;sheet.dataset.mode=mode;sheet.classList.toggle('is-open',mode!=='peek');
    handle.setAttribute('aria-expanded',String(mode!=='peek'));
    handle.setAttribute('aria-label',mode==='peek'?'Отворете местата и филтрите':'Затворете панела и се върнете към схемата');
    handle.querySelector('.sheet-handle__hint').innerHTML=mode==='peek'?'Отворете <b aria-hidden="true">↑</b>':'Затворете <b aria-hidden="true">↓</b>';
    if(mode==='peek'&&body.contains(document.activeElement))handle.focus({preventScroll:true});
    body.inert=mode==='peek';
    homePills();
    // Мери се СЛЕД смяната на режима: в отворен панел чиповете са скрити и
    // височината за „peek" би излязла по-ниска, отколкото е.
    const stops=heights();
    // Осем места не се събират на половин екран. По-добре отваряме направо
    // целия панел, отколкото да оставим скрит списък под ръба.
    if(mode==='half'&&body.scrollHeight>stops.half-handle.offsetHeight-summaryHeight()+4){
      mode='full';sheet.dataset.mode=mode;
    }
    if(mode==='peek')workspace.style.setProperty('--sheet-peek',Math.round(stops.peek)+'px');
    paintHeight(stops[mode]);
    markScroll();
    sheet.classList.add('is-moving');clearTimeout(settle);settle=setTimeout(()=>sheet.classList.remove('is-moving'),motion.matches?0:320);
    if(focus)handle.focus({preventScroll:true});
  }
  function syncSummary(){
    const total=document.querySelector('.pk-total-v')?.textContent||'';
    const rows=Array.from(document.querySelectorAll('.pk-row'));
    count=Number((document.querySelector('.pk-total-k')?.textContent||'0').match(/\d+/)?.[0]||0);
    details.querySelector('strong').textContent=count?count+(count===1?' билет':' билета')+' · '+total:'Изберете Вашето място';
    const groups=new Map();
    for(const row of rows){
      const sector=row.querySelector('.pk-sector')?.textContent||'',seat=row.querySelector('.pk-seat')?.textContent||'',match=seat.match(/ред\s+([^,]+),\s*място\s+(\d+)/);
      const key=sector+(match?' · ред '+match[1]:'');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(match?Number(match[2]):seat);
    }
    const labels=Array.from(groups,([name,seats])=>{
      if(typeof seats[0]!=='number')return name+' · '+seats[0];
      seats.sort((a,b)=>a-b);const consecutive=seats.every((n,i)=>i===0||n===seats[i-1]+1);
      return name+' · '+(seats.length===1?'място '+seats[0]:'места '+(consecutive?seats[0]+' - '+seats[seats.length-1]:seats.join(', ')));
    });
    details.querySelector('span').textContent=labels.length?labels.slice(0,2).join(' / ')+(labels.length>2?' · още '+(labels.length-2)+' сектора':''):'Докоснете схемата';
    action.textContent=count?'Продължете →':'Препоръчайте ми места';
    // Не хареса ли препоръката, следващата е на един тап. Досега трябваше да
    // махнеш билета, да отвориш панела и чак там да натиснеш - три тапа.
    redo.hidden=!count;
    redo.textContent=window.__tablesSelected&&window.__tablesSelected()?'Друга маса':'Други места';
    action.setAttribute('aria-label',count?'Продължете към покупка на '+count+' билета':'Препоръчайте ми свободни места');
    sheet.classList.toggle('has-pick',count>0);
    paintSeats();
    markScroll();
    if(active&&mode==='peek'){const peek=heights().peek;workspace.style.setProperty('--sheet-peek',Math.round(peek)+'px');paintHeight(peek);}
  }
  function activate(){
    active=query.matches;
    if(active){body.prepend(bar);homeChips();homePills();workspace.style.setProperty('--sheet-peek',Math.round(heights().peek)+'px');syncSummary();go(mode);}
    else{body.before(bar);homeChips();homePills();body.inert=false;delete sheet.dataset.mode;sheet.classList.remove('is-open','is-dragging');workspace.style.removeProperty('--sheet-h');document.documentElement.style.removeProperty('--sheet-peek');workspace.style.removeProperty('--sheet-peek');}
    window.__map?.resize();
  }
  details.onclick=()=>go(mode==='peek'?'half':'full');
  const askAgain=()=>window.__recommendAgain?window.__recommendAgain():document.querySelector('.fb-pill-rec')?.click();
  action.onclick=()=>count?window.__onBuy?.():askAgain();
  redo.onclick=askAgain;
  // Едно докосване = отвори или затвори. Трите спирки остават за плъзгането и
  // за стрелките от клавиатурата; „наполовина после изцяло" с два тапа беше
  // ребус, а от „наполовина" пътят назад към схемата ставаше два тапа.
  handle.addEventListener('click',()=>{if(ignoreClick){ignoreClick=false;return;}go(mode==='peek'?'half':'peek');});
  handle.addEventListener('keydown',e=>{if(!active)return;if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const stops=['peek','half','full'];go(stops[Math.max(0,Math.min(2,stops.indexOf(mode)+(e.key==='ArrowUp'?1:-1)))]);}if(e.key==='Escape')go('peek');});
  sheet.addEventListener('keydown',e=>{if(active&&e.key==='Escape'&&!document.querySelector('.popover'))go('peek',true);});
  handle.addEventListener('pointerdown',e=>{
    if(!active||e.button!==0||e.isPrimary===false)return;
    drag={id:e.pointerId,y:e.clientY,height:sheet.clientHeight,lastY:e.clientY,lastT:e.timeStamp,velocity:0,moved:false,stops:heights()};
    handle.setPointerCapture(e.pointerId);sheet.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const delta=drag.y-e.clientY,elapsed=e.timeStamp-drag.lastT;
    if(elapsed>0)drag.velocity=(drag.lastY-e.clientY)/elapsed;
    drag.lastY=e.clientY;drag.lastT=e.timeStamp;drag.moved ||= Math.abs(delta)>6;
    if(!drag.moved)return;
    e.preventDefault();cancelAnimationFrame(frame);
    const next=Math.max(drag.stops.peek,Math.min(drag.stops.full,drag.height+delta));frame=requestAnimationFrame(()=>paintHeight(next));
  });
  function release(e){
    if(!drag||drag.id!==e.pointerId)return;
    const state=drag;drag=null;cancelAnimationFrame(frame);sheet.classList.remove('is-dragging');
    if(!state.moved)return;
    ignoreClick=true;setTimeout(()=>{ignoreClick=false;},0);
    const projected=Math.max(state.stops.peek,Math.min(state.stops.full,sheet.clientHeight+state.velocity*140));
    const next=Object.keys(state.stops).sort((a,b)=>Math.abs(state.stops[a]-projected)-Math.abs(state.stops[b]-projected))[0];go(next);
  }
  handle.addEventListener('pointerup',release);handle.addEventListener('pointercancel',e=>{if(drag){drag=null;cancelAnimationFrame(frame);sheet.classList.remove('is-dragging');go(mode);}});
  window.addEventListener('arena:seat-picked',e=>{
    const next=Array.from(document.querySelectorAll('.pk-row')).map(row=>row.textContent);
    const added=next.some(item=>!selected.includes(item));selected=next;syncSummary();
    if(active&&(added||!count))go('peek');
  });
  window.addEventListener('arena:whole-hall',()=>go('peek'));
  window.addEventListener('arena:map-focus',()=>go('peek'));
  document.getElementById('map').addEventListener('pointerdown',()=>{if(active&&mode!=='peek')go('peek');},{passive:true});
  query.addEventListener('change',activate);
  window.addEventListener('resize',()=>{if(!active||drag)return;if(viewportWidth===innerWidth&&matchMedia('(pointer:coarse)').matches)return;viewportWidth=innerWidth;workspace.style.setProperty('--sheet-peek',Math.round(heights().peek)+'px');go(mode);window.__map?.resize();});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{if(active){viewportWidth=innerWidth;workspace.style.setProperty('--sheet-peek',Math.round(heights().peek)+'px');go(mode);window.__map?.resize();}},300));
  activate();
})();
