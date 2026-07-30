import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const CLI = 'C:\\Users\\weidi\\play-music\\dist\\index.js';

const album = {
  artist: '张惠妹',
  artistEn: 'A-mei',
  name: '我可以抱你吗？爱人',
  nameEn: 'Can I Hold You? Lover',
  tracks: [
    { cn: '我可以抱你吗', en: 'Can I Hold You' },
    { cn: '当我开始偷偷的想你', en: 'When I Secretly Miss You' },
    { cn: '爱什么稀罕', en: 'Love Is Precious' },
    { cn: '好想见你', en: 'I Want to See You' },
    { cn: '无悔', en: 'No Regrets' },
    { cn: 'Good Night,Good Bye', en: 'Good Night, Good Bye' },
    { cn: '别在伤口上洒盐', en: 'Dont Pour Salt on the Wound' },
    { cn: '三天三夜', en: 'Three Days and Three Nights' },
    { cn: '离爱出走', en: 'Leaving Love' },
    { cn: '给我感觉', en: 'Give Me a Feeling' },
    { cn: '不在乎他', en: 'Dont Care About Him' },
    { cn: '日出', en: 'Sunrise' },
  ]
};

const outDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', `${album.artist} - ${album.name}`);

function isFlac(fp) {
  try { return fs.readFileSync(fp).toString('ascii',0,4)==='fLaC'; } catch { return false; }
}

function writeTags(fp, title, artist, albumName, trackNum) {
  const buf = fs.readFileSync(fp);
  if (buf.toString('ascii',0,4)!=='fLaC') return false;
  let pos=4;
  while (pos < buf.length-4) {
    const byte0=buf[pos];
    const isLast=(byte0&0x80)!==0;
    const type=byte0&0x7F;
    const len=(buf[pos+1]<<16)|(buf[pos+2]<<8)|buf[pos+3];
    const bs=pos+4;
    if (type===4) {
      const bd=buf.slice(bs,bs+len);
      const vl=bd.readUInt32LE(0);
      let cp=4+vl;
      const cnt=bd.readUInt32LE(cp); cp+=4;
      const existing=[];
      for(let j=0;j<cnt;j++) {
        if(cp>=bd.length) break;
        const l=bd.readUInt32LE(cp); cp+=4;
        if(cp+l>bd.length) break;
        const c=bd.slice(cp,cp+l).toString('utf8'); cp+=l;
        const k=c.split('=')[0].toUpperCase();
        if(!['TITLE','ARTIST','ALBUM','TRACKNUMBER'].includes(k)) existing.push(c);
      }
      const newTags=[`TITLE=${title}`,`ARTIST=${artist}`,`ALBUM=${albumName}`,`TRACKNUMBER=${String(trackNum).padStart(2,'0')}`];
      const all=[...existing,...newTags,'ENCODER=play-music'];
      const vb=bd.slice(4,4+vl);
      let wp=0;
      const tl=all.reduce((a,c)=>a+4+Buffer.byteLength(c,'utf8'),0);
      const nbdl=4+4+vb.length+tl;
      const nb=Buffer.alloc(nbdl);
      nb.writeUInt32LE(vl,wp); wp+=4;
      vb.copy(nb,wp); wp+=vl;
      nb.writeUInt32LE(all.length,wp); wp+=4;
      for(const c of all) {
        const cb=Buffer.from(c,'utf8');
        nb.writeUInt32LE(cb.length,wp); wp+=4;
        cb.copy(nb,wp); wp+=cb.length;
      }
      const block=Buffer.alloc(4+nbdl);
      block[0]=4|(isLast?0x80:0);
      block[1]=(nbdl>>16)&0xFF; block[2]=(nbdl>>8)&0xFF; block[3]=nbdl&0xFF;
      nb.copy(block,4);
      fs.writeFileSync(fp,Buffer.concat([buf.slice(0,pos),block,buf.slice(bs+len)]));
      return true;
    }
    pos+=4+len;
    if(isLast) break;
  }
  return false;
}

function genPlaylist(dir, name, files) {
  const lines=['#EXTM3U',''];
  for(const f of files) {
    lines.push('#EXTINF:-1,'+f.replace(/\.(flac|mp3)$/i,''));
    lines.push(f);
  }
  const p=path.join(dir,`${name}.m3u8`);
  fs.writeFileSync(p,'\ufeff'+lines.join('\r\n'),'utf8');
  return p;
}

async function download(query, dir) {
  try {
    const {stdout}=await execFileAsync('node',[CLI,'download',query,'-b','flac','-o',dir],{timeout:300000});
    const m=stdout.match(/Saved to:\s*(.+)/);
    if(m) return {ok:true,path:m[1].trim()};
  } catch {}
  try {
    const {stdout}=await execFileAsync('node',[CLI,'download',query,'-o',dir],{timeout:300000});
    const m=stdout.match(/Saved to:\s*(.+)/);
    if(m) return {ok:true,path:m[1].trim()};
  } catch {}
  return {ok:false};
}

async function main() {
  fs.mkdirSync(outDir,{recursive:true});
  console.log(`=== ${album.name} (${album.tracks.length} tracks) ===\n`);

  for(let i=0;i<album.tracks.length;i++) {
    const t=album.tracks[i];
    const num=String(i+1).padStart(2,'0');
    const q=`${t.cn} ${album.artist}`;
    process.stdout.write(`[${num}] ${t.cn}... `);
    const r=await download(q,outDir);
    if(r.ok) {
      const base=path.basename(r.path);
      const ext=path.extname(base).toLowerCase();
      const newName=`${num} ${t.cn}${ext}`;
      const oldPath=path.join(outDir,base);
      const newPath=path.join(outDir,newName);
      if(base!==newName) { try{fs.renameSync(oldPath,newPath);}catch{} }
      const flac=isFlac(newPath);
      console.log(flac?'FLAC':'MP3',base);
    } else {
      console.log('✗');
    }
  }

  const files=fs.readdirSync(outDir).filter(f=>f.endsWith('.flac')||f.endsWith('.mp3')).sort();
  for(let i=0;i<files.length;i++) {
    const fp=path.join(outDir,files[i]);
    const title=files[i].replace(/^\d+\s+/,'').replace(/\.(flac|mp3)$/i,'');
    const trackNum=i+1;
    if(files[i].endsWith('.flac')) writeTags(fp,title,album.artist,album.name,trackNum);
    process.stdout.write('.');
  }

  const pl=genPlaylist(outDir,album.name,files);
  console.log(`\n${files.length}/${album.tracks.length} tracks -> ${album.name}.m3u8`);
  console.log(`Done: ${outDir}`);
}

main().catch(console.error);
