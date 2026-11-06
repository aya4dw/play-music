import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

const execFileAsync = promisify(execFile);
const CLI = new URL('./dist/index.js', import.meta.url).pathname;
const MUSIC = path.join(homedir(), 'Music');

const albums = [
  { artist: 'Michael Jackson', name: 'Thriller', date: '1982', tracks: [
    { cn: 'Wanna Be Startin\' Somethin\'' }, { cn: 'Baby Be Mine' }, { cn: 'The Girl Is Mine' },
    { cn: 'Thriller' }, { cn: 'Beat It' }, { cn: 'Billie Jean' }, { cn: 'Human Nature' },
    { cn: 'P.Y.T. (Pretty Young Thing)' }, { cn: 'The Lady in My Life' } ] },
  { artist: 'Elton John', name: 'Goodbye Yellow Brick Road', date: '1973', tracks: [
    { cn: 'Funeral for a Friend/Love Lies Bleeding' }, { cn: 'Candle in the Wind' },
    { cn: 'Bennie and the Jets' }, { cn: 'Goodbye Yellow Brick Road' }, { cn: 'This Song Has No Title' },
    { cn: 'Grey Seal' }, { cn: 'Jamaica Jerk-Off' }, { cn: 'I\'ve Seen That Movie Too' },
    { cn: 'Sweet Painted Lady' }, { cn: 'The Ballad of Danny Bailey (1909-34)' },
    { cn: 'Dirty Little Girl' }, { cn: 'All the Girls Love Alice' },
    { cn: 'Your Sister Can\'t Twist (but She Can Rock \'n Roll)' },
    { cn: 'Saturday Night\'s Alright for Fighting' }, { cn: 'Roy Rogers' },
    { cn: 'Social Disease' }, { cn: 'Harmony' } ] },
  { artist: 'Prince', name: 'Purple Rain', date: '1984', tracks: [
    { cn: 'Let\'s Go Crazy' }, { cn: 'Take Me with U' }, { cn: 'The Beautiful Ones' },
    { cn: 'Computer Blue' }, { cn: 'Darling Nikki' }, { cn: 'When Doves Cry' },
    { cn: 'I Would Die 4 U' }, { cn: 'Baby I\'m a Star' }, { cn: 'Purple Rain' } ] },
  { artist: 'George Michael', name: 'Faith', date: '1987', tracks: [
    { cn: 'Faith' }, { cn: 'Father Figure' }, { cn: 'I Want Your Sex (Parts 1 & 2)' },
    { cn: 'One More Try' }, { cn: 'Hard Day' }, { cn: 'Hand to Mouth' },
    { cn: 'Look at Your Hands' }, { cn: 'Monkey' }, { cn: 'Kissing a Fool' } ] },
  { artist: 'Whitney Houston', name: 'Whitney Houston', date: '1985', tracks: [
    { cn: 'You Give Good Love' }, { cn: 'Thinking About You' }, { cn: 'Someone for Me' },
    { cn: 'Saving All My Love for You' }, { cn: 'Nobody Loves Me Like You Do' },
    { cn: 'How Will I Know' }, { cn: 'All at Once' }, { cn: 'Take Good Care of My Heart' },
    { cn: 'Greatest Love of All' }, { cn: 'Hold Me' } ] },
  { artist: 'Madonna', name: 'Like a Virgin', date: '1984', tracks: [
    { cn: 'Material Girl' }, { cn: 'Angel' }, { cn: 'Like a Virgin' }, { cn: 'Over and Over' },
    { cn: 'Love Don\'t Live Here Anymore' }, { cn: 'Dress You Up' }, { cn: 'Shoo-Bee-Doo' },
    { cn: 'Pretender' }, { cn: 'Stay' } ] },
  { artist: 'Adele', name: '21', date: '2011', tracks: [
    { cn: 'Rolling in the Deep' }, { cn: 'Rumour Has It' }, { cn: 'Turning Tables' },
    { cn: 'Don\'t You Remember' }, { cn: 'Set Fire to the Rain' }, { cn: 'He Won\'t Go' },
    { cn: 'Take It All' }, { cn: 'I\'ll Be Waiting' }, { cn: 'One and Only' },
    { cn: 'Lovesong' }, { cn: 'Someone Like You' } ] },
  { artist: 'Joni Mitchell', name: 'Blue', date: '1971', tracks: [
    { cn: 'All I Want' }, { cn: 'My Old Man' }, { cn: 'Little Green' }, { cn: 'Carey' },
    { cn: 'Blue' }, { cn: 'California' }, { cn: 'This Flight Tonight' }, { cn: 'River' },
    { cn: 'A Case of You' }, { cn: 'The Last Time I Saw Richard' } ] },
  { artist: 'Fleetwood Mac', name: 'Rumours', date: '1977', tracks: [
    { cn: 'Second Hand News' }, { cn: 'Dreams' }, { cn: 'Never Going Back Again' },
    { cn: 'Don\'t Stop' }, { cn: 'Go Your Own Way' }, { cn: 'Songbird' }, { cn: 'The Chain' },
    { cn: 'You Make Loving Fun' }, { cn: 'I Don\'t Want to Know' }, { cn: 'Oh Daddy' },
    { cn: 'Gold Dust Woman' } ] },
  { artist: 'The Beatles', name: 'Abbey Road', date: '1969', tracks: [
    { cn: 'Come Together' }, { cn: 'Something' }, { cn: 'Maxwell\'s Silver Hammer' },
    { cn: 'Oh! Darling' }, { cn: 'Octopus\'s Garden' }, { cn: 'I Want You (She\'s So Heavy)' },
    { cn: 'Here Comes the Sun' }, { cn: 'Because' }, { cn: 'You Never Give Me Your Money' },
    { cn: 'Sun King' }, { cn: 'Mean Mr. Mustard' }, { cn: 'Polythene Pam' },
    { cn: 'She Came In Through the Bathroom Window' }, { cn: 'Golden Slumbers' },
    { cn: 'Carry That Weight' }, { cn: 'The End' }, { cn: 'Her Majesty' } ] },
  { artist: 'Pink Floyd', name: 'The Dark Side of the Moon', date: '1973', tracks: [
    { cn: 'Speak to Me' }, { cn: 'Breathe (In the Air)' }, { cn: 'On the Run' },
    { cn: 'Time' }, { cn: 'The Great Gig in the Sky' }, { cn: 'Money' }, { cn: 'Us and Them' },
    { cn: 'Any Colour You Like' }, { cn: 'Brain Damage' }, { cn: 'Eclipse' } ] },
  { artist: 'Queen', name: 'The Game', date: '1980', tracks: [
    { cn: 'Play the Game' }, { cn: 'Dragon Attack' }, { cn: 'Another One Bites the Dust' },
    { cn: 'Need Your Loving Tonight' }, { cn: 'Crazy Little Thing Called Love' },
    { cn: 'Rock It (Prime Jive)' }, { cn: 'Don\'t Try Suicide' },
    { cn: 'Sail Away Sweet Sister (To the Sister I Never Had)' }, { cn: 'Coming Soon' },
    { cn: 'Save Me' } ] },
  { artist: 'Dire Straits', name: 'Brothers in Arms', date: '1985', tracks: [
    { cn: 'So Far Away' }, { cn: 'Money for Nothing' }, { cn: 'Walk of Life' },
    { cn: 'Your Latest Trick' }, { cn: 'Why Worry' }, { cn: 'Ride Across the River' },
    { cn: 'The Man\'s Too Strong' }, { cn: 'One World' }, { cn: 'Brothers in Arms' } ] },
  { artist: 'Nirvana', name: 'Nevermind', date: '1991', tracks: [
    { cn: 'Smells Like Teen Spirit' }, { cn: 'In Bloom' }, { cn: 'Come as You Are' },
    { cn: 'Breed' }, { cn: 'Lithium' }, { cn: 'Polly' }, { cn: 'Territorial Pissings' },
    { cn: 'Drain You' }, { cn: 'Lounge Act' }, { cn: 'Stay Away' }, { cn: 'On a Plain' },
    { cn: 'Something in the Way' } ] },
  { artist: 'The Rolling Stones', name: 'Exile on Main St.', date: '1972', tracks: [
    { cn: 'Rocks Off' }, { cn: 'Rip This Joint' }, { cn: 'Shake Your Hips' },
    { cn: 'Casino Boogie' }, { cn: 'Tumbling Dice' }, { cn: 'Sweet Virginia' },
    { cn: 'Torn and Frayed' }, { cn: 'Sweet Black Angel' }, { cn: 'Loving Cup' },
    { cn: 'Happy' }, { cn: 'Turd on the Run' }, { cn: 'Ventilator Blues' },
    { cn: 'I Just Want to See His Face' }, { cn: 'Let It Loose' }, { cn: 'All Down the Line' },
    { cn: 'Stop Breaking Down' }, { cn: 'Shine a Light' }, { cn: 'Soul Survivor' } ] },
  { artist: 'AC/DC', name: 'Back in Black', date: '1980', tracks: [
    { cn: 'Hells Bells' }, { cn: 'Shoot to Thrill' }, { cn: 'What Do You Do for Money Honey' },
    { cn: 'Givin the Dog a Bone' }, { cn: 'Let Me Put My Love Into You' },
    { cn: 'Back in Black' }, { cn: 'You Shook Me All Night Long' }, { cn: 'Have a Drink on Me' },
    { cn: 'Shake a Leg' }, { cn: 'Rock and Roll Ain\'t Noise Pollution' } ] },
  { artist: 'Radiohead', name: 'OK Computer', date: '1997', tracks: [
    { cn: 'Airbag' }, { cn: 'Paranoid Android' }, { cn: 'Subterranean Homesick Alien' },
    { cn: 'Exit Music (For a Film)' }, { cn: 'Let Down' }, { cn: 'Karma Police' },
    { cn: 'Fitter Happier' }, { cn: 'Electioneering' }, { cn: 'Climbing Up the Walls' },
    { cn: 'No Surprises' }, { cn: 'Lucky' }, { cn: 'The Tourist' } ] },
  { artist: 'Marvin Gaye', name: 'What\'s Going On', date: '1971', tracks: [
    { cn: 'What\'s Going On' }, { cn: 'What\'s Happening Brother' },
    { cn: 'Flyin\' High (In the Friendly Sky)' }, { cn: 'Save the Children' },
    { cn: 'God Is Love' }, { cn: 'Mercy Mercy Me (The Ecology)' }, { cn: 'Right On' },
    { cn: 'Wholy Holy' }, { cn: 'Inner City Blues (Make Me Wanna Holler)' } ] },
  { artist: 'Aretha Franklin', name: 'I Never Loved a Man the Way I Love You', date: '1967', tracks: [
    { cn: 'Respect' }, { cn: 'Drown in My Own Tears' },
    { cn: 'I Never Loved a Man (The Way I Love You)' }, { cn: 'Soul Serenade' },
    { cn: 'Don\'t Let Me Lose This Dream' }, { cn: 'Baby, Baby, Baby' },
    { cn: 'Dr. Feelgood (Love Is a Serious Business)' }, { cn: 'Good Times' },
    { cn: 'Do Right Woman, Do Right Man' }, { cn: 'Save Me' },
    { cn: 'A Change Is Gonna Come' } ] },
  { artist: 'Bob Dylan', name: 'Highway 61 Revisited', date: '1965', tracks: [
    { cn: 'Like a Rolling Stone' }, { cn: 'Tombstone Blues' },
    { cn: 'It Takes a Lot to Laugh, It Takes a Train to Cry' }, { cn: 'From a Buick 6' },
    { cn: 'Ballad of a Thin Man' }, { cn: 'Queen Jane Approximately' },
    { cn: 'Highway 61 Revisited' }, { cn: 'Just Like Tom Thumb\'s Blues' },
    { cn: 'Desolation Row' } ] },
  { artist: 'Bob Dylan', name: 'Blood on the Tracks', date: '1975', tracks: [
    { cn: 'Tangled Up in Blue' }, { cn: 'Simple Twist of Fate' },
    { cn: 'You\'re a Big Girl Now' }, { cn: 'Idiot Wind' },
    { cn: 'You\'re Gonna Make Me Lonesome When You Go' }, { cn: 'Meet Me in the Morning' },
    { cn: 'Lily, Rosemary and the Jack of Hearts' }, { cn: 'If You See Her, Say Hello' },
    { cn: 'Shelter from the Storm' }, { cn: 'Buckets of Rain' } ] },
  { artist: 'Leonard Cohen', name: 'Songs of Leonard Cohen', date: '1967', tracks: [
    { cn: 'Suzanne' }, { cn: 'Master Song' }, { cn: 'Winter Lady' },
    { cn: 'The Stranger Song' }, { cn: 'Sisters of Mercy' }, { cn: 'So Long, Marianne' },
    { cn: 'Hey, That\'s No Way to Say Goodbye' }, { cn: 'Stories of the Street' },
    { cn: 'Teachers' }, { cn: 'One of Us Cannot Be Wrong' } ] },
  { artist: 'The Weeknd', name: 'After Hours', date: '2020', tracks: [
    { cn: 'Alone Again' }, { cn: 'Too Late' }, { cn: 'Hardest to Love' },
    { cn: 'Scared to Live' }, { cn: 'Snowchild' }, { cn: 'Escape from LA' },
    { cn: 'Heartless' }, { cn: 'Faith' }, { cn: 'Blinding Lights' },
    { cn: 'In Your Eyes' }, { cn: 'Save Your Tears' },
    { cn: 'Repeat After Me (Interlude)' }, { cn: 'After Hours' }, { cn: 'Until I Bleed Out' } ] },
  { artist: 'Lady Gaga', name: 'The Fame', date: '2008', tracks: [
    { cn: 'Just Dance', q: 'Just Dance Lady Gaga' }, { cn: 'LoveGame' },
    { cn: 'Paparazzi' }, { cn: 'Poker Face' }, { cn: 'Eh, Eh (Nothing Else I Can Say)' },
    { cn: 'Beautiful, Dirty, Rich' }, { cn: 'The Fame' }, { cn: 'Money Honey' },
    { cn: 'Starstruck' }, { cn: 'Boys Boys Boys' }, { cn: 'Paper Gangsta' },
    { cn: 'Brown Eyes' }, { cn: 'I Like It Rough' }, { cn: 'Summerboy' } ] },
  { artist: 'Lady Gaga', name: 'The Fame Monster', date: '2009', tracks: [
    { cn: 'Bad Romance' }, { cn: 'Alejandro' }, { cn: 'Monster' }, { cn: 'Speechless' },
    { cn: 'Dance In The Dark' }, { cn: 'Telephone', q: 'Telephone Lady Gaga' },
    { cn: 'So Happy I Could Die' }, { cn: 'Teeth' } ] },
  { artist: 'Taylor Swift', name: 'folklore', date: '2020', tracks: [
    { cn: 'the 1' }, { cn: 'cardigan' }, { cn: 'the last great american dynasty' },
    { cn: 'exile', q: 'exile Taylor Swift' }, { cn: 'my tears ricochet' },
    { cn: 'mirrorball' }, { cn: 'seven' }, { cn: 'august' }, { cn: 'this is me trying' },
    { cn: 'illicit affairs' }, { cn: 'invisible string' }, { cn: 'mad woman' },
    { cn: 'epiphany' }, { cn: 'betty' }, { cn: 'peace' }, { cn: 'hoax' },
    { cn: 'the lakes' } ] },
];

async function sh(cmd, args, opts = {}) {
  const { stdout } = await execFileAsync(cmd, args, opts);
  return stdout;
}

function sanitize(name) {
  return name.replace(/[/:]/g, '-').replace(/[*?"<>|]/g, '');
}

async function downloadCover(outDir, artist, name) {
  const coverPath = path.join(outDir, 'cover.jpg');
  if (fs.existsSync(coverPath)) return coverPath;
  try {
    const q = encodeURIComponent(`${artist} ${name}`);
    const out = await sh('curl', ['-s', `https://itunes.apple.com/search?term=${q}&media=music&entity=album&limit=1`]);
    const url = JSON.parse(out).results?.[0]?.artworkUrl100;
    if (!url) return null;
    await sh('curl', ['-sL', '-o', coverPath, url.replace(/100x100bb/, '1000x1000bb')]);
    return coverPath;
  } catch {
    return null;
  }
}

async function download(query, dir) {
  for (const args of [['download', query, '-b', 'flac', '-o', dir], ['download', query, '-o', dir]]) {
    try {
      const { stdout } = await execFileAsync('node', [CLI, ...args], { timeout: 300000 });
      const m = stdout.match(/Saved to:\s*(.+)/);
      if (m) return m[1].trim();
    } catch {}
  }
  return null;
}

async function validateAndRepair(fp) {
  try {
    await sh('flac', ['-t', '-s', fp]);
    return;
  } catch {
    console.log('\n  损坏，重编码修复');
    const tmp = path.join(path.dirname(fp), '.repair-' + path.basename(fp));
    await sh('ffmpeg', ['-y', '-v', 'error', '-i', fp, '-acodec', 'flac', '-compression_level', '8', tmp]);
    fs.renameSync(tmp, fp);
  }
}

async function tagAndCover(fp, title, trackNum, album, artist, date, cover) {
  const tmp = path.join(path.dirname(fp), '.tag-' + path.basename(fp));
  const args = ['-y', '-v', 'error', '-i', fp];
  if (cover) args.push('-i', cover);
  args.push('-map', '0:a');
  if (cover) args.push('-map', '1:v', '-c:v', 'copy', '-disposition:v', 'attached_pic');
  args.push('-c:a', 'copy',
    '-metadata', `title=${title}`,
    '-metadata', `artist=${artist}`,
    '-metadata', `album=${album}`,
    '-metadata', `album_artist=${artist}`,
    '-metadata', `track=${String(trackNum).padStart(2, '0')}`,
    '-metadata', `date=${date}`);
  if (cover) args.push('-metadata:s:v', 'comment=Cover (front)', '-metadata:s:v', 'title=Album cover');
  args.push(tmp);
  await sh('ffmpeg', args);
  fs.renameSync(tmp, fp);
}

function genPlaylist(outDir, albumName, files) {
  const lines = ['#EXTM3U'];
  for (const f of files) {
    lines.push(`#EXTINF:-1,${f.replace(/\.(flac|mp3)$/i, '')}`);
    lines.push(f);
  }
  const p = path.join(outDir, `${albumName}.m3u8`);
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
  return p;
}

async function processAlbum(album) {
  const outDir = path.join(MUSIC, `${sanitize(album.artist)} - ${sanitize(album.name)}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== ${album.artist} - ${album.name} (${album.tracks.length} tracks) ===`);

  for (let i = 0; i < album.tracks.length; i++) {
    const t = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const title = t.cn;
    const q = t.q || `${t.cn} ${album.artist}`;
    const target = path.join(outDir, `${num} ${sanitize(t.cn)}.flac`);
    if (fs.existsSync(target)) { console.log(`  [${num}] ${t.cn} ... 已存在`); continue; }
    process.stdout.write(`  [${num}] ${t.cn}... `);
    const saved = await download(q, outDir);
    if (!saved) { console.log('✗'); continue; }
    const base = path.basename(saved);
    const ext = path.extname(base).toLowerCase();
    const newName = `${num} ${sanitize(t.cn)}${ext}`;
    if (base !== newName) { try { fs.renameSync(path.join(outDir, base), path.join(outDir, newName)); } catch {} }
    console.log(ext.slice(1).toUpperCase());
  }

  const cover = await downloadCover(outDir, album.artist, album.name);
  const files = fs.readdirSync(outDir).filter(f => /\.(flac|mp3)$/i.test(f)).sort();
  for (const f of files) {
    if (!/\.flac$/i.test(f)) continue;
    const fp = path.join(outDir, f);
    process.stdout.write(`  处理 ${f}... `);
    await validateAndRepair(fp);
    const title = f.replace(/^\d+\s+/, '').replace(/\.flac$/i, '');
    await tagAndCover(fp, title, parseInt(f, 10), album.name, album.artist, album.date, cover);
    console.log('✓');
  }

  const pl = genPlaylist(outDir, album.name, files);
  console.log(`  ${files.length} tracks -> ${pl}`);
}

async function main() {
  for (const album of albums) {
    await processAlbum(album);
  }
  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
