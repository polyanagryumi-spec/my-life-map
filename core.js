export function dateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function periodStart(frequency,date=new Date()){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());if(['weekly','week_n'].includes(frequency))d.setDate(d.getDate()-((d.getDay()+6)%7));if(frequency==='month_n')d.setDate(1);return dateKey(d);}
export function taskState(task,date=new Date()){const today=dateKey(date),start=periodStart(task.frequency,date),history=task.history||[];const count=history.filter(x=>task.frequency==='once'||(x>=start&&x<=today)).length;const target=['week_n','month_n'].includes(task.frequency)?task.target:1;return {count,target,done:count>=target,today:history.includes(today)};}
export function toggleTask(task,date=new Date()){const key=dateKey(date),state=taskState(task,date);if(state.today)task.history.splice(task.history.indexOf(key),1);else if(task.frequency==='once'&&state.done)task.history=[];else if(state.done){const start=periodStart(task.frequency,date);const index=task.history.findLastIndex(x=>x>=start&&x<=key);if(index>=0)task.history.splice(index,1);}else task.history.push(key);}
export function validateData(data){const frequencies=['once','daily','weekly','week_n','month_n','asneeded'];const ids=new Set();const id=x=>{if(typeof x!=='string'||!/^[a-zA-Z0-9_-]+$/.test(x)||ids.has(x))throw Error('Некорректные или повторяющиеся идентификаторы');ids.add(x);};const str=x=>{if(typeof x!=='string')throw Error('Некорректный текст');};const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&dateKey(new Date(x+'T12:00:00'))===x;if(data?.version!==1||!Array.isArray(data.areas)||data.areas.length!==6||!Array.isArray(data.transactions))throw Error('Неверный формат файла');data.areas.forEach((a,i)=>{if(a.id!==String(i))throw Error('Неверные сферы');str(a.name);str(a.notes);if(!Array.isArray(a.groups))throw Error('Нет подразделов');a.groups.forEach(g=>{id(g.id);str(g.name);str(g.notes);if(!Array.isArray(g.tasks))throw Error('Нет задач');g.tasks.forEach(t=>{id(t.id);str(t.text);if(t.optional!==undefined&&typeof t.optional!=='boolean'||t.scheduledDate!==undefined&&t.scheduledDate!==''&&!date(t.scheduledDate)||t.weekdays!==undefined&&(!Array.isArray(t.weekdays)||t.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(t.weekdays).size!==t.weekdays.length))throw Error('Некорректное расписание');if(!frequencies.includes(t.frequency)||!Number.isInteger(t.target)||t.target<1||t.target>31||!Array.isArray(t.history)||!t.history.every(date)||new Set(t.history).size!==t.history.length)throw Error('Некорректная задача');});});});if(!data.categories||!['income','expense'].every(type=>Array.isArray(data.categories[type])&&data.categories[type].length&&data.categories[type].every(x=>typeof x==='string'&&x.trim())&&new Set(data.categories[type]).size===data.categories[type].length))throw Error('Неверные категории');data.transactions.forEach(t=>{id(t.id);if(!Number.isFinite(t.amount)||t.amount<=0||!['income','expense'].includes(t.type)||!date(t.date)||!data.categories[t.type].includes(t.category))throw Error('Некорректная операция');str(t.comment);});return data;}

// Progress is derived locally; no counters or summaries are stored separately.
export function progressTasks(area){
  const groups=new Map();
  for(const group of area.groups)for(const task of group.tasks){
    if(task.reference||task.optional||task.frequency==='asneeded')continue;
    // Repeated morning/evening steps are different actions, even with equal names.
    const groupName=group.name.toLocaleLowerCase('ru-RU');
    const context=/утр/u.test(groupName)?'morning':/вечер/u.test(groupName)?'evening':/ноч/u.test(groupName)?'night':/днев|(?:^|\s)день(?:$|\s)/u.test(groupName)?'day':'';
    const name=task.text.normalize('NFKC').toLocaleLowerCase('ru-RU').trim().replace(/[.!]+$/u,'').replace(/\s+/gu,' ');
    const key=JSON.stringify([name,context,task.frequency,['week_n','month_n'].includes(task.frequency)?task.target:1,task.scheduledDate||'',task.weekdays?.length?[...task.weekdays].sort():[]]);
    if(!groups.has(key))groups.set(key,{...task,history:[],members:[]});
    const item=groups.get(key);item.members.push(task);item.history=[...new Set([...item.history,...task.history])].sort();
  }
  return [...groups.values()];
}
export function plannedToday(task,date=new Date()){
  if(task.reference||task.optional||task.frequency==='asneeded')return false;
  if(task.frequency==='once')return task.scheduledDate===dateKey(date);
  const scheduled=task.weekdays?.length?task.weekdays.includes(date.getDay()):task.frequency==='daily';
  if(!scheduled)return false;
  const state=taskState(task,date);
  return task.frequency==='daily'||!state.done||state.today;
}
function summary(tasks,kind,date){
  let total=0,done=0;
  for(const task of tasks){const state=taskState(task,date);
    if(kind==='week'){total+=state.target;done+=Math.min(state.count,state.target);}
    else{total++;done+=kind==='today'&&task.frequency!=='once'?Number(state.today):Number(state.done);}
  }
  return {kind,total,done,percent:total?Math.round(done/total*100):null};
}
export function areaProgress(area,date=new Date()){
  const tasks=progressTasks(area),today=tasks.filter(t=>plannedToday(t,date));
  if(area.id==='1')return [summary(today,'today',date),summary(tasks.filter(t=>['weekly','week_n'].includes(t.frequency)),'week',date)];
  if(today.length)return [summary(today,'today',date)];
  const once=tasks.filter(t=>t.frequency==='once');
  return [summary(once,once.length?'once':'today',date)];
}
export function toggleProgressTask(area,task,date=new Date()){
  const shared=progressTasks(area).find(item=>item.members.includes(task));
  if(!shared){toggleTask(task,date);return;}
  toggleTask(shared,date);
  // Identical copies in different sections share the same dated check marks.
  for(const member of shared.members)member.history=[...shared.history];
}
