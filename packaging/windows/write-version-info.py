"""Build-only Windows PE metadata, using the same version as the installer."""
import os,pathlib,re,sys
version=os.environ.get('SKECHU_VERSION','0.2.0-dev')
match=re.fullmatch(r'(\d+)\.(\d+)\.(\d+)(?:-[A-Za-z0-9.-]+)?',version)
if not match:raise SystemExit('Invalid release version')
numbers=tuple(map(int,match.groups()))+(0,)
if any(v>65535 for v in numbers):raise SystemExit('Version component too large')
fields={'CompanyName':'Hsiao, Chao-Hsiang','FileDescription':'Skechu-PPT local PowerPoint connector','FileVersion':version,'InternalName':'Skechu-PPT','OriginalFilename':'Skechu-PPT.exe','ProductName':'Skechu-PPT','ProductVersion':version,'LegalCopyright':'Skechu-PPT contributors; MIT License'}
strings=','.join(f'StringStruct({key!r},{value!r})' for key,value in fields.items())
content=f"VSVersionInfo(ffi=FixedFileInfo(filevers={numbers!r},prodvers={numbers!r},mask=0x3f,flags=0,OS=0x40004,fileType=1,subtype=0,date=(0,0)),kids=[StringFileInfo([StringTable('040904B0',[{strings}])]),VarFileInfo([VarStruct('Translation',[1033,1200])])])"
pathlib.Path(sys.argv[1]).write_text(content,encoding='utf-8')
