// Bound streamed JSON, including requests without a trustworthy Content-Length.
export const MAX_JSON_BYTES=3_000_000;
export async function readJsonBody(request,maxBytes=MAX_JSON_BYTES,onSize=()=>{}){
 const tooLarge=()=>Object.assign(new Error('Solicitação muito grande. Reduza os arquivos e tente novamente.'),{status:413});
 const declared=Number(request.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>maxBytes)throw tooLarge();
 if(!request.body)throw new SyntaxError('Empty JSON');
 const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw tooLarge()}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();onSize(size);return JSON.parse(text)}finally{reader.releaseLock()}
}
