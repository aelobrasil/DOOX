export async function readAll(db,path){
 const clean=path.replace(/&(?:limit|offset)=\d+/g,''),rows=[];
 for(let offset=0;offset<50000;offset+=500){const page=await db(clean+'&limit=500&offset='+offset);if(!Array.isArray(page))throw Error('Resposta incompleta ao consultar registros.');rows.push(...page);if(page.length<500)return rows;}
 throw Error('A consulta excedeu o limite de carregamento. Refine o período para continuar.');
}
