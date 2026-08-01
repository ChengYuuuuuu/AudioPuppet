export const VOCAB: Record<string, number> = {
  SP: 0, '<EOS>': 1, E: 2, En: 3, a: 4, ai: 5, an: 6, ang: 7, ao: 8,
  b: 9, c: 10, ch: 11, d: 12, e: 13, ei: 14, en: 15, eng: 16, er: 17,
  f: 18, g: 19, h: 20, i: 21, i0: 22, ia: 23, ian: 24, iang: 25, iao: 26,
  ie: 27, in: 28, ing: 29, iong: 30, ir: 31, iu: 32, j: 33, k: 34, l: 35,
  m: 36, n: 37, o: 38, ong: 39, ou: 40, p: 41, q: 42, r: 43, s: 44,
  sh: 45, t: 46, u: 47, ua: 48, uai: 49, uan: 50, uang: 51, ui: 52,
  un: 53, uo: 54, v: 55, van: 56, vanr: 57, ve: 58, vn: 59, w: 60,
  x: 61, y: 62, z: 63, zh: 64,
};
export const VOCAB_SIZE = 65;

const OPENCPOP_DICT: Record<string, string[]> = {};
const OPENCPOP_RAW =
  `a	a
ai	ai
an	an
ang	ang
ao	ao
ba	b a
bai	b ai
ban	b an
bang	b ang
bao	b ao
be	b e
bei	b ei
ben	b en
beng	b eng
ber	b er
bi	b i
bia	b ia
bian	b ian
biang	b iang
biao	b iao
bie	b ie
bin	b in
bing	b ing
bo	b o
bu	b u
ca	c a
cai	c ai
can	c an
cang	c ang
cao	c ao
ce	c e
cen	c en
ceng	c eng
cha	ch a
chai	ch ai
chan	ch an
chang	ch ang
chao	ch ao
che	ch e
chen	ch en
cheng	ch eng
chi	ch ir
chong	ch ong
chou	ch ou
chu	ch u
chua	ch ua
chuai	ch uai
chuan	ch uan
chuang	ch uang
chui	ch ui
chun	ch un
chuo	ch uo
ci	c i0
cong	c ong
cou	c ou
cu	c u
cuan	c uan
cui	c ui
cun	c un
cuo	c uo
da	d a
dai	d ai
dan	d an
dang	d ang
dao	d ao
de	d e
dei	d ei
den	d en
deng	d eng
di	d i
dia	d ia
dian	d ian
diao	d iao
die	d ie
ding	d ing
diu	d iu
dong	d ong
dou	d ou
du	d u
duan	d uan
dui	d ui
dun	d un
duo	d uo
e	e
ei	ei
en	en
eng	eng
er	er
fa	f a
fan	f an
fang	f ang
fei	f ei
fen	f en
feng	f eng
fo	f o
fou	f ou
fu	f u
ga	g a
gai	g ai
gan	g an
gang	g ang
gao	g ao
ge	g e
gei	g ei
gen	g en
geng	g eng
gong	g ong
gou	g ou
gu	g u
gua	g ua
guai	g uai
guan	g uan
guang	g uang
gui	g ui
gun	g un
guo	g uo
ha	h a
hai	h ai
han	h an
hang	h ang
hao	h ao
he	h e
hei	h ei
hen	h en
heng	h eng
hong	h ong
hou	h ou
hu	h u
hua	h ua
huai	h uai
huan	h uan
huang	h uang
hui	h ui
hun	h un
huo	h uo
ji	j i
jia	j ia
jian	j ian
jiang	j iang
jiao	j iao
jie	j ie
jin	j in
jing	j ing
jiong	j iong
jiu	j iu
ju	j v
juan	j van
jue	j ve
jun	j vn
ka	k a
kai	k ai
kan	k an
kang	k ang
kao	k ao
ke	k e
ken	k en
keng	k eng
kong	k ong
kou	k ou
ku	k u
kua	k ua
kuai	k uai
kuan	k uan
kuang	k uang
kui	k ui
kun	k un
kuo	k uo
la	l a
lai	l ai
lan	l an
lang	l ang
lao	l ao
le	l e
lei	l ei
leng	l eng
li	l i
lia	l ia
lian	l ian
liang	l iang
liao	l iao
lie	l ie
lin	l in
ling	l ing
liu	l iu
long	l ong
lou	l ou
lu	l u
luan	l uan
lun	l un
luo	l uo
lv	l v
lvan	l van
lve	l ve
ma	m a
mai	m ai
man	m an
mang	m ang
mao	m ao
me	m e
mei	m ei
men	m en
meng	m eng
mi	m i
mian	m ian
miao	m iao
mie	m ie
min	m in
ming	m ing
miu	m iu
mo	m o
mou	m ou
mu	m u
na	n a
nai	n ai
nan	n an
nang	n ang
nao	n ao
ne	n e
nei	n ei
nen	n en
neng	n eng
ni	n i
nian	n ian
niang	n iang
niao	n iao
nie	n ie
nin	n in
ning	n ing
niu	n iu
nong	n ong
nou	n ou
nu	n u
nuan	n uan
nun	n un
nuo	n uo
nv	n v
nve	n ve
o	o
ou	ou
pa	p a
pai	p ai
pan	p an
pang	p ang
pao	p ao
pe	p e
pei	p ei
pen	p en
peng	p eng
pi	p i
pian	p ian
piao	p iao
pie	p ie
pin	p in
ping	p ing
po	p o
pou	p ou
pu	p u
qi	q i
qia	q ia
qian	q ian
qiang	q iang
qiao	q iao
qie	q ie
qin	q in
qing	q ing
qiong	q iong
qiu	q iu
qu	q v
quan	q van
que	q ve
qun	q vn
ran	r an
rang	r ang
rao	r ao
re	r e
ren	r en
reng	r eng
ri	r ir
rong	r ong
rou	r ou
ru	r u
ruan	r uan
rui	r ui
run	r un
ruo	r uo
sa	s a
sai	s ai
san	s an
sang	s ang
sao	s ao
se	s e
sen	s en
seng	s eng
sha	sh a
shai	sh ai
shan	sh an
shang	sh ang
shao	sh ao
she	sh e
shei	sh ei
shen	sh en
sheng	sh eng
shi	sh ir
shou	sh ou
shu	sh u
shua	sh ua
shuai	sh uai
shuan	sh uan
shuang	sh uang
shui	sh ui
shun	sh un
shuo	sh uo
si	s i0
song	s ong
sou	s ou
su	s u
suan	s uan
sui	s ui
sun	s un
suo	s uo
ta	t a
tai	t ai
tan	t an
tang	t ang
tao	t ao
te	t e
teng	t eng
ti	t i
tian	t ian
tiao	t iao
tie	t ie
ting	t ing
tong	t ong
tou	t ou
tu	t u
tuan	t uan
tui	t ui
tun	t un
tuo	t uo
wa	w a
wai	w ai
wan	w an
wang	w ang
wei	w ei
wen	w en
weng	w eng
wo	w o
wu	w u
xi	x i
xia	x ia
xian	x ian
xiang	x iang
xiao	x iao
xie	x ie
xin	x in
xing	x ing
xiong	x iong
xiu	x iu
xu	x v
xuan	x van
xue	x ve
xun	x vn
ya	y a
yan	y an
yang	y ang
yao	y ao
ye	y e
yi	y i
yin	y in
ying	y ing
yo	y o
yong	y ong
you	y ou
yu	y v
yuan	y van
yue	y ve
yun	y vn
za	z a
zai	z ai
zan	z an
zang	z ang
zao	z ao
ze	z e
zei	z ei
zen	z en
zeng	z eng
zha	zh a
zhai	zh ai
zhan	zh an
zhang	zh ang
zhao	zh ao
zhe	zh e
zhei	zh ei
zhen	zh en
zheng	zh eng
zhi	zh ir
zhong	zh ong
zhou	zh ou
zhu	zh u
zhua	zh ua
zhuai	zh uai
zhuan	zh uan
zhuang	zh uang
zhui	zh ui
zhun	zh un
zhuo	zh uo
zi	z i0
zong	z ong
zou	z ou
zu	z u
zuan	z uan
zui	z ui
zun	z un
zuo	z uo`.split('\n');

for (const line of OPENCPOP_RAW) {
  const [word, phones] = line.split('\t');
  OPENCPOP_DICT[word] = phones.split(' ');
}

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function isJapanese(text: string): boolean {
  return /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
}

export function detectLanguage(text: string): 'zh' | 'ja' | 'en' {
  if (isJapanese(text)) return 'ja';
  if (isChinese(text)) return 'zh';
  return 'en';
}

let _pinyin: ((text: string, opts: any) => string | string[]) | null = null;
async function ensurePinyin() {
  if (!_pinyin) {
    const mod = await import('pinyin-pro');
    _pinyin = mod.pinyin;
  }
}
async function chineseToPinyin(text: string): Promise<string> {
  await ensurePinyin();
  const arr = _pinyin!(text, { toneType: 'none', type: 'array' });
  return Array.isArray(arr) ? arr.join(' ') : String(arr);
}

export async function chineseToPhonemes(text: string): Promise<{
  ph_seq: string[]; word_seq: string[]; ph_idx_to_word_idx: number[];
}> {
  const pinyinStr = await chineseToPinyin(text);
  return dictionaryG2P(pinyinStr);
}

export function dictionaryG2P(inputText: string): {
  ph_seq: string[]; word_seq: string[]; ph_idx_to_word_idx: number[];
} {
  const words = inputText.trim().split(/\s+/);
  const ph_seq: string[] = ['SP'];
  const word_seq: string[] = [];
  const ph_idx_to_word_idx: number[] = [-1];

  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const word = words[wordIdx];
    const phones = OPENCPOP_DICT[word];
    if (!phones) continue;
    word_seq.push(word);
    for (const ph of phones) {
      ph_seq.push(ph);
      ph_idx_to_word_idx.push(wordIdx);
    }
    if (ph_seq[ph_seq.length - 1] !== 'SP') {
      ph_seq.push('SP');
      ph_idx_to_word_idx.push(-1);
    }
  }

  return { ph_seq, word_seq, ph_idx_to_word_idx };
}

function phonemeSequenceToIds(ph_seq: string[]): number[] {
  return ph_seq.map(ph => VOCAB[ph] ?? 0);
}

function phonemeG2P(inputText: string): {
  ph_seq: string[]; word_seq: string[]; ph_idx_to_word_idx: number[];
} {
  const word_seq = inputText.trim().split(/\s+/).filter(ph => ph !== 'SP');
  const ph_seq: string[] = ['SP'];
  const ph_idx_to_word_idx: number[] = [-1];
  for (let i = 0; i < word_seq.length; i++) {
    ph_seq.push(word_seq[i]);
    ph_idx_to_word_idx.push(i);
    ph_seq.push('SP');
    ph_idx_to_word_idx.push(-1);
  }
  return { ph_seq, word_seq, ph_idx_to_word_idx };
}

// ── Japanese G2P (kana → romaji → Mandarin-compatible phonemes) ──

const KANA_TO_HEPBURN: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'o', 'ん': 'n', 'ゐ': 'wi', 'ゑ': 'we',
  'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
  'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'ゎ': 'wa',
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'ぢゃ': 'ja', 'ぢゅ': 'ju', 'ぢょ': 'jo',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'てゃ': 'tya', 'てゅ': 'tyu', 'てょ': 'tyo',
  'でゃ': 'dya', 'でゅ': 'dyu', 'でょ': 'dyo',
  'つぁ': 'tsa', 'つぃ': 'tsi', 'つぇ': 'tse', 'つぉ': 'tso',
  'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo',
  'うぃ': 'wi', 'うぇ': 'we', 'うぉ': 'wo',
  'ゔぁ': 'va', 'ゔぃ': 'vi', 'ゔぇ': 've', 'ゔぉ': 'vo',
};

function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function splitMora(hira: string): string[] {
  const small = 'ぁぃぅぇぉゃゅょゎ';
  const mora: string[] = [];
  let buf = '';
  for (const ch of hira) {
    if (ch === 'っ') {
      if (buf) { mora.push(buf); buf = ''; }
    } else if (small.includes(ch)) {
      buf += ch;
    } else {
      if (buf) mora.push(buf);
      buf = ch;
    }
  }
  if (buf) mora.push(buf);
  return mora;
}

const KANJI_TO_KANA: Record<string, string> = {
  '風': 'かぜ', '雨': 'あめ', '空': 'そら', '雲': 'くも', '月': 'つき', '星': 'ほし',
  '日': 'ひ', '夜': 'よる', '朝': 'あさ', '昼': 'ひる', '海': 'うみ', '山': 'やま',
  '川': 'かわ', '花': 'はな', '木': 'き', '森': 'もり', '林': 'はやし', '草': 'くさ',
  '人': 'ひと', '心': 'こころ', '体': 'からだ', '顔': 'かお', '目': 'め', '口': 'くち',
  '耳': 'みみ', '手': 'て', '足': 'あし', '髪': 'かみ', '涙': 'なみだ', '汗': 'あせ',
  '声': 'こえ', '音': 'おと', '色': 'いろ', '光': 'ひかり', '影': 'かげ', '夢': 'ゆめ',
  '恋': 'こい', '愛': 'あい', '歌': 'うた', '道': 'みち', '町': 'まち', '街': 'まち',
  '国': 'くに', '世': 'よ', '時': 'とき', '今': 'いま', '春': 'はる', '夏': 'なつ',
  '秋': 'あき', '冬': 'ふゆ', '雪': 'ゆき', '氷': 'こおり', '火': 'ひ', '水': 'みず',
  '土': 'つち', '石': 'いし', '家': 'いえ', '本': 'ほん', '紙': 'かみ', '鏡': 'かがみ',
  '命': 'いのち', '名': 'な', '気': 'き', '神': 'かみ', '猫': 'ねこ', '犬': 'いぬ',
  '鳥': 'とり', '魚': 'さかな', '桜': 'さくら',
  '待': 'ま', '言': 'い', '話': 'はな', '見': 'み', '聞': 'き', '行': 'い', '帰': 'かえ',
  '走': 'はし', '飛': 'と', '泣': 'な', '笑': 'わら', '書': 'か', '読': 'よ',
  '思': 'おも', '想': 'おも', '知': 'し', '分': 'わか', '会': 'あ', '出': 'で', '入': 'はい',
  '死': 'し', '生': 'いき', '咲': 'さ', '鳴': 'な', '降': 'ふ', '流': 'なが', '沈': 'しず',
  '溶': 'と', '響': 'ひび', '届': 'とど', '揺': 'ゆ', '迷': 'まよ', '忘': 'わす',
  '守': 'まも', '輝': 'かがや', '抱': 'だ', '強': 'つよ', '弱': 'よわ', '新': 'あたら',
  '古': 'ふる', '高': 'たか', '低': 'ひく', '長': 'なが', '短': 'みじか', '大': 'おお',
  '小': 'ちい', '早': 'はや', '速': 'はや', '静': 'しず', '真': 'ま', '暗': 'くら',
  '明': 'あか', '白': 'しろ', '黒': 'くろ', '赤': 'あか', '青': 'あお', '暖': 'あたた',
  '寒': 'さむ', '暑': 'あつ', '優': 'やさ', '深': 'ふか', '広': 'ひろ', '近': 'ちか',
  '遠': 'とお', '痛': 'いた', '眠': 'ねむ', '嬉': 'うれ', '悲': 'かな', '寂': 'さび',
  '懐': 'なつか', '楽': 'たの', '忙': 'いそが', '怖': 'こわ', '限': 'かぎ', '次': 'つぎ',
  '前': 'まえ', '後': 'あと', '中': 'なか', '上': 'うえ', '下': 'した', '外': 'そと',
  '内': 'うち', '側': 'そば', '隣': 'となり', '横': 'よこ', '右': 'みぎ', '左': 'ひだり',
  '方': 'ほう', '向': 'む', '歩': 'ある', '立': 'た', '座': 'すわ', '寝': 'ね', '起': 'お',
  '戻': 'もど', '続': 'つづ', '始': 'はじ', '終': 'お', '止': 'と', '動': 'うご',
  '触': 'ふ', '覚': 'おぼ', '疑': 'うたが', '変': 'か', '壊': 'こわ', '閉': 'と', '開': 'あ',
  '落': 'お', '転': 'ころ', '傷': 'きず', '支': 'ささ', '教': 'おし', '習': 'なら',
  '学': 'まな', '創': 'つく', '作': 'つく', '描': 'えが', '照': 'て', '燃': 'も', '焼': 'や',
  '舞': 'ま', '踊': 'おど', '眺': 'なが', '望': 'のぞ', '願': 'ねが', '祈': 'いの',
  '祝': 'いわ', '誇': 'ほこ', '信': 'しん', '頼': 'たよ', '包': 'つつ', '含': 'ふく',
  '溢': 'あふ', '満': 'み', '欠': 'か', '失': 'うしな', '残': 'のこ',
};

function japaneseToRomajiMora(text: string): string {
  let s = text.replace(COMPOUND_REGEX, (w) => JAPANESE_WORD_KANA[w]);
  s = katakanaToHiragana(
    s.replace(/[\u4e00-\u9fff]/g, (ch) => KANJI_TO_KANA[ch] ?? ch)
  );
  return splitMora(s).map((m) => KANA_TO_HEPBURN[m] ?? m).join(' ');
}

const JAPANESE_WORD_KANA: Record<string, string> = {
  '言葉': 'ことば', '貴方': 'あなた', '水溜り': 'みずたまり', '今日': 'きょう',
  '明日': 'あした', '昨日': 'きのう', '今朝': 'けさ', '今年': 'ことし',
  '自分': 'じぶん', '世界': 'せかい', '一緒': 'いっしょ', '一人': 'ひとり',
  '二人': 'ふたり', '何処': 'どこ', '何故': 'なぜ', '何時': 'いつ', '何': 'なに',
  '彼女': 'かのじょ', '大人': 'おとな', '子供': 'こども', '友達': 'ともだち',
  '家族': 'かぞく', '人生': 'じんせい', '青春': 'せいしゅん', '瞬間': 'しゅんかん',
  '永遠': 'えいえん', '未来': 'みらい', '過去': 'かこ', '現在': 'げんざい',
  '太陽': 'たいよう', '地球': 'ちきゅう', '宇宙': 'うちゅう', '星空': 'ほしぞら',
  '夜空': 'よぞら', '青空': 'あおぞら', '心臓': 'しんぞう', '本当': 'ほんとう',
  '全部': 'ぜんぶ', '全て': 'すべて', '最後': 'さいご', '最初': 'さいしょ',
  '始まり': 'はじまり', '終わり': 'おわり', '出会い': 'であい', '出逢い': 'であい',
  '別れ': 'わかれ', '約束': 'やくそく', '願い': 'ねがい', '想い': 'おもい',
  '思い': 'おもい', '想い出': 'おもいで', '明かり': 'あかり', '温もり': 'ぬくもり',
  '景色': 'けしき', '季節': 'きせつ', '時間': 'じかん', '夜明け': 'よあけ',
  '黄昏': 'たそがれ', '夕日': 'ゆうひ', '朝日': 'あさひ', '大丈夫': 'だいじょうぶ',
  '素敵': 'すてき', '綺麗': 'きれい', '大好き': 'だいすき', '頑張る': 'がんばる',
  '頑張れ': 'がんばれ', '頑張って': 'がんばって', '幸せ': 'しあわせ', '心配': 'しんぱい',
  '気持ち': 'きもち', '涙腺': 'るいせん', '帰る': 'かえる', '行く': 'いく', '来る': 'くる',
  '見る': 'みる', '聞く': 'きく', '話す': 'はなす', '言う': 'いう', '笑う': 'わらう',
  '泣く': 'なく', '歌う': 'うたう', '飛ぶ': 'とぶ', '走る': 'はしる', '歩く': 'あるく',
  '泳ぐ': 'およぐ', '待つ': 'まつ', '会う': 'あう', '読む': 'よむ', '書く': 'かく',
  '思う': 'おもう', '知る': 'しる', '分かる': 'わかる', '生きる': 'いきる', '死ぬ': 'しぬ',
  '生まれる': 'うまれる', '輝く': 'かがやく', '眠る': 'ねむる', '信じる': 'しんじる',
  '守る': 'まもる', '伝える': 'つたえる', '届く': 'とどく', '響く': 'ひびく',
  '揺れる': 'ゆれる', '目指す': 'めざす', '誓う': 'ちかう', '見つめる': 'みつめる',
  '抱きしめる': 'だきしめる', '逃げない': 'にげない', '離さない': 'はなさない',
  '離れない': 'はなれない', '忘れない': 'わすれない', '忘れて': 'わすれて',
  '覚えて': 'おぼえて', '会いたい': 'あいたい', '会えない': 'あえない', '会って': 'あって',
  '言って': 'いって', '聞いて': 'きいて', '見て': 'みて', '見つめて': 'みつめて',
  '抱いて': 'だいて', '伝えて': 'つたえて', '信じて': 'しんじて', '信じたい': 'しんじたい',
  '待っている': 'まっている', '呼んでいる': 'よんでいる', '帰って': 'かえって',
  '泣いて': 'ないて', '笑って': 'わらって', '歌って': 'うたって', '飛んで': 'とんで',
  '歩いて': 'あるいて', '走って': 'はしって', '願って': 'ねがって', '祈って': 'いのって',
  '包んで': 'つつんで', '溢れて': 'あふれて', '満ちて': 'みちて', '失って': 'うしなって',
  '残って': 'のこって', '戻って': 'もどって', '続いて': 'つづいて', '始まって': 'はじまって',
  '終わって': 'おわって', '止まって': 'とまって', '動いて': 'うごいて', '触れて': 'ふれて',
  '迷って': 'まよって', '壊れて': 'こわれて', '落ちて': 'おちて', '転んで': 'ころんで',
  '傷ついて': 'きずついて', '支えて': 'ささえて', '教えて': 'おしえて', '学んで': 'まなんで',
  '作って': 'つくって', '描いて': 'えがいて', '照らして': 'てらして', '燃えて': 'もえて',
  '焼けて': 'やけて', '舞って': 'まって', '踊って': 'おどって', '眺めて': 'ながめて',
  '望んで': 'のぞんで', '祝って': 'いわって', '頼って': 'たよって', '含んで': 'ふくんで',
  '浴びて': 'あびて', '上げて': 'あげて', '泣いてる': 'ないてる', '笑ってる': 'わらってる',
  '歌ってる': 'うたってる', '待ってる': 'まってる', '見つめてる': 'みつめてる',
  '信じてる': 'しんじてる', '忘れてる': 'わすれてる', '降って': 'ふって',
  '流れて': 'ながれて', '沈んで': 'しずんで', '溶けて': 'とけて', '届いて': 'とどいて',
  '響いて': 'ひびいて', '揺れて': 'ゆれて', '生まれて': 'うまれて', '生きて': 'いきて',
  '輝いて': 'かがやいて', '眠って': 'ねむって', '守って': 'まもって', '誓って': 'ちかって',
};

const JAPANESE_COMPOUND_KEYS = Object.keys(JAPANESE_WORD_KANA).sort((a, b) => b.length - a.length);
const COMPOUND_REGEX = new RegExp(
  JAPANESE_COMPOUND_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g'
);

const JAPANESE_DICT_RAW =
`AP	A P
SP	S P
br	b r
cl	c l
vf	v f
a	a
i	i
u	u
e	e
o	o
N	N
n	n
ka	k a
ki	k i
ku	k u
ke	k e
ko	k o
kya	k y a
kyi	k y i
kyu	k y u
kye	k y e
kyo	k y o
sa	s a
si	s i
su	s u
se	s e
so	s o
sha	sh a
shi	sh i
shu	sh u
she	sh e
sho	sh o
ta	t a
ti	t i
tu	t u
te	t e
to	t o
ha	h a
hi	h i
hu	h u
he	h e
ho	h o
hya	h y a
hyi	h y i
hyu	h y u
hye	h y e
hyo	h y o
ga	g a
gi	g i
gu	g u
ge	g e
go	g o
gya	g y a
gyi	g y i
gyu	g y u
gye	g y e
gyo	g y o
za	z a
zi	z i
zu	z u
ze	z e
zo	z o
da	d a
di	d i
du	d u
de	d e
do	d o
dya	d y a
dyi	d y i
dyu	d y u
dye	d y e
dyo	d y o
ba	b a
bi	b i
bu	b u
be	b e
bo	b o
bya	b y a
byi	b y i
byu	b y u
bye	b y e
byo	b y o
pa	p a
pi	p i
pu	p u
pe	p e
po	p o
pya	p y a
pyi	p y i
pyu	p y u
pye	p y e
pyo	p y o
ja	j a
ji	j i
ju	j u
je	j e
jo	j o
fa	f a
fi	f i
fu	f u
fe	f e
fo	f o
cha	ch a
chi	ch i
chu	ch u
che	ch e
cho	ch o
tsa	t s a
tsi	t s i
tsu	t s u
tse	t s e
tso	t s o
na	n a
ni	n i
nu	n u
ne	n e
no	n o
nya	n y a
nyi	n y i
nyu	n y u
nye	n y e
nyo	n y o
ma	m a
mi	m i
mu	m u
me	m e
mo	m o
mya	m y a
myi	m y i
myu	m y u
mye	m y e
myo	m y o
ra	r a
ri	r i
ru	r u
re	r e
ro	r o
rya	r y a
ryi	r y i
ryu	r y u
rye	r y e
ryo	r y o
ya	y a
yi	y i
yu	y u
ye	y e
yo	y o
wa	w a
wi	w i
wu	w u
we	w e
wo	w o
tya	t y a
tyi	t y i
tyu	t y u
tye	t y e
tyo	t y o`;

const JAPANESE_DICT: Record<string, string[]> = {};
for (const line of JAPANESE_DICT_RAW.split('\n')) {
  const [word, phones] = line.split('\t');
  if (word && phones) JAPANESE_DICT[word] = phones.split(' ');
}

function japaneseG2P(romajiText: string): {
  ph_seq: string[]; word_seq: string[]; ph_idx_to_word_idx: number[];
} {
  const words = romajiText.trim().split(/\s+/).filter(Boolean);
  const ph_seq: string[] = ['SP'];
  const word_seq: string[] = [];
  const ph_idx_to_word_idx: number[] = [-1];
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    const phones = JAPANESE_DICT[word];
    if (!phones) continue;
    word_seq.push(word);
    for (const ph of phones) {
      ph_seq.push(ph);
      ph_idx_to_word_idx.push(w);
    }
    if (ph_seq[ph_seq.length - 1] !== 'SP') {
      ph_seq.push('SP');
      ph_idx_to_word_idx.push(-1);
    }
  }
  return { ph_seq, word_seq, ph_idx_to_word_idx };
}

export async function lyricsToPhonemes(lyrics: string, lang?: 'zh' | 'ja' | 'en'): Promise<{
  ph_seq: string[]; word_seq: string[]; ph_idx_to_word_idx: number[];
  ph_seq_id: number[];
}> {
  const cleanText = lyrics.replace(/\[\d{2}:\d{2}(?:\.\d+)?\]/g, '').trim();
  const detected = lang ?? detectLanguage(cleanText);

  let result: { ph_seq: string[]; word_seq: string[]; ph_idx_to_word_idx: number[] };
  if (detected === 'zh') {
    result = await chineseToPhonemes(cleanText);
  } else if (detected === 'ja') {
    result = japaneseG2P(japaneseToRomajiMora(cleanText));
  } else {
    result = phonemeG2P(cleanText);
  }

  return {
    ...result,
    ph_seq_id: phonemeSequenceToIds(result.ph_seq),
  };
}
