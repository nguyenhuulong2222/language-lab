# Independent check of both answer keys against the official sources (own parser, own normaliser; shares no code with the repo).
import json,re,subprocess,html
R='/Volumes/Crucial1TB/language-lab/'
ONES={w:i for i,w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split())}
TENS={w:10*i for i,w in enumerate("x x twenty thirty forty fifty sixty seventy eighty ninety".split()) if w!='x'}
ORD={'first':1,'second':2,'third':3,'fourth':4,'fifth':5,'eleventh':11,'twelfth':12,'thirteenth':13,'fourteenth':14,'fifteenth':15,'sixteenth':16,'nineteenth':19,'twentieth':20,'twenty-second':22,'twenty second':22}
def words_to_digits(tokens):
    out=[];i=0
    while i<len(tokens):
        t=tokens[i]
        if t in TENS or t in ONES or t in('hundred','thousand'):
            total=0;cur=0;j=i;used=False
            while j<len(tokens) and (tokens[j] in TENS or tokens[j] in ONES or tokens[j] in('hundred','thousand')):
                w=tokens[j]
                if w in ONES: cur+=ONES[w]
                elif w in TENS: cur+=TENS[w]
                elif w=='hundred': cur=(cur or 1)*100
                elif w=='thousand': total+=(cur or 1)*1000;cur=0
                used=True;j+=1
            out.append(str(total+cur)); i=j
        else: out.append(t); i+=1
    return out
def tok(t):
    t=html.unescape(t).replace('\u2019',"'").replace('\u201c','"').replace('\u201d','"').lower()
    t=re.sub(r'\bu\.\s?s\.','us',t); t=t.replace('d.c.','dc').replace('.','')
    t=t.replace('-',' ').replace('/',' ')
    t=re.sub(r"[^a-z0-9' ]",' ',t).replace("'",'')
    ts=t.split()
    ts=[str(ORD[x]) if x in ORD else x for x in ts]
    ts=[re.sub(r'^(\d+)(st|nd|rd|th)$',r'\1',x) for x in ts]
    return words_to_digits(ts)
def toks(t): return tok(t)
# ---- 2008
src=open(R+'data/sources/uscis-2008-civics-100.html',encoding='utf8').read()
body=src[src.find('<div class="WordSection1">'):]
Q08=[]
for m in re.finditer(r'<li>((?:(?!<li>|</li>|<ul>).)*?)<ul>(.*?)</ul></li>',body,flags=re.S):
    q=html.unescape(re.sub(r'<[^>]+>','',m.group(1))).strip()
    a=[html.unescape(re.sub(r'<[^>]+>','',x)).strip() for x in re.findall(r'<li>(.*?)</li>',m.group(2),flags=re.S)]
    Q08.append((q,a))
# ---- 2025
txt=subprocess.run(['pdftotext','-layout',R+'data/sources/uscis-2025-civics-128.pdf','-'],capture_output=True,text=True).stdout
Q25=[];cur=None
for l in txt.split('\n'):
    m=re.match(r'^\s{0,3}(\d{1,3})\.\s+(.*)$',l)
    if m and '•' not in l[:8]:
        cur={'q':m.group(2).strip(),'a':[]};Q25.append(cur);continue
    if cur is None: continue
    s=l.strip()
    if s.startswith('•'): cur['a'].append(s[1:].strip())
    elif not s or re.search(r'uscis\.gov|of 19|M-1778',s) or re.match(r'^[A-Z]: ',s) or s.isupper() or s=='*': continue
    elif cur['a']: cur['a'][-1]+=' '+s
    else: cur['q']+=' '+s
Q25=[(c['q'].rstrip('*').strip(),c['a']) for c in Q25]
def source_forms(b):
    # every way an official bullet may be stored: whole, parentheticals removed, parenthetical content, slash alternatives, with/without leading article
    forms=set()
    cands={b, re.sub(r'\s*\([^)]*\)','',b), b.replace('(','').replace(')','')}
    for inner in re.findall(r'\(([^)]*)\)',b): cands.add(inner)
    for c in list(cands):
        if '/' in c:
            for part in c.split('/'): cands.add(part)
    for c in cands:
        t=tuple(toks(c))
        if t: forms.add(t)
        for art in ('the','a','an'):
            if t and t[0]==art and len(t)>1: forms.add(t[1:])
    return forms
def check(version,Q,key):
    miss=[];extra=[];textdiff=[]
    for i,(q,ans) in enumerate(Q):
        e=key[i]
        if e['id']!=f'{version}-{i+1:03d}': miss.append((e['id'],'id/order',f'expected {version}-{i+1:03d}'))
        if toks(q)!=toks(e['questionText']): textdiff.append((e['id'],q,e['questionText']))
        if e['answerType']=='dynamic': continue
        stored={tuple(toks(a)) for a in e['acceptedAnswers']}
        stored|={t[1:] for t in stored if len(t)>1 and t[0] in('the','a','an')}
        for b in ans:
            if not (source_forms(b)&stored): miss.append((e['id'],'official answer not in key',b))
        # every word the key uses must occur in the official answers of that question (numbers compared as digits)
        srcwords=set()
        for b in ans: srcwords|=set(toks(b))
        srcwords|=set(toks(q))
        for a in e['acceptedAnswers']:
            new=[w for w in toks(a) if w not in srcwords and w not in('the','a','an','of','and','to','in')]
            if new: extra.append((e['id'],'key answer uses words not in the official text',a+'  [new: '+' '.join(new)+']'))
    return miss,extra,textdiff
k08=json.load(open(R+'data/civics-answers/2008.json'))['entries']
k25=json.load(open(R+'data/civics-answers/2025.json'))['entries']
res={}
for v,Q,k in (('2008',Q08,k08),('2025',Q25,k25)):
    miss,extra,td=check(v,Q,k)
    print(f'{v}: source questions {len(Q)}, key entries {len(k)}, ids ok: {len(Q)==len(k)}')
    print('  question text differences:',len(td)); [print('   ',x) for x in td[:8]]
    print('  official answers missing from key:',len(miss)); [print('   ',x) for x in miss[:15]]
    print('  key answers with words not in the official text:',len(extra)); [print('   ',x) for x in extra[:25]]
    res[v]={'questions':len(Q),'entries':len(k),'textdiff':td,'missing':miss,'extra':extra}
json.dump(res,open('/tmp/audit/keycheck2.json','w'),indent=1,ensure_ascii=False)
