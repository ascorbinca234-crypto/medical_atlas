/* Human-readable progress reports. All document generation stays in this browser. */
(function(){
  'use strict';
  const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const assets = () => new URL('../assets/report-export/', location.href);
  const clean = value => String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '');
  const atlasText = value => {
    const template = document.createElement('template');
    template.innerHTML = String(value || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(p|li|tr)>/gi, '\n');
    return clean(template.content.textContent).replace(/[{}]/g, '').trim();
  };
  const date = value => value ? new Date(value).toLocaleString('ru-RU', {dateStyle:'medium', timeStyle:'short'}) : 'Нет данных';
  const percent = value => Math.round((value || 0) * 100) + ' %';
  const fileDate = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };

  function report(P){
    P.flush();
    const S = P.S(), course = P.course(), blocks = [];
    const text = value => blocks.push({type:'paragraph', text:clean(value)});
    const heading = value => blocks.push({type:'heading', text:value});
    const subtitle = value => blocks.push({type:'subheading', text:clean(value)});
    const table = (headers, rows, widths) => blocks.push({type:'table', headers, rows:rows.map(row => row.map(clean)), widths});
    const topic = id => TMAP[id] ? atlasText(TMAP[id].title) : 'Тема из прежней версии';
    const itemTitle = id => {
      const item = P.item(id);
      return item ? atlasText(P.itemTitle(item)) : 'Задание из прежней версии атласа';
    };
    blocks.push({type:'title', text:'Прогресс подготовки по микробиологии'});
    text('Отчёт на ' + date(Date.now()) + '. Сводка занятий, тем для повторения и ваших учебных записей.');
    text('Отчёт предназначен для чтения. Чтобы перенести прогресс в атлас на другом устройстве, сохраните резервную копию JSON в разделе «Данные».');
    heading('Общая сводка');
    table(['Показатель','Результат'], [
      ['Освоение курса',percent(course.pct)], ['Ответов всего',course.attempts],
      ['Заданий охвачено',course.D + ' из ' + course.total], ['К повторению сегодня',course.due],
      ['Просрочено',course.overdue], ['Активных ошибок',course.active],
      ['Повторяющихся ошибок',course.repeated], ['Своих фактов',Object.keys(S.facts).length]
    ], [0.6,0.4]);
    text('Освоение курса определяется по уровням тем, а не по числу открытых страниц. Частично верный ответ учитывается с половинным весом.');
    if (!course.attempts) text('Ответов пока нет. После занятий здесь появятся результаты и расписание повторения.');
    heading('Прогресс по темам');
    table(['Тема','Уровень','Ответов','Точность','Повторить'], course.ts.map(s => [
      topic(s.t),P.LEVELS[s.L].n,s.N,s.N ? percent(s.acc) : 'Нет ответов',s.due
    ]), [0.35,0.27,0.11,0.14,0.13]);
    heading('Что повторить');
    const due = course.ts.filter(s => s.due > 0).sort((a,b) => b.overdue-a.overdue || b.due-a.due);
    if (due.length) due.forEach(s => text(topic(s.t) + ': ' + s.due + ' заданий, просрочено ' + s.overdue + '.'));
    else text('На сегодня повторений по расписанию нет.');
    heading('Журнал ошибок');
    const errors = Object.values(S.errs).sort((a,b) => Number(P.errActive(b))-Number(P.errActive(a)) || b.last-a.last);
    if (!errors.length) text('Ошибок в журнале пока нет.');
    errors.forEach((e,i) => {
      subtitle((i+1) + '. ' + itemTitle(e.id));
      text((P.ERRS[e.st] || 'Нужно повторить') + '. Повторений ошибки: ' + (e.n || 0) + '. Последняя ошибка: ' + date(e.last) + '.');
      if (e.th && e.th.length) text('Темы: ' + e.th.map(topic).join('; ') + '.');
      if (e.type) text('Причина: ' + (P.ERRT[e.type] || 'Другое') + '.');
      if (e.ans) text('Ваш ответ: ' + e.ans);
      if (e.exp) text('Правильный ответ: ' + atlasText(e.exp));
      if (e.note) text('Заметка: ' + e.note);
    });
    heading('Выучить отдельно');
    const facts = Object.values(S.facts).sort((a,b) => a.created-b.created);
    if (!facts.length) text('Свои факты и заметки пока не добавлены.');
    facts.forEach((f,i) => {
      subtitle((i+1) + '. ' + (P.FACTK[f.kind] || 'Факт'));
      text(f.text); if (f.back) text('Ответ: ' + f.back); if (f.note) text('Заметка: ' + f.note);
      if (f.th) text('Тема: ' + topic(f.th));
    });
    const notes = Object.entries(S.notes).filter(([,value]) => value);
    const pairs = Object.values(S.pairs);
    if (notes.length || pairs.length){
      heading('Свои сравнения и заметки');
      pairs.forEach(p => {
        subtitle(clean(p.a) + ' / ' + clean(p.b));
        if (p.diff) text('Отличие: ' + p.diff);
        if (p.note) text('Заметка: ' + p.note);
        if (p.th) text('Тема: ' + topic(p.th));
      });
      notes.forEach(([id,value]) => {
        const cmp = P.reg().cmpMap[id];
        subtitle(cmp ? atlasText(cmp.title || cmp.name || 'Заметка к сравнению') : 'Заметка к сравнению'); text(value);
      });
    }
    heading('Экзамены и тесты');
    if (!S.runs.length) text('Завершённых экзаменов и тестов пока нет.');
    else table(['Дата','Режим','Результат','Оценка'], S.runs.slice().reverse().map(r => [
      date(r.t1 || r.t0),r.kind === 'exam' ? 'Экзамен' : 'Смешанный тест',
      (r.score || 0) + ' из ' + r.n,r.n ? percent(r.score/r.n) : 'Нет данных'
    ]), [0.28,0.27,0.25,0.2]);
    if (S.active) text('Есть незавершённый экзамен. Его итог появится после завершения и самопроверки.');
    if (S.activeTest) text('Есть незавершённый смешанный тест. Его итог появится после завершения.');
    const answers = S.log.filter(e => e.g >= 0).slice(-50).reverse();
    heading('Последние ответы');
    text('Включено ответов: ' + answers.length + ' из ' + S.log.filter(e => e.g >= 0).length + ' в сохранённой истории. Показаны самые свежие.');
    answers.forEach(e => {
      subtitle(date(e.t) + ' · ' + itemTitle(e.i));
      text(['Не вспомнил или ошибся','Вспомнил с трудом','Ответил правильно','Ответил легко'][e.g] || 'Ответ сохранён');
      if (e.a) text('Ваш ответ: ' + e.a);
    });
    return {blocks, filename:'atlas-mikrobiologii-progress-' + fileDate()};
  }

  function download(blob, filename){
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 60000);
  }

  // A DOCX is an OOXML package. Store ZIP entries without compression so no runtime library is needed.
  const crcTable = Uint32Array.from({length:256}, (_,n) => { let c=n; for(let k=0;k<8;k++) c=c&1 ? 0xedb88320^(c>>>1) : c>>>1; return c>>>0; });
  function zip(files){
    const encoder = new TextEncoder();
    const parts=[], central=[]; let offset=0;
    Object.entries(files).forEach(([name,text]) => {
      const data=encoder.encode(text), filename=encoder.encode(name); let crc=0xffffffff;
      data.forEach(b => { crc=crcTable[(crc^b)&255]^(crc>>>8); }); crc=(crc^0xffffffff)>>>0;
      const local=new Uint8Array(30), l=new DataView(local.buffer);
      l.setUint32(0,0x04034b50,true); l.setUint16(4,20,true); l.setUint16(6,0x0800,true);
      l.setUint32(14,crc,true); l.setUint32(18,data.length,true); l.setUint32(22,data.length,true); l.setUint16(26,filename.length,true);
      const dir=new Uint8Array(46), d=new DataView(dir.buffer);
      d.setUint32(0,0x02014b50,true); d.setUint16(4,20,true); d.setUint16(6,20,true); d.setUint16(8,0x0800,true);
      d.setUint32(16,crc,true); d.setUint32(20,data.length,true); d.setUint32(24,data.length,true); d.setUint16(28,filename.length,true); d.setUint32(42,offset,true);
      parts.push(local,filename,data); central.push(dir,filename); offset+=30+filename.length+data.length;
    });
    const centralSize=central.reduce((n,b)=>n+b.length,0), end=new Uint8Array(22), e=new DataView(end.buffer), count=Object.keys(files).length;
    e.setUint32(0,0x06054b50,true); e.setUint16(8,count,true); e.setUint16(10,count,true); e.setUint32(12,centralSize,true); e.setUint32(16,offset,true);
    return new Blob([...parts,...central,end],{type:MIME_DOCX});
  }
  const xml = value => clean(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function docx(report){
    const p=(text,style='Normal')=>'<w:p><w:pPr><w:pStyle w:val="'+style+'"/></w:pPr><w:r>'+String(text).split('\n').map((line,i)=>(i?'<w:br/>':'')+'<w:t xml:space="preserve">'+xml(line)+'</w:t>').join('')+'</w:r></w:p>';
    const rows = block => [block.headers,...block.rows].map((row,i)=>'<w:tr><w:trPr>'+(i===0?'<w:tblHeader/>':'')+'</w:trPr>'+row.map((value,j)=>'<w:tc><w:tcPr><w:tcW w:w="'+Math.round(block.widths[j]*9638)+'" w:type="dxa"/>'+(i===0?'<w:shd w:fill="EDE9F5"/>':'')+'</w:tcPr>'+p(value,i===0?'TableHeader':'TableText')+'</w:tc>').join('')+'</w:tr>').join('');
    const body=report.blocks.map(b=>b.type==='table'?'<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:bottom w:val="single" w:sz="4" w:color="DAD5E3"/><w:insideH w:val="single" w:sz="4" w:color="E8E4ED"/></w:tblBorders><w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+b.widths.map(w=>'<w:gridCol w:w="'+Math.round(w*9638)+'"/>').join('')+'</w:tblGrid>'+rows(b)+'</w:tbl>'+p(''):p(b.text,{title:'Title',heading:'Heading1',subheading:'Heading2'}[b.type]||'Normal')).join('');
    const style=(id,size,bold,color='222222',keep=false)=>'<w:style w:type="paragraph" w:styleId="'+id+'"><w:name w:val="'+id+'"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="'+(id==='Heading1'?240:0)+'" w:after="120"/>'+(keep?'<w:keepNext/>':'')+'</w:pPr><w:rPr><w:sz w:val="'+size+'"/><w:color w:val="'+color+'"/>'+(bold?'<w:b/>':'')+'</w:rPr></w:style>';
    const header='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    return zip({
      '[Content_Types].xml':header+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      '_rels/.rels':header+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/_rels/document.xml.rels':header+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'word/document.xml':header+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>',
      'word/styles.xml':header+'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'+style('Title',36,true,'000000',true)+style('Heading1',28,true,'000000',true)+style('Heading2',23,true,'000000',true)+style('TableText',19,false)+style('TableHeader',19,true)+'</w:styles>'
    });
  }

  let pdfResources;
  function loadPdf(){
    if (!pdfResources) pdfResources=Promise.all([
      window.jspdf ? Promise.resolve() : new Promise((resolve,reject)=>{
        const script=document.createElement('script'); script.src=new URL('jspdf.umd.min.js',assets()).href;
        script.onload=resolve; script.onerror=()=>{script.remove();reject(new Error('Не удалось загрузить PDF. Проверьте подключение и повторите.'));}; document.head.appendChild(script);
      }),
      fetch(new URL('DejaVuSans.ttf',assets())).then(r=>{if(!r.ok)throw new Error('Не удалось загрузить шрифт PDF.');return r.arrayBuffer();})
    ]).catch(error=>{pdfResources=null;throw error;});
    return pdfResources;
  }
  async function pdf(report){
    const [,font]=await loadPdf(), doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
    const bytes=new Uint8Array(font); let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    doc.addFileToVFS('DejaVuSans.ttf',btoa(binary)); doc.addFont('DejaVuSans.ttf','DejaVu','normal'); doc.setFont('DejaVu');
    doc.setProperties({title:'Прогресс подготовки по микробиологии',author:'Medical Atlas'});
    const left=18,width=174,bottom=276; let y=22;
    const ensure=height=>{if(y+height>bottom){doc.addPage();y=22;return true;}return false;};
    const lines=(value,w)=>doc.splitTextToSize(clean(value).replace(/[\u{10000}-\u{10ffff}]/gu,'□'),w);
    function paragraph(text,size=10,gap=3,color='#222222'){
      doc.setFontSize(size);doc.setTextColor(color);const height=size*0.48;
      lines(text,width).forEach(line=>{ensure(height);doc.text(line,left,y);y+=height;}); y+=gap;
    }
    function table(block){
      doc.setFontSize(9);doc.setTextColor('#222222');const cellWidths=block.widths.map(w=>w*width),lineHeight=4.6;
      function row(values,header=false){
        const cells=values.map((value,i)=>lines(value,cellWidths[i]-4));
        const count=Math.max(...cells.map(c=>c.length)); let line=0;
        while(line<count){
          if(y+lineHeight+4>bottom){doc.addPage();y=22;if(!header)row(block.headers,true);}
          const fit=Math.max(1,Math.min(count-line,Math.floor((bottom-y-4)/lineHeight))),height=fit*lineHeight+4;
          if(header){doc.setFillColor('#EDE9F5');doc.rect(left,y-3,width,height,'F');}
          let x=left;
          cells.forEach((cell,i)=>{cell.slice(line,line+fit).forEach((value,j)=>doc.text(value,x+2,y+1+j*lineHeight));x+=cellWidths[i];});
          y+=height;doc.setDrawColor('#DDD8E5');doc.line(left,y-3,left+width,y-3);line+=fit;
        }
      }
      row(block.headers,true);block.rows.forEach(r=>row(r));y+=4;
    }
    report.blocks.forEach(b=>{
      if(b.type==='table'){ensure(18);table(b);}
      else if(b.type==='title'){ensure(25);paragraph(b.text,20,6,'#000000');}
      else if(b.type==='heading'){doc.setFontSize(14);ensure(lines(b.text,width).length*7+20);y+=3;paragraph(b.text,14,4,'#503478');}
      else if(b.type==='subheading'){doc.setFontSize(11);ensure(lines(b.text,width).length*6+10);paragraph(b.text,11,2);}
      else paragraph(b.text);
    });
    const pages=doc.getNumberOfPages();
    for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFontSize(8);doc.setTextColor('#6B6277');doc.text('Medical Atlas · '+page+' / '+pages,left,287);}
    return doc.output('blob');
  }

  const api = window.MICRO_REPORTS = {
    report, docx, pdf,
    page(P,r){
      const html=P.page(r);
      if(!P.path || P.path().sub!=='data' || !P.course)return html;
      const panel='<h2 class="sec">Отчёт о прогрессе</h2><p class="par">Читаемый отчёт: сводка, уровни тем, ошибки, свои факты, заметки и результаты тестов. Выберите формат.</p><div class="acts"><button type="button" class="btn pri" data-report="pdf">Скачать PDF</button><button type="button" class="btn" data-report="docx">Скачать Word (.docx)</button></div><p class="par" id="pp-report-status" role="status" aria-live="polite"></p>';
      return html.replace('<h2 class="sec">Сохранить и перенести</h2>',panel+'<h2 class="sec">Резервная копия и перенос</h2>').replace('>Скачать файл прогресса</button>','>Скачать резервную копию (JSON)</button>');
    }
  };
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-report]');if(!button)return;
    event.preventDefault();const format=button.dataset.report;
    if(!['pdf','docx'].includes(format))return;
    const buttons=[...document.querySelectorAll('[data-report]')],status=document.getElementById('pp-report-status');
    buttons.forEach(b=>{b.disabled=true;});if(status)status.textContent='Готовим отчёт…';
    try{
      const data=report(PREP),blob=format==='pdf'?await pdf(data):docx(data);
      download(blob,data.filename+'.'+format);
      if(status)status.textContent='Отчёт '+(format==='pdf'?'PDF':'Word')+' скачивается. Если загрузка не появилась, разрешите скачивание файлов для этого сайта.';
    }catch(error){if(status)status.textContent=/^Не удалось/.test(error.message || '') ? error.message : 'Не удалось подготовить отчёт. Проверьте подключение и повторите попытку.';}
    finally{buttons.forEach(b=>{b.disabled=false;});}
  });
})();
