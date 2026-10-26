import crypto from"node:crypto";
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const createSecret=()=>Array.from(crypto.randomBytes(20)).map(b=>alphabet[b%alphabet.length]).join("");
const decode=(secret:string)=>{let bits="";for(const c of secret.replace(/=+$/,"")){const n=alphabet.indexOf(c.toUpperCase());if(n>=0)bits+=n.toString(2).padStart(5,"0");}return Buffer.from((bits.match(/.{1,8}/g)??[]).filter(x=>x.length===8).map(x=>parseInt(x,2)));};
const token=(secret:string,step:number)=>{const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(step));const d=crypto.createHmac("sha1",decode(secret)).update(b).digest();const o=d[d.length-1]!&15;return ((d.readUInt32BE(o)&0x7fffffff)%1000000).toString().padStart(6,"0");};
export const verifyTotp=(secret:string,code:string)=>{const now=Math.floor(Date.now()/30000);return[-1,0,1].some(o=>crypto.timingSafeEqual(Buffer.from(token(secret,now+o)),Buffer.from(code.padStart(6,"0"))));};
