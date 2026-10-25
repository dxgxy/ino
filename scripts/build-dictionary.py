import csv, json, hashlib, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
source = root / 'data-sources/ecdict.csv'
output = root / 'public/dictionaries'
output.mkdir(parents=True, exist_ok=True)
labels = {'cet4':'四级', 'cet6':'六级', 'ielts':'雅思', 'toefl':'托福', 'gk':'高考', 'zk':'中考', 'ky':'考研', 'gre':'GRE'}
clean = lambda value: (value or '').replace('\\n','\n').strip()
rows = {}
with source.open(encoding='utf-8-sig', newline='') as stream:
    for row in csv.DictReader(stream):
        word = row['word'].strip().lower()
        if not word or not row['translation'].strip() or not all(c.isalpha() or c in " -'" for c in word) or not word.isascii():
            continue
        if word in rows:
            continue
        rows[word] = row
rank = lambda row: int(row['frq']) if row.get('frq','').isdigit() and int(row['frq']) > 0 else 1000000
books = []
cards = {}
for key, title in [('common','常用英语'),('cet4','四级词汇'),('cet6','六级词汇'),('ielts','雅思词汇')]:
    selected = sorted([r for r in rows.values() if (r.get('oxford') == '1' if key == 'common' else key in r.get('tag','').split())], key=lambda r:(rank(r),r['word']))
    ids = []
    for row in selected:
        word = row['word'].strip().lower()
        cid = 'ecdict:' + word
        ids.append(cid)
        cards[cid] = {'id':cid,'kind':'word','content':word,'translation':clean(row['translation']),'definition':clean(row['definition']),'phonetic':clean(row['phonetic']),'exchange':clean(row['exchange']),'tags':[labels.get(t,t) for t in row['tag'].split()],'source':'ECDICT','sourceUrl':'https://github.com/skywind3000/ECDICT','updatedAt':'2026-10-23T00:00:00Z'}
    books.append({'id':key,'name':title,'cardIds':ids})
distribution = 'npm:ecdict@0.0.4'
metadata = {'name':'ECDICT','url':'https://github.com/skywind3000/ECDICT','distribution':distribution,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'license':'MIT','cardCount':len(cards),'books':[{ 'name':b['name'],'count':len(b['cardIds'])} for b in books]}
(root/'src/data').mkdir(parents=True, exist_ok=True)
(root/'src/data/ecdict.json').write_text(json.dumps({'metadata':metadata,'cards':list(cards.values()),'books':books},ensure_ascii=False),encoding='utf-8')
(output/'ECDICT-LICENSE.txt').write_bytes((source.parent/'ECDICT-LICENSE.txt').read_bytes())
(output/'source.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(metadata,ensure_ascii=False,indent=2))


